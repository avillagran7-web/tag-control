import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useTrip } from '../hooks/useTrip';
import { getTarifaLabel, getTarifa } from '../lib/pricing';
import { formatCLP } from '../lib/format';
import { playTollSound, initAudio } from '../lib/sound';
import { upsertLiveTrip, insertLiveCrossing, endLiveTrip } from '../lib/liveTracking';
import { inferMissingTolls } from '../lib/inference';
import { supabase } from '../lib/supabase';
import TollChip from '../components/TollChip';
import { useUser } from '../App';

export default function Home() {
  const { user } = useUser();
  const trip = useTrip();
  const wakeLockRef = useRef(null);
  const tripIdRef = useRef(null);
  const [budget, setBudget] = useState(null); // { monthly_limit, spent }
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // Cargar meta y gasto del mes
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
  }, [user.name, trip.isActive]);

  const saveBudget = async () => {
    const amount = parseInt(budgetInput) || 0;
    await supabase.from('budgets').upsert({ user_name: user.name, monthly_limit: amount, updated_at: new Date().toISOString() });
    setBudget(prev => ({ ...prev, monthly_limit: amount }));
    setEditingBudget(false);
  };

  const handleTollCrossed = useCallback(
    (crossing) => {
      if (!trip.isActive) return;
      trip.addCrossing(crossing);
      playTollSound();

      // Enviar cruce a Supabase
      const sendToSupabase = (c) => {
        if (!tripIdRef.current) return;
        insertLiveCrossing({
          tripId: tripIdRef.current,
          tollId: c.toll.id,
          tollNombre: c.toll.nombre,
          tollRuta: c.toll.ruta,
          tarifa: getTarifa(c.toll, new Date(c.timestamp)),
          lat: c.lat,
          lng: c.lng,
        }).catch(() => {});
      };

      sendToSupabase(crossing);

      // Inferir pórticos faltantes (ej: túneles donde GPS no funciona)
      const allCrossings = [...trip.crossings, crossing];
      const inferred = inferMissingTolls(allCrossings);
      for (const inf of inferred) {
        // Solo agregar si no está ya en los crossings
        const alreadyCrossed = allCrossings.some(c => (c.toll?.id || c.tollId) === inf.toll.id);
        if (!alreadyCrossed) {
          trip.addCrossing(inf);
          sendToSupabase(inf);
        }
      }
    },
    [trip.isActive, trip.addCrossing, trip.crossings]
  );

  const gps = useGPS({ onTollCrossed: handleTollCrossed });

  // Enviar posición a Supabase cada 10 segundos
  useEffect(() => {
    if (!trip.isActive || !gps.position || !tripIdRef.current) return;
    const interval = setInterval(() => {
      if (gps.position && tripIdRef.current) {
        upsertLiveTrip({
          id: tripIdRef.current,
          driver: user.name,
          lat: gps.position.lat,
          lng: gps.position.lng,
          speed: gps.speed,
          isActive: true,
          totalCost: trip.totalCost,
          tollCount: trip.tollCount,
          lastToll: trip.crossings.length > 0 ? trip.crossings[trip.crossings.length - 1].toll.nombre : null,
        }).catch(() => {});
      }
    }, 30000); // Cada 30s (ahorra batería y datos)
    // Enviar inmediatamente también
    upsertLiveTrip({
      id: tripIdRef.current,
      driver: user.name,
      lat: gps.position.lat,
      lng: gps.position.lng,
      speed: gps.speed,
      isActive: true,
      totalCost: trip.totalCost,
      tollCount: trip.tollCount,
      lastToll: trip.crossings.length > 0 ? trip.crossings[trip.crossings.length - 1].toll.nombre : null,
    }).catch(() => {});
    return () => clearInterval(interval);
  }, [trip.isActive, gps.position?.lat, gps.position?.lng, trip.totalCost]);

  useEffect(() => {
    async function acquireWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}
    }
    function handleVisibilityChange() {
      if (trip.isActive && document.visibilityState === 'visible') acquireWakeLock();
    }
    if (trip.isActive) {
      acquireWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, [trip.isActive]);

  const handleToggleTrip = () => {
    if (trip.isActive) {
      gps.stopTracking();
      trip.endTrip();
      if (tripIdRef.current) {
        endLiveTrip(tripIdRef.current).catch(() => {});
        tripIdRef.current = null;
      }
    } else {
      const id = 'trip-' + Date.now();
      tripIdRef.current = id;
      initAudio();
      trip.startTrip(user.name);
      gps.startTracking();
    }
  };

  const handleResumeTrip = () => {
    if (!tripIdRef.current) {
      tripIdRef.current = 'trip-' + Date.now();
    }
    initAudio();
    trip.resumeTrip();
    gps.startTracking();
  };

  const tarifaLabel = getTarifaLabel();

  // ─── PANTALLA ANTES DE INICIAR ───
  if (!trip.isActive && trip.crossings.length === 0) {
    return (
      <div className="flex flex-col justify-between p-5 pb-2" style={{ minHeight: 'calc(100vh - 56px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 52px)' }}>
        <div>
          <div className="text-center pt-4 pb-3">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 512 512" className="w-10 h-10">
                <path d="M256 80c-70 0-126 56-126 126 0 90 126 210 126 210s126-120 126-210c0-70-56-126-126-126z" fill="#fff" opacity="0.95"/>
                <circle cx="256" cy="206" r="56" fill="#2D6A4F"/>
                <path d="M232 210 L250 228 L284 188" fill="none" stroke="#A7F3D0" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-[20px] font-bold text-text tracking-tight">Registra tus peajes</h1>
            <p className="text-[14px] text-text-secondary mt-0.5">
              Detecta automáticamente cada peaje que cruzas
            </p>
          </div>

          {/* Meta de gasto mensual */}
          {budget && (
            <div className="bg-surface-secondary rounded-2xl p-4 mb-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">Peajes este mes</p>
                <button
                  onClick={() => { setEditingBudget(!editingBudget); setBudgetInput(budget.monthly_limit > 0 ? String(budget.monthly_limit) : ''); }}
                  className="text-[12px] text-primary font-medium"
                >
                  {budget.monthly_limit > 0 ? 'Editar meta' : 'Fijar meta'}
                </button>
              </div>
              <p className="text-[26px] font-bold text-text tracking-tight">{formatCLP(budget.spent)}</p>
              {budget.monthly_limit > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-text-tertiary mt-1.5 mb-1">
                    <span>{Math.round((budget.spent / budget.monthly_limit) * 100)}% usado</span>
                    <span>Meta: {formatCLP(budget.monthly_limit)}</span>
                  </div>
                  <div className="w-full bg-surface-tertiary rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${budget.spent > budget.monthly_limit ? 'bg-danger' : budget.spent > budget.monthly_limit * 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min((budget.spent / budget.monthly_limit) * 100, 100)}%` }}
                    />
                  </div>
                  {budget.spent > budget.monthly_limit && (
                    <p className="text-[11px] text-danger mt-1">Excediste tu meta por {formatCLP(budget.spent - budget.monthly_limit)}</p>
                  )}
                </>
              )}
              {editingBudget && (
                <div className="mt-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      placeholder="Ej: 50000"
                      className="flex-1 bg-surface rounded-xl px-3 py-2.5 text-[16px] text-text border border-surface-tertiary focus:outline-none focus:border-primary"
                    />
                    <button onClick={saveBudget} className="px-4 py-2.5 bg-primary text-white rounded-xl text-[14px] font-semibold">OK</button>
                    <button onClick={() => setEditingBudget(false)} className="px-3 py-2.5 bg-surface-secondary text-text-tertiary rounded-xl text-[14px]">X</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={handleToggleTrip}
            className="w-full py-[16px] rounded-2xl font-semibold text-[17px] text-white bg-primary active:bg-primary-dark transition-all shadow-sm mb-3"
          >
            Comenzar viaje
          </button>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              ['📍', 'Iniciar viaje'],
              ['📡', 'GPS detecta'],
              ['🔔', 'Suena alerta'],
              ['✅', 'Ver resumen'],
            ].map(([icon, label], i) => (
              <div key={i} className="bg-surface-secondary rounded-xl py-2.5 px-1 text-center">
                <span className="text-[18px]">{icon}</span>
                <p className="text-[10px] text-text-secondary mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-text-tertiary text-center pb-1">
            Mantén Safari abierto durante el viaje &middot; Tarifa {tarifaLabel.toLowerCase()}
          </p>
        </div>
      </div>
    );
  }

  // ─── PANTALLA DURANTE / DESPUÉS DEL VIAJE ───
  return (
    <div className="flex flex-col gap-3 p-5 pb-2" style={{ minHeight: 'calc(100vh - 56px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 52px)' }}>
      {/* Hero total */}
      <div className="bg-primary rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-white/70">
            {trip.isActive ? 'Viaje en curso' : 'Viaje terminado'}
          </span>
          <div className="flex items-center gap-2">
            {gps.isTracking && gps.position && (
              <span className="text-[13px] text-white/50">{Math.round(gps.speed || 0)} km/h</span>
            )}
            {trip.isActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                GPS
              </span>
            )}
          </div>
        </div>
        <p className="text-[40px] font-bold tracking-tight leading-none">{formatCLP(trip.totalCost)}</p>
        <p className="text-[13px] text-white/60 mt-1.5">
          {trip.tollCount === 0
            ? 'Esperando peajes...'
            : `${trip.tollCount} peaje${trip.tollCount > 1 ? 's' : ''}`}
          {' '}&middot; {tarifaLabel}
        </p>
      </div>

      {/* Aviso compacto */}
      {trip.isActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-[14px]">⚠️</span>
          <p className="text-[12px] text-yellow-800"><strong>No cierres esta pantalla</strong> — los peajes no se detectarán</p>
        </div>
      )}

      {/* Error GPS */}
      {gps.error && (
        <div className="bg-danger/10 rounded-xl px-4 py-2.5">
          <p className="text-[13px] font-medium text-danger">{gps.error}</p>
        </div>
      )}

      {/* Esperando peajes */}
      {trip.isActive && trip.crossings.length === 0 && (
        <div className="text-center py-6 flex-1 flex flex-col items-center justify-center">
          <div className="w-9 h-9 mx-auto border-[3px] border-surface-tertiary border-t-primary rounded-full animate-spin" />
          <p className="text-[14px] text-text mt-3">Conduciendo...</p>
          <p className="text-[12px] text-text-tertiary mt-0.5">Suena una alerta en cada peaje</p>
        </div>
      )}

      {/* Peajes cruzados */}
      {trip.crossings.length > 0 && (
        <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <h2 className="text-[12px] font-semibold text-text-secondary px-1 uppercase tracking-wide">Peajes</h2>
          {[...trip.crossings].reverse().map((crossing) => (
            <TollChip key={`${crossing.toll.id}-${crossing.timestamp}`} crossing={crossing} />
          ))}
        </div>
      )}

      {/* Ida y vuelta */}
      {!trip.isActive && trip.crossings.length > 0 && (
        <div className="bg-surface-secondary rounded-xl px-4 py-3">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-secondary">Ida y vuelta (est.)</span>
            <span className="text-[16px] font-bold text-text">{formatCLP(trip.totalCost * 2)}</span>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="mt-auto pt-2">
        {trip.isActive ? (
          <button
            onClick={() => {
              if (window.confirm('¿Seguro que quieres detener el viaje?')) handleToggleTrip();
            }}
            className="w-full py-[14px] rounded-2xl font-semibold text-[16px] bg-danger text-white active:opacity-80 transition-all"
          >
            Detener viaje
          </button>
        ) : (
          <div className="flex gap-2">
            {trip.crossings.length > 0 && (
              <button
                onClick={handleResumeTrip}
                className="flex-1 py-[14px] rounded-2xl font-semibold text-[15px] bg-primary text-white active:opacity-80 transition-all"
              >
                Reanudar
              </button>
            )}
            <button
              onClick={handleToggleTrip}
              className={`${trip.crossings.length > 0 ? 'flex-1' : 'w-full'} py-[14px] rounded-2xl font-semibold text-[15px] bg-surface-secondary text-text-secondary active:opacity-80 transition-all`}
            >
              Nuevo viaje
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
