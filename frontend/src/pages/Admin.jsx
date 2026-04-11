import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCLP, formatTime, formatDate } from '../lib/format';

const ADMIN_PIN = '2026';

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('live');
  const [liveTrips, setLiveTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [allCrossings, setAllCrossings] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Auth
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-negro flex items-center justify-center p-4">
        <div className="bg-cream rounded-2xl p-8 max-w-xs w-full text-center">
          <p className="text-lg font-bold text-negro mb-1">Tag Control Admin</p>
          <p className="text-sm text-tierra mb-6">Ingresa el PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pin === ADMIN_PIN) setAuthenticated(true);
            }}
            className="w-full text-center text-3xl tracking-[0.5em] bg-cream-dark rounded-xl px-4 py-4 text-negro focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="****"
            autoFocus
          />
          <button
            onClick={() => { if (pin === ADMIN_PIN) setAuthenticated(true); }}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-cream bg-negro active:bg-negro/80"
          >
            Entrar
          </button>
          {pin.length === 4 && pin !== ADMIN_PIN && (
            <p className="text-red-500 text-sm mt-2">PIN incorrecto</p>
          )}
        </div>
      </div>
    );
  }

  return <AdminDashboard tab={tab} setTab={setTab} mapRef={mapRef} mapInstanceRef={mapInstanceRef} markersRef={markersRef} />;
}

