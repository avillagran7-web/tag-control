import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, Image, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '../_layout';
import { formatCLP, formatTime } from '../../src/lib/format';
import { getTarifa, getTarifaLabel } from '../../src/lib/pricing';
import { inferMissingTolls, inferPostTrip } from '../../src/lib/inference';
import { TOLL_GROUP_KEY } from '../../src/lib/geoUtils';
import { requestLocationPermissions, startTracking, stopTracking } from '../../src/lib/locationService';
import { upsertLiveTrip, insertLiveCrossing, insertPosition, endLiveTrip, cleanupOldPositions, closeOrphanedTrips, flushPositionQueue } from '../../src/lib/liveTracking';
import { supabase } from '../../src/lib/supabase';

const PRIMARY = '#0F6E56';

export default function HomeScreen() {
  const { user } = useUser();
  const [isActive, setIsActive] = useState(false);
  const [crossings, setCrossings] = useState([]);
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [budget, setBudget] = useState(null);
  const [foregroundOnly, setForegroundOnly] = useState(false);

  const tripIdRef = useRef(null);
  const crossingsRef = useRef([]);
  const positionIntervalRef = useRef(null);

  useEffect(() => { crossingsRef.current = crossings; }, [crossings]);

  // Load budget
  useEffect(() => {
    async function loadBudget() {
      try {
        const { data: b } = await supabase.from('budgets').select('*').eq('user_name', user.name).single();
        const now = new Date();
        const { data: trips } = await supabase.from('trips').select('total_cost,start_time').eq('driver', user.name);
        const monthSpent = (trips || [])
          .filter(t => { const d = new Date(t.start_time); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
          .reduce((s, t) => s + (t.total_cost || 0), 0);
        setBudget({ monthly_limit: b?.monthly_limit || 0, spent: monthSpent });
      } catch { setBudget({ monthly_limit: 0, spent: 0 }); }
    }
    loadBudget();
  }, [user.name, isActive]);

  const totalCost = crossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
  const tollCount = crossings.length;

  const handleTollCrossed = useCallback((crossing) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setCrossings((prev) => {
      const updated = [...prev, crossing];

      // Infer missing tolls
      const inferred = inferMissingTolls(updated);
      const newInferred = inferred.filter(inf => {
        const infKey = TOLL_GROUP_KEY[inf.toll.id] || inf.toll.id;
        return !updated.some(c => {
          const cKey = TOLL_GROUP_KEY[c.toll?.id || c.tollId] || c.toll?.id || c.tollId;
          return cKey === infKey;
        });
      });

      // Send to Supabase
      if (tripIdRef.current) {
        insertLiveCrossing({
          tripId: tripIdRef.current, tollId: crossing.toll.id,
          tollNombre: crossing.toll.nombre, tollRuta: crossing.toll.ruta,
          tarifa: getTarifa(crossing.toll, new Date(crossing.timestamp)),
          lat: crossing.lat, lng: crossing.lng,
        }).catch(() => {});

        for (const inf of newInferred) {
          insertLiveCrossing({
            tripId: tripIdRef.current, tollId: inf.toll.id,
            tollNombre: inf.toll.nombre, tollRuta: inf.toll.ruta,
            tarifa: getTarifa(inf.toll, new Date(inf.timestamp)),
            lat: inf.toll.lat, lng: inf.toll.lng,
          }).catch(() => {});
        }
      }

      return [...updated, ...newInferred];
    });
  }, []);

  const handlePositionUpdate = useCallback((pos) => {
    setPosition({ lat: pos.lat, lng: pos.lng });
    setSpeed(pos.speed);

    // Send position to Supabase every update
    if (tripIdRef.current) {
      insertPosition({
        tripId: tripIdRef.current, lat: pos.lat, lng: pos.lng, speed: pos.speed,
      }).catch(() => {});
    }
  }, []);

  // Upsert live trip every 30s
  useEffect(() => {
    if (!isActive || !tripIdRef.current) return;
    const send = () => {
      if (!position || !tripIdRef.current) return;
      const cx = crossingsRef.current;
      const cost = cx.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
      upsertLiveTrip({
        id: tripIdRef.current, driver: user.name,
        lat: position.lat, lng: position.lng, speed,
        isActive: true, totalCost: cost, tollCount: cx.length,
        lastToll: cx.length > 0 ? cx[cx.length - 1].toll?.nombre : null,
      }).catch(() => {});
    };
    send();
    positionIntervalRef.current = setInterval(send, 30000);
    return () => clearInterval(positionIntervalRef.current);
  }, [isActive, position?.lat, position?.lng, user.name]);

  const handleStartTrip = async () => {
    const mode = await requestLocationPermissions();
    if (!mode) {
      Alert.alert(
        'Permiso de ubicación requerido',
        'TAGcontrol necesita acceso a tu ubicación para detectar peajes. Ve a Configuración > TAGcontrol > Ubicación y selecciona "Al usar la app" o "Siempre".',
        [{ text: 'OK' }]
      );
      return;
    }

    const isBackground = mode === 'background';
    setForegroundOnly(!isBackground);

    const id = `trip-${user.name}-${Date.now()}`;
    tripIdRef.current = id;
    setIsActive(true);
    setCrossings([]);
    setStartTime(Date.now());

    cleanupOldPositions().catch(() => {});
    closeOrphanedTrips(user.name, id).catch(() => {});

    await startTracking({
      onTollCrossed: handleTollCrossed,
      onPositionUpdate: handlePositionUpdate,
      background: isBackground,
    });
  };

  const handleStopTrip = async () => {
    Alert.alert('Detener viaje', 'Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Detener', style: 'destructive', onPress: async () => {
          await stopTracking();
          const currentId = tripIdRef.current;
          const cx = crossingsRef.current;

          // Post-trip inference
          const inferred = inferPostTrip(cx);
          const allCrossings = [...cx, ...inferred].sort((a, b) => a.timestamp - b.timestamp);
          const cost = allCrossings.reduce((sum, c) => sum + getTarifa(c.toll, new Date(c.timestamp)), 0);
          const routes = [...new Set(allCrossings.map(c => c.toll.ruta))];

          // Siempre grabamos el trip aunque tenga 0 peajes — las posiciones GPS
          // siguen vivas 24h y el Admin las puede reconstruir. Tirar el trip
          // silenciosamente esconde fallas de detección (bug Francisco 2026-04-15).
          if (currentId) {
            // Flush any buffered positions before saving trip so reconstruction works
            await flushPositionQueue().catch(() => {});

            const tripRow = {
              id: currentId, driver: user.name,
              start_time: new Date(startTime || allCrossings[0]?.timestamp || Date.now()).toISOString(),
              end_time: new Date().toISOString(),
              total_cost: cost, toll_count: allCrossings.length, routes,
              platform: Platform.OS,
              crossings: allCrossings.map(c => ({
                tollId: c.toll.id, tollNombre: c.toll.nombre, tollRuta: c.toll.ruta,
                tarifa: getTarifa(c.toll, new Date(c.timestamp)),
                timestamp: c.timestamp, inferred: c.inferred || false,
              })),
            };

            // Retry trip insert up to 3x — losing a trip row is unacceptable
            let saved = false;
            for (let attempt = 0; attempt < 3 && !saved; attempt++) {
              if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
              const { error } = await supabase.from('trips').insert(tripRow);
              if (!error) saved = true;
            }
          }

          if (currentId) endLiveTrip(currentId).catch(() => {});
          tripIdRef.current = null;
          setIsActive(false);
        },
      },
    ]);
  };

  const tarifaLabel = getTarifaLabel();

  // ── Demo mode ──
  if (user.isDemo && !isActive) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Image source={require('../../assets/icon.png')} style={s.heroIcon} />
        <Text style={s.heroTitle}>TAGcontrol</Text>
        <Text style={s.heroSubtitle}>Detecta automaticamente cada peaje que cruzas</Text>
        <View style={s.demoBanner}>
          <Text style={s.demoBannerTitle}>Modo demostración</Text>
          <Text style={s.demoBannerText}>
            Estás explorando TAGcontrol con datos de ejemplo. Crea una cuenta para registrar tus viajes reales.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://tag-control.vercel.app/privacy')}>
            <Text style={s.demoBannerLink}>Política de privacidad</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[s.startButton, { opacity: 0.4 }]} disabled>
          <Text style={s.startButtonText}>Iniciar viaje</Text>
        </TouchableOpacity>
        <Text style={s.tarifaHint}>Disponible al crear una cuenta</Text>
      </ScrollView>
    );
  }

  // ── Before trip ──
  if (!isActive && crossings.length === 0) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Image source={require('../../assets/icon.png')} style={s.heroIcon} />
        <Text style={s.heroTitle}>Registra tus peajes</Text>
        <Text style={s.heroSubtitle}>Detecta automaticamente cada peaje que cruzas</Text>

        {budget && (
          <View style={s.budgetCard}>
            <Text style={s.budgetLabel}>Peajes este mes</Text>
            <Text style={s.budgetAmount}>{formatCLP(budget.spent)}</Text>
            {budget.monthly_limit > 0 && (
              <View style={s.progressBar}>
                <View style={[s.progressFill, {
                  width: `${Math.min((budget.spent / budget.monthly_limit) * 100, 100)}%`,
                  backgroundColor: budget.spent > budget.monthly_limit ? '#e53935' : PRIMARY,
                }]} />
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={s.startButton} onPress={handleStartTrip}>
          <Text style={s.startButtonText}>Iniciar viaje</Text>
        </TouchableOpacity>

        <Text style={s.tarifaHint}>Tarifa {tarifaLabel.toLowerCase()}</Text>
      </ScrollView>
    );
  }

  // ── During / After trip ──
  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Hero */}
        <View style={s.totalCard}>
          <View style={s.totalHeader}>
            <Text style={s.totalLabel}>{isActive ? 'Viaje en curso' : 'Viaje terminado'}</Text>
            {isActive && (
              <View style={s.gpsBadge}>
                <View style={s.gpsDot} />
                <Text style={s.gpsText}>{Math.round(speed)} km/h</Text>
              </View>
            )}
          </View>
          <Text style={s.totalAmount}>{formatCLP(totalCost)}</Text>
          <Text style={s.totalSub}>
            {tollCount === 0 ? 'Esperando peajes...' : `${tollCount} peaje${tollCount > 1 ? 's' : ''}`}
            {' \u00B7 '}{tarifaLabel}
          </Text>
        </View>

        {/* Warning */}
        {isActive && !foregroundOnly && (
          <View style={s.activeNotice}>
            <Text style={s.activeNoticeText}>
              <Text style={{ fontWeight: '700' }}>GPS activo en segundo plano</Text>
              {' \u2014 puedes cerrar la app, seguimos detectando'}
            </Text>
          </View>
        )}
        {isActive && foregroundOnly && (
          <View style={s.foregroundNotice}>
            <Text style={s.foregroundNoticeText}>
              <Text style={{ fontWeight: '700' }}>Mant\u00e9n la app visible</Text>
              {' \u2014 el GPS se pausa si cierras la app. Para detecci\u00f3n en segundo plano, ve a Configuraci\u00f3n > TAGcontrol > Ubicaci\u00f3n > Siempre.'}
            </Text>
          </View>
        )}

        {/* Crossings */}
        {crossings.length > 0 && (
          <View style={s.crossingsList}>
            <Text style={s.crossingsTitle}>PEAJES</Text>
            {[...crossings].reverse().map((c, i) => (
              <View key={`${c.toll.id}-${c.timestamp}`} style={s.crossingItem}>
                <View>
                  <Text style={s.crossingName}>{c.toll.nombre}</Text>
                  <Text style={s.crossingRoute}>{c.toll.ruta} {'\u00B7'} {formatTime(c.timestamp)}</Text>
                </View>
                <Text style={s.crossingCost}>{formatCLP(getTarifa(c.toll, new Date(c.timestamp)))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Waiting spinner */}
        {isActive && crossings.length === 0 && (
          <View style={s.waiting}>
            <Text style={s.waitingText}>Conduciendo...</Text>
            <Text style={s.waitingHint}>Suena una alerta en cada peaje</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={s.bottomBar}>
        {isActive ? (
          <TouchableOpacity style={s.stopButton} onPress={handleStopTrip}>
            <Text style={s.stopButtonText}>Detener viaje</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.startButton} onPress={handleStartTrip}>
            <Text style={s.startButtonText}>Nuevo viaje</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 100 },
  heroIcon: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', alignSelf: 'center', marginTop: 20, marginBottom: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  heroSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  budgetCard: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 16, marginBottom: 16 },
  budgetLabel: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  budgetAmount: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  progressBar: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  startButton: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  startButtonText: { color: '#fff', fontWeight: '600', fontSize: 17 },
  tarifaHint: { fontSize: 11, color: '#aaa', textAlign: 'center' },
  demoBanner: { backgroundColor: '#f0faf6', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 16, padding: 16, marginBottom: 20, width: '100%' },
  demoBannerTitle: { fontSize: 14, fontWeight: '700', color: '#065f46', marginBottom: 4 },
  demoBannerText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  demoBannerLink: { fontSize: 11, color: '#0F6E56', marginTop: 10, textDecorationLine: 'underline' },

  totalCard: { backgroundColor: PRIMARY, borderRadius: 20, padding: 20, marginBottom: 12 },
  totalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac', marginRight: 4 },
  gpsText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  totalAmount: { fontSize: 40, fontWeight: '700', color: '#fff' },
  totalSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  activeNotice: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 12, padding: 12, marginBottom: 12 },
  activeNoticeText: { fontSize: 12, color: '#065f46' },
  foregroundNotice: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffe082', borderRadius: 12, padding: 12, marginBottom: 12 },
  foregroundNoticeText: { fontSize: 12, color: '#7c5200' },

  crossingsList: { marginTop: 8 },
  crossingsTitle: { fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 1, marginBottom: 8 },
  crossingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, marginBottom: 6 },
  crossingName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  crossingRoute: { fontSize: 12, color: '#888', marginTop: 2 },
  crossingCost: { fontSize: 16, fontWeight: '700', color: PRIMARY },

  waiting: { alignItems: 'center', paddingVertical: 40 },
  waitingText: { fontSize: 16, color: '#1a1a1a', marginTop: 12 },
  waitingHint: { fontSize: 12, color: '#888', marginTop: 4 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: '#fff' },
  stopButton: { backgroundColor: '#e53935', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  stopButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
