import { useState, useEffect, useRef, useMemo } from 'react';
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
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('admin_theme') !== 'light'; } catch { return true; }
  });
  const [liveTrips, setLiveTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [allCrossings, setAllCrossings] = useState([]);
  const [liveCrossingsByTrip, setLiveCrossingsByTrip] = useState({});
  const [expandedLiveTrip, setExpandedLiveTrip] = useState(null);
  const [users, setUsers] = useState([]);
  const [tripCrossings, setTripCrossings] = useState([]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem('admin_theme', next ? 'dark' : 'light'); } catch {}
  };

  const bg = dark ? 'bg-[#111]' : 'bg-white';
  const text = dark ? 'text-white' : 'text-[#212529]';
  const textSec = dark ? 'text-[#6C757D]' : 'text-[#6C757D]';
  const card = dark ? 'bg-white/5' : 'bg-[#F8F9FA]';
  const border = dark ? 'border-white/10' : 'border-[#E9ECEF]';
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [stats, setStats] = useState(null);

  async function loadData() {
    const [live, all, completed, crossings, usersData] = await Promise.all([
      supabase.from('live_trips').select('*').eq('is_active', true).order('updated_at', { ascending: false }),
      supabase.from('live_trips').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('live_crossings').select('*').order('crossed_at', { ascending: false }).limit(100),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
    ]);
    setLiveTrips(live.data || []);
    setAllTrips(all.data || []);
    setCompletedTrips(completed.data || []);
    setAllCrossings(crossings.data || []);
    setUsers(usersData.data || []);

    // Crossings por viaje activo
    const cxByTrip = {};
    for (const c of (crossings.data || [])) {
      if (!cxByTrip[c.trip_id]) cxByTrip[c.trip_id] = [];
      cxByTrip[c.trip_id].push(c);
    }
    // Ordenar cada grupo por fecha ascendente
    for (const id in cxByTrip) {
      cxByTrip[id].sort((a, b) => new Date(a.crossed_at) - new Date(b.crossed_at));
    }
    setLiveCrossingsByTrip(cxByTrip);

    // Stats combinados
    const cTrips = completed.data || [];
    const drivers = [...new Set(cTrips.map(t => t.driver))];
    const totalCost = cTrips.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalTolls = cTrips.reduce((s, t) => s + (t.toll_count || 0), 0);
    // Incluir viajes activos en los totales
    const liveData = live.data || [];
    const allCombined = [...cTrips, ...liveData.map(l => ({ driver: l.driver, total_cost: l.total_cost || 0, toll_count: l.toll_count || 0 }))];

    const totalCostAll = allCombined.reduce((s, t) => s + (t.total_cost || 0), 0);
    const totalTollsAll = allCombined.reduce((s, t) => s + (t.toll_count || 0), 0);
    const avgCostPerTrip = allCombined.length > 0 ? Math.round(totalCostAll / allCombined.length) : 0;
    const avgTollsPerTrip = allCombined.length > 0 ? (totalTollsAll / allCombined.length).toFixed(1) : 0;

    const tripsByDriver = {};
    const costByDriver = {};
    const allDrivers = new Set();
    for (const t of allCombined) {
      allDrivers.add(t.driver);
      tripsByDriver[t.driver] = (tripsByDriver[t.driver] || 0) + 1;
      costByDriver[t.driver] = (costByDriver[t.driver] || 0) + (t.total_cost || 0);
    }

    setStats({
      totalTrips: allCombined.length,
      activeTrips: liveData.length,
      registeredUsers: (usersData.data || []).length,
      drivers: allDrivers.size,
      driverList: [...allDrivers],
      totalCost: totalCostAll,
      totalTolls: totalTollsAll,
      avgCostPerTrip,
      avgTollsPerTrip,
      tripsByDriver,
      costByDriver,
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

  const [mapsReady, setMapsReady] = useState(!!window.google?.maps);
  const [locations, setLocations] = useState({}); // { tripId: 'Cerca de Lo Prado' }

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) { setMapsReady(true); return; }
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps) { setMapsReady(true); clearInterval(check); }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map — retry until mapRef and google are ready
  useEffect(() => {
    if (!mapsReady || mapInstanceRef.current) return;
    const tryInit = () => {
      if (!mapRef.current) return;
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: { lat: -33.42, lng: -70.65 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
    };
    tryInit();
    // Retry si el ref no estaba listo
    if (!mapInstanceRef.current) {
      const retry = setTimeout(tryInit, 500);
      return () => clearTimeout(retry);
    }
  }, [mapsReady, tab]);

  // Reverse geocode para ubicación aproximada
  useEffect(() => {
    if (!mapsReady || !window.google?.maps?.Geocoder) return;
    const geocoder = new google.maps.Geocoder();
    for (const trip of liveTrips) {
      if (!trip.lat || !trip.lng || locations[trip.id]) continue;
      geocoder.geocode({ location: { lat: trip.lat, lng: trip.lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const parts = results[0].address_components;
          const locality = parts.find(p => p.types.includes('locality'))?.long_name;
          const route = parts.find(p => p.types.includes('route'))?.long_name;
          const sublocality = parts.find(p => p.types.includes('sublocality'))?.long_name;
          const label = route || sublocality || locality || results[0].formatted_address.split(',')[0];
          setLocations(prev => ({ ...prev, [trip.id]: label }));
        }
      });
    }
  }, [liveTrips, mapsReady]);

  // Actualizar reverse geocode cada 30s
  useEffect(() => {
    const interval = setInterval(() => setLocations({}), 30000);
    return () => clearInterval(interval);
  }, []);

  // Update map markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    for (const trip of liveTrips) {
      if (!trip.lat || !trip.lng) continue;
      const marker = new google.maps.Marker({
        position: { lat: trip.lat, lng: trip.lng },
        map: mapInstanceRef.current,
        title: trip.driver,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#5C6B5A',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        label: { text: trip.driver?.charAt(0)?.toUpperCase() || '?', color: '#fff', fontWeight: 'bold', fontSize: '12px' },
      });
      markersRef.current.push(marker);
    }

    if (liveTrips.length === 1 && liveTrips[0].lat) {
      mapInstanceRef.current.panTo({ lat: liveTrips[0].lat, lng: liveTrips[0].lng });
      mapInstanceRef.current.setZoom(13);
    } else if (liveTrips.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      liveTrips.forEach(t => { if (t.lat && t.lng) bounds.extend({ lat: t.lat, lng: t.lng }); });
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [liveTrips, mapsReady]);

  // Calcular datos de growth por día
  const growthData = useMemo(() => {
    const days = {};
    // Usuarios por día
    for (const u of users) {
      const day = new Date(u.created_at).toLocaleDateString('es-CL');
      if (!days[day]) days[day] = { date: day, newUsers: 0, trips: 0, revenue: 0, tolls: 0 };
      days[day].newUsers++;
    }
    // Viajes por día
    for (const t of completedTrips) {
      const day = new Date(t.start_time).toLocaleDateString('es-CL');
      if (!days[day]) days[day] = { date: day, newUsers: 0, trips: 0, revenue: 0, tolls: 0 };
      days[day].trips++;
      days[day].revenue += t.total_cost || 0;
      days[day].tolls += t.toll_count || 0;
    }
    return Object.values(days).sort((a, b) => {
      const da = a.date.split('-').reverse().join('-');
      const db = b.date.split('-').reverse().join('-');
      return da.localeCompare(db);
    });
  }, [users, completedTrips]);

  const tabs = [
    { id: 'live', label: 'En vivo' },
    { id: 'trips', label: 'Viajes' },
    { id: 'growth', label: 'Growth' },
    { id: 'users', label: 'Usuarios' },
    { id: 'data', label: 'Datos' },
  ];

  return (
    <div className="min-h-screen transition-colors" style={{
      background: dark ? '#111' : '#FFFFFF',
      color: dark ? '#F0F0F0' : '#212529',
      '--admin-card': dark ? 'rgba(255,255,255,0.05)' : '#F8F9FA',
      '--admin-border': dark ? 'rgba(255,255,255,0.1)' : '#E9ECEF',
      '--admin-text-sec': dark ? '#6C757D' : '#6C757D',
    }}>
      {/* Header */}
      <div className={`${bg} border-b ${border} px-4 py-3 flex items-center justify-between sticky top-0 z-50`}>
        <span className="font-bold text-sm">Admin</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${tab === t.id ? 'bg-primary text-white' : textSec}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={toggleTheme} className={`p-1.5 rounded-lg ${card}`}>
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Usuarios', value: stats.registeredUsers },
              { label: 'Viajes', value: stats.totalTrips },
              { label: 'Activos', value: stats.activeTrips },
              { label: 'Total', value: formatCLP(stats.totalCost) },
            ].map(s => (
              <div key={s.label} className="bg-cream/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-tierra">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB: En vivo — estilo Uber */}
        {tab === 'live' && (
          <div className="flex flex-col gap-0 -mx-4 -mt-4">
            {/* Mapa grande */}
            <div className="relative">
              <div ref={mapRef} className="w-full h-[50vh] bg-cream/5" />
              {!mapsReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-negro/50">
                  <div className="w-8 h-8 border-4 border-cream/20 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {liveTrips.length === 0 && mapsReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-negro/60">
                  <div className="text-center">
                    <p className="text-cream font-medium">Sin viajes activos</p>
                    <p className="text-tierra text-xs mt-1">Los viajes aparecerán aquí en tiempo real</p>
                  </div>
                </div>
              )}
              {/* Badge de cantidad activa */}
              {liveTrips.length > 0 && (
                <div className="absolute top-3 left-3 bg-negro/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-xs text-cream font-medium">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1.5" />
                    {liveTrips.length} en ruta
                  </span>
                </div>
              )}
            </div>

            {/* Cards de viajes activos — overlay */}
            <div className="px-4 -mt-6 relative z-10 flex flex-col gap-3">
              {liveTrips.map(t => {
                const ago = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 1000);
                const isRecent = ago < 30;
                const isExpanded = expandedLiveTrip === t.id;
                const tripCx = liveCrossingsByTrip[t.id] || [];
                return (
                  <div
                    key={t.id}
                    className="bg-cream/10 backdrop-blur-md rounded-2xl border border-cream/10 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedLiveTrip(isExpanded ? null : t.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-cream font-bold">{t.driver?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-bold text-cream">{t.driver}</p>
                            <p className="text-xs text-tierra flex items-center gap-1">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRecent ? 'bg-green-400' : 'bg-yellow-400'}`} />
                              {isRecent ? 'En vivo' : `Hace ${ago}s`}
                              &middot; {Math.round(t.speed || 0)} km/h
                              {locations[t.id] && <> &middot; {locations[t.id]}</>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{formatCLP(t.total_cost || 0)}</p>
                          <p className="text-xs text-tierra">{t.toll_count || 0} peajes ▾</p>
                        </div>
                      </div>
                    </button>

                    {/* Acordeón: peajes del viaje */}
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="border-t border-cream/10 pt-3 flex flex-col gap-2">
                          {tripCx.length === 0 ? (
                            <p className="text-xs text-tierra text-center">Sin peajes aún</p>
                          ) : (
                            tripCx.map((c, i) => (
                              <div key={c.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center text-[10px] text-primary font-bold">{i + 1}</span>
                                  <div>
                                    <span className="text-cream">{c.toll_nombre}</span>
                                    <span className="text-tierra ml-1">{formatTime(c.crossed_at)}</span>
                                  </div>
                                </div>
                                <span className="text-primary font-medium">{formatCLP(c.tarifa)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

        {/* TAB: Growth — una sola pantalla, compacto */}
        {tab === 'growth' && (
          <div className="flex flex-col gap-3">
            {/* Hero KPIs — 1 fila */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: stats?.registeredUsers || 0, l: 'Usuarios' },
                { v: stats?.totalTrips || 0, l: 'Viajes' },
                { v: stats?.totalTolls || 0, l: 'Peajes' },
                { v: stats?.activeTrips || 0, l: 'Activos', green: true },
              ].map(k => (
                <div key={k.l} className="bg-cream/5 rounded-lg p-2 text-center">
                  <p className={`text-xl font-bold ${k.green ? 'text-green-400' : ''}`}>{k.v}</p>
                  <p className="text-[10px] text-tierra">{k.l}</p>
                </div>
              ))}
            </div>

            {/* Revenue */}
            <div className="bg-cream/5 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-tierra">Recaudación total</p>
                <p className="text-2xl font-bold text-primary">{formatCLP(stats?.totalCost || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-tierra">Promedio/viaje</p>
                <p className="text-lg font-bold">{formatCLP(stats?.avgCostPerTrip || 0)}</p>
              </div>
            </div>

            {/* Sparkline por día — barras verticales */}
            <div className="bg-cream/5 rounded-lg p-3">
              <p className="text-[10px] text-tierra mb-2">Revenue por día</p>
              {growthData.length === 0 ? (
                <p className="text-tierra text-xs text-center py-2">Sin datos</p>
              ) : (
                <div className="flex items-end gap-1 h-20">
                  {growthData.map((day) => {
                    const max = Math.max(...growthData.map(d => d.revenue), 1);
                    const h = Math.max((day.revenue / max) * 100, 4);
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-primary rounded-sm" style={{ height: `${h}%` }} title={`${day.date}: ${formatCLP(day.revenue)}`} />
                        <span className="text-[8px] text-tierra leading-none">{day.date.split('/')[0]}/{day.date.split('/')[1]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Usuarios + viajes por día — tabla compacta */}
            <div className="bg-cream/5 rounded-lg p-3">
              <p className="text-[10px] text-tierra mb-2">Desglose diario</p>
              <div className="grid grid-cols-5 gap-0 text-[10px] text-tierra border-b border-cream/10 pb-1 mb-1">
                <span>Día</span><span className="text-center">Usuarios</span><span className="text-center">Viajes</span><span className="text-center">Peajes</span><span className="text-right">Revenue</span>
              </div>
              {growthData.length === 0 ? (
                <p className="text-tierra text-xs text-center py-2">—</p>
              ) : (
                growthData.map(day => (
                  <div key={day.date} className="grid grid-cols-5 gap-0 text-xs py-1 border-b border-cream/5">
                    <span className="text-tierra">{day.date}</span>
                    <span className="text-center">{day.newUsers > 0 ? <span className="text-green-400">+{day.newUsers}</span> : '—'}</span>
                    <span className="text-center">{day.trips || '—'}</span>
                    <span className="text-center">{day.tolls || '—'}</span>
                    <span className="text-right text-primary font-medium">{day.revenue > 0 ? formatCLP(day.revenue) : '—'}</span>
                  </div>
                ))
              )}
            </div>

            {/* Top usuarios — compact */}
            {stats?.driverList?.length > 0 && (
              <div className="bg-cream/5 rounded-lg p-3">
                <p className="text-[10px] text-tierra mb-2">Por usuario</p>
                {[...stats.driverList]
                  .sort((a, b) => (stats.costByDriver[b] || 0) - (stats.costByDriver[a] || 0))
                  .map((d) => {
                    const max = Math.max(...stats.driverList.map(x => stats.costByDriver[x] || 0), 1);
                    const w = Math.max(((stats.costByDriver[d] || 0) / max) * 100, 4);
                    return (
                      <div key={d} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs w-14 shrink-0 truncate">{d}</span>
                        <div className="flex-1 bg-cream/5 rounded-full h-4">
                          <div className="bg-primary h-4 rounded-full flex items-center px-1.5" style={{ width: `${w}%`, minWidth: 40 }}>
                            <span className="text-[9px] text-cream whitespace-nowrap">{formatCLP(stats.costByDriver[d] || 0)}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-tierra w-8 text-right">{stats.tripsByDriver[d]}v</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB: Usuarios */}
        {tab === 'users' && (
          <div className="flex flex-col gap-4">
            <div className="bg-cream/5 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium">Usuarios registrados ({users.length})</p>
                {users.length >= 10 && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Waitlist pronto</span>
                )}
              </div>
              {users.length === 0 ? (
                <p className="text-tierra text-sm">Sin usuarios registrados aún</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {users.map(u => (
                    <div key={u.name} className="flex justify-between items-center bg-cream/5 rounded-lg px-3 py-2">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-tierra">{formatDate(u.created_at)}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p>{stats?.tripsByDriver?.[u.name] || 0} viajes</p>
                        <p className="text-primary">{formatCLP(stats?.costByDriver?.[u.name] || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Métricas de producto */}
            <div className="bg-cream/5 rounded-xl p-4">
              <p className="text-sm font-medium mb-3">Métricas de producto</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cream/5 rounded-lg p-3">
                  <p className="text-lg font-bold">{formatCLP(stats?.avgCostPerTrip || 0)}</p>
                  <p className="text-xs text-tierra">Promedio por viaje</p>
                </div>
                <div className="bg-cream/5 rounded-lg p-3">
                  <p className="text-lg font-bold">{stats?.avgTollsPerTrip || 0}</p>
                  <p className="text-xs text-tierra">Peajes por viaje</p>
                </div>
                <div className="bg-cream/5 rounded-lg p-3">
                  <p className="text-lg font-bold">{stats?.registeredUsers || 0}</p>
                  <p className="text-xs text-tierra">Usuarios totales</p>
                </div>
                <div className="bg-cream/5 rounded-lg p-3">
                  <p className="text-lg font-bold">{stats?.totalTolls || 0}</p>
                  <p className="text-xs text-tierra">Peajes detectados</p>
                </div>
              </div>
            </div>

            {/* Top conductores */}
            {stats?.driverList?.length > 0 && (
              <div className="bg-cream/5 rounded-xl p-4">
                <p className="text-sm font-medium mb-3">Ranking por gasto</p>
                {[...stats.driverList]
                  .sort((a, b) => (stats.costByDriver[b] || 0) - (stats.costByDriver[a] || 0))
                  .map((d, i) => (
                    <div key={d} className="flex justify-between items-center py-2 border-b border-cream/5 last:border-0">
                      <span className="text-sm">
                        <span className="text-tierra mr-2">#{i + 1}</span>
                        {d}
                      </span>
                      <span className="text-sm">
                        <span className="text-primary font-medium">{formatCLP(stats.costByDriver[d] || 0)}</span>
                        <span className="text-tierra ml-2">({stats.tripsByDriver[d] || 0} viajes)</span>
                      </span>
                    </div>
                  ))}
              </div>
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
