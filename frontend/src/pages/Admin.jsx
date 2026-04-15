import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../lib/format';
import { reconstructAllTrips, reconstructAndUpdateTrip } from '../lib/reconstruction';
import { closeStaleTrips } from '../lib/liveTracking';
import AdminLive from './admin/AdminLive';
import AdminTrips from './admin/AdminTrips';
import AdminGrowth from './admin/AdminGrowth';
import AdminData from './admin/AdminData';

const ADMIN_PIN = '2026';

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('live');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-text flex items-center justify-center p-4">
        <div className="bg-white/5 rounded-2xl p-8 max-w-xs w-full text-center">
          <p className="text-lg font-bold text-white mb-1">TAGcontrol Admin</p>
          <p className="text-sm text-gray-400 mb-6">Ingresa el PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && pin === ADMIN_PIN) setAuthenticated(true); }}
            className="w-full text-center text-3xl tracking-[0.5em] bg-white/5 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="****"
            autoFocus
          />
          <button
            onClick={() => { if (pin === ADMIN_PIN) setAuthenticated(true); }}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-text active:bg-text/80"
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
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [stats, setStats] = useState(null);
  const [reconstructing, setReconstructing] = useState(false);
  const [reconstructResults, setReconstructResults] = useState(null);
  const [growthView, setGrowthView] = useState('dia');
  const [mapsReady, setMapsReady] = useState(!!window.google?.maps);
  const [locations, setLocations] = useState({});

  const handleReconstructAll = async () => {
    setReconstructing(true);
    setReconstructResults(null);
    try {
      const results = await reconstructAllTrips();
      setReconstructResults(results);
      if (results.length > 0) loadData();
    } catch (err) {
      setReconstructResults([{ error: err.message }]);
    }
    setReconstructing(false);
  };

  const handleReconstructTrip = async (tripId) => {
    setReconstructing(true);
    try {
      const result = await reconstructAndUpdateTrip(tripId);
      if (result && result.newTolls > 0) {
        setReconstructResults([{
          tripId,
          originalTolls: result.tollCount - result.newTolls,
          newTolls: result.newTolls,
          totalTolls: result.tollCount,
          newCost: result.totalCost,
        }]);
        loadData();
      } else {
        setReconstructResults([{ tripId, newTolls: 0 }]);
      }
    } catch (err) {
      setReconstructResults([{ error: err.message }]);
    }
    setReconstructing(false);
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem('admin_theme', next ? 'dark' : 'light'); } catch {}
  };

  const bg = dark ? 'bg-[#111]' : 'bg-white';
  const textSec = dark ? 'text-[#6C757D]' : 'text-[#6C757D]';
  const card = dark ? 'bg-white/5' : 'bg-[#F8F9FA]';
  const border = dark ? 'border-white/10' : 'border-[#E9ECEF]';

  async function loadData() {
    await closeStaleTrips(30 * 60 * 1000).catch(() => {});
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

    const cxByTrip = {};
    for (const c of (crossings.data || [])) {
      if (!cxByTrip[c.trip_id]) cxByTrip[c.trip_id] = [];
      cxByTrip[c.trip_id].push(c);
    }
    for (const id in cxByTrip) {
      cxByTrip[id].sort((a, b) => new Date(a.crossed_at) - new Date(b.crossed_at));
    }
    setLiveCrossingsByTrip(cxByTrip);

    const cTrips = completed.data || [];
    const liveData = live.data || [];
    const allCombined = [...cTrips, ...liveData.map(l => ({ driver: l.driver, total_cost: l.total_cost || 0, toll_count: l.toll_count || 0, platform: l.platform }))];

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

    const normPlat = p => p === 'ios' ? 'ios' : p === 'android' ? 'android' : p === 'web' ? 'web' : 'unknown';
    const tripsByPlatform = { ios: 0, android: 0, web: 0, unknown: 0 };
    const platformByDriver = {};
    for (const t of [...cTrips, ...liveData]) {
      const p = normPlat(t.platform);
      tripsByPlatform[p]++;
      const d = t.driver;
      if (!platformByDriver[d]) platformByDriver[d] = { ios: 0, android: 0, web: 0, unknown: 0 };
      platformByDriver[d][p]++;
    }
    const usersByPlatform = { ios: 0, android: 0, web: 0, unknown: 0 };
    for (const d of allDrivers) {
      const pd = platformByDriver[d] || { unknown: 1 };
      const dominant = Object.entries(pd).sort((a, b) => b[1] - a[1])[0][0];
      usersByPlatform[dominant]++;
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
      tripsByPlatform,
      usersByPlatform,
      platformByDriver,
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

  // Google Maps — script + init + markers + geocoding
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
    if (!mapInstanceRef.current) {
      const retry = setTimeout(tryInit, 500);
      return () => clearTimeout(retry);
    }
  }, [mapsReady, tab]);

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

  useEffect(() => {
    const interval = setInterval(() => setLocations({}), 30000);
    return () => clearInterval(interval);
  }, []);

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

  const growthData = useMemo(() => {
    const days = {};
    const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const toLabel = (d) => d.toLocaleDateString('es-CL');
    for (const u of users) {
      const d = new Date(u.created_at);
      const key = toKey(d);
      if (!days[key]) days[key] = { date: toLabel(d), sortKey: key, newUsers: 0, trips: 0, gasto: 0, tolls: 0 };
      days[key].newUsers++;
    }
    const allTripsForGrowth = [
      ...completedTrips.map(t => ({ time: t.start_time, cost: t.total_cost || 0, tolls: t.toll_count || 0 })),
      ...liveTrips.map(t => ({ time: t.created_at, cost: t.total_cost || 0, tolls: t.toll_count || 0 })),
    ];
    for (const t of allTripsForGrowth) {
      const d = new Date(t.time);
      const key = toKey(d);
      if (!days[key]) days[key] = { date: toLabel(d), sortKey: key, newUsers: 0, trips: 0, gasto: 0, tolls: 0 };
      days[key].trips++;
      days[key].gasto += t.cost;
      days[key].tolls += t.tolls;
    }
    return Object.values(days).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [users, completedTrips, liveTrips]);

  const cumulativeData = useMemo(() => {
    let cumUsers = 0, cumTrips = 0, cumGasto = 0, cumTolls = 0;
    return growthData.map((day, i) => {
      cumUsers += day.newUsers;
      cumTrips += day.trips;
      cumGasto += day.gasto;
      cumTolls += day.tolls;
      const prev = i > 0 ? growthData[i - 1] : null;
      const growthRate = prev && prev.gasto > 0 ? Math.round(((day.gasto - prev.gasto) / prev.gasto) * 100) : null;
      return { ...day, cumUsers, cumTrips, cumGasto, cumTolls, growthRate };
    });
  }, [growthData]);

  const tabs = [
    { id: 'live', label: 'En vivo' },
    { id: 'growth', label: 'Growth' },
    { id: 'trips', label: 'Viajes' },
    { id: 'data', label: 'DB' },
  ];

  return (
    <div className="min-h-screen transition-colors" style={{
      background: dark ? '#111' : '#FFFFFF',
      color: dark ? '#F0F0F0' : '#212529',
      '--admin-card': dark ? 'rgba(255,255,255,0.05)' : '#F8F9FA',
      '--admin-border': dark ? 'rgba(255,255,255,0.1)' : '#E9ECEF',
      '--admin-text-sec': dark ? '#6C757D' : '#6C757D',
    }}>
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
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Usuarios', value: stats.registeredUsers },
              { label: 'Viajes', value: stats.totalTrips },
              { label: 'Activos', value: stats.activeTrips },
              { label: 'Total', value: formatCLP(stats.totalCost) },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'live' && (
          <AdminLive
            mapRef={mapRef}
            mapsReady={mapsReady}
            liveTrips={liveTrips}
            liveCrossingsByTrip={liveCrossingsByTrip}
            expandedLiveTrip={expandedLiveTrip}
            setExpandedLiveTrip={setExpandedLiveTrip}
            locations={locations}
          />
        )}

        {tab === 'trips' && (
          <AdminTrips
            completedTrips={completedTrips}
            selectedTripId={selectedTripId}
            setSelectedTripId={setSelectedTripId}
            reconstructing={reconstructing}
            reconstructResults={reconstructResults}
            onReconstructAll={handleReconstructAll}
            onReconstructTrip={handleReconstructTrip}
          />
        )}

        {tab === 'growth' && (
          <AdminGrowth
            stats={stats}
            users={users}
            growthData={growthData}
            cumulativeData={cumulativeData}
            growthView={growthView}
            setGrowthView={setGrowthView}
          />
        )}

        {tab === 'data' && (
          <AdminData
            stats={stats}
            allCrossings={allCrossings}
            allTrips={allTrips}
            completedTrips={completedTrips}
            onReconstructTrip={handleReconstructTrip}
            reconstructing={reconstructing}
            reconstructResults={reconstructResults}
          />
        )}

        <p className="text-center text-[11px] text-gray-600 pt-6 pb-4">
          powered by <a href="https://weareblooming.co" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Blooming</a>
        </p>
      </div>
    </div>
  );
}