function AdminDashboard({ tab, setTab, mapRef, mapInstanceRef, markersRef }) {
  const [liveTrips, setLiveTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [allCrossings, setAllCrossings] = useState([]);
  const [tripCrossings, setTripCrossings] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [stats, setStats] = useState(null);

  async function loadData() {
    const [live, all, completed, crossings] = await Promise.all([
      supabase.from('live_trips').select('*').eq('is_active', true).order('updated_at', { ascending: false }),
      supabase.from('live_trips').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('live_crossings').select('*').order('crossed_at', { ascending: false }).limit(100),
    ]);
    setLiveTrips(live.data || []);
    setAllTrips(all.data || []);
    setCompletedTrips(completed.data || []);
    setAllCrossings(crossings.data || []);

    // Stats combinados
    const cTrips = completed.data || [];
    const drivers = [...new Set(cTrips.map(t => t.driver))];
    const totalCost = cTrips.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalTolls = cTrips.reduce((s, t) => s + (t.toll_count || 0), 0);
    setStats({
      totalTrips: cTrips.length,
      activeTrips: (live.data || []).length,
      drivers: drivers.length,
      driverList: drivers,
      totalCost,
      totalTolls,
    });
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    const channel = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_trips' }, loadData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_crossings' }, loadData)
      .subscribe();
    return () => { clearInterval(interval); channel.unsubscribe(); };
  }, []);

  // Load crossings for selected trip
  useEffect(() => {
    if (selectedTripId) {
      supabase.from('live_crossings').select('*').eq('trip_id', selectedTripId).order('crossed_at', { ascending: true })
        .then(({ data }) => setTripCrossings(data || []));
    }
  }, [selectedTripId, allCrossings.length]);

  // Init map
  useEffect(() => {
    if (tab !== 'live' || !mapRef.current || mapInstanceRef.current) return;
    if (!window.google?.maps) return;
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: -33.42, lng: -70.65 },
      zoom: 11,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    });
  }, [tab]);

  // Update map markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    for (const trip of liveTrips) {
      if (trip.lat && trip.lng) {
        const marker = new google.maps.Marker({
          position: { lat: trip.lat, lng: trip.lng },
          map: mapInstanceRef.current,
          title: trip.driver,
          label: { text: trip.driver?.charAt(0) || '?', color: '#fff', fontWeight: 'bold' },
        });
        markersRef.current.push(marker);
      }
    }
    if (liveTrips.length === 1 && liveTrips[0].lat) {
      mapInstanceRef.current.panTo({ lat: liveTrips[0].lat, lng: liveTrips[0].lng });
    }
  }, [liveTrips]);

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const tabs = [
    { id: 'live', label: 'En vivo' },
    { id: 'trips', label: 'Viajes' },
    { id: 'data', label: 'Datos' },
  ];

  return (
    <div className="min-h-screen bg-negro text-cream">
      {/* Header */}
      <div className="bg-negro border-b border-cream/10 px-4 py-3 flex items-center justify-between">
        <span className="font-bold">Admin — Tag Control</span>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${tab === t.id ? 'bg-primary text-cream' : 'text-tierra'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Viajes', value: stats.totalTrips },
              { label: 'Activos', value: stats.activeTrips },
              { label: 'Usuarios', value: stats.drivers },
              { label: 'Total', value: formatCLP(stats.totalCost) },
            ].map(s => (
              <div key={s.label} className="bg-cream/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-tierra">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB: En vivo */}
        {tab === 'live' && (
          <div className="flex flex-col gap-4">
            <div ref={mapRef} className="w-full h-64 rounded-xl bg-cream/5" />

            {liveTrips.length === 0 ? (
              <p className="text-center text-tierra text-sm py-4">Sin viajes activos</p>
            ) : (
              liveTrips.map(t => {
                const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 1000);
                return (
                  <div key={t.id} className="bg-cream/5 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{t.driver}</p>
                        <p className="text-xs text-tierra">
                          {t.lat?.toFixed(4)}, {t.lng?.toFixed(4)} &middot; {Math.round(t.speed || 0)} km/h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCLP(t.total_cost || 0)}</p>
                        <p className="text-xs text-tierra">
                          {t.toll_count || 0} peajes &middot;
                          <span className={ago < 30 ? ' text-green-400' : ' text-yellow-400'}> {ago}s</span>
                        </p>
                      </div>
                    </div>
                    {t.last_toll && <p className="text-xs text-hongo mt-1">Último: {t.last_toll}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: Viajes (completados en Supabase) */}
        {tab === 'trips' && (
          <div className="flex flex-col gap-2">
            {completedTrips.length === 0 && (
              <p className="text-center text-tierra text-sm py-4">
                Los viajes aparecerán aquí cuando alguien presione "Detener viaje" (versión nueva)
              </p>
            )}
            {completedTrips.map(t => {
              const cx = t.crossings || [];
              const isOpen = selectedTripId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTripId(isOpen ? null : t.id)}
                  className={`text-left rounded-xl p-4 transition-colors ${isOpen ? 'bg-primary/20' : 'bg-cream/5'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{t.driver}</p>
                      <p className="text-xs text-tierra mt-0.5">
                        {formatDate(t.start_time)} &middot; {formatTime(t.start_time)} – {formatTime(t.end_time)}
                      </p>
                      <p className="text-xs text-tierra mt-0.5">
                        {(t.routes || []).join(' → ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-sm">{formatCLP(t.total_cost || 0)}</p>
                      <p className="text-xs text-tierra">{t.toll_count || 0} peajes</p>
                    </div>
                  </div>
                  {isOpen && cx.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {cx.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs bg-cream/5 rounded-lg px-3 py-2">
                          <span>
                            {c.tollNombre} <span className="text-tierra">({c.tollRuta})</span>
                            <span className="text-tierra ml-1">{formatTime(c.timestamp)}</span>
                          </span>
                          <span className="text-primary font-medium">{formatCLP(c.tarifa)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

            {/* Live trips section */}
            {allTrips.length > 0 && (
              <>
                <p className="text-xs text-tierra mt-4 mb-1 font-medium">Viajes en vivo (live_trips)</p>
                {allTrips.map(t => (
                  <div key={t.id} className="bg-cream/5 rounded-xl p-3 text-xs">
                    <div className="flex justify-between">
                      <span>{t.driver} <span className={t.is_active ? 'text-green-400' : 'text-tierra'}>{t.is_active ? 'ACTIVO' : 'fin'}</span></span>
                      <span className="text-primary">{formatCLP(t.total_cost || 0)} &middot; {t.toll_count || 0} peajes</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB: Datos crudos */}
        {tab === 'data' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-tierra mb-2 font-medium">Usuarios registrados</p>
              <div className="flex flex-wrap gap-2">
                {stats?.driverList.map(d => (
                  <span key={d} className="bg-cream/10 px-3 py-1 rounded-full text-xs">{d}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-tierra mb-2 font-medium">Últimos 20 cruces de peajes</p>
              <div className="bg-cream/5 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cream/10 text-tierra">
                      <th className="px-3 py-2 text-left">Peaje</th>
                      <th className="px-3 py-2 text-left">Ruta</th>
                      <th className="px-3 py-2 text-right">Tarifa</th>
                      <th className="px-3 py-2 text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCrossings.slice(0, 20).map(c => (
                      <tr key={c.id} className="border-b border-cream/5">
                        <td className="px-3 py-2">{c.toll_nombre}</td>
                        <td className="px-3 py-2 text-tierra">{c.toll_ruta}</td>
                        <td className="px-3 py-2 text-right text-primary">{formatCLP(c.tarifa)}</td>
                        <td className="px-3 py-2 text-right text-tierra">{formatTime(c.crossed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-xs text-tierra mb-2 font-medium">Base de datos</p>
              <div className="bg-cream/5 rounded-xl p-3 text-xs text-tierra">
                <p>live_trips: {allTrips.length} registros</p>
                <p>live_crossings: {allCrossings.length} registros</p>
                <p>Supabase: nttnryildsxllxqfkkvz</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
