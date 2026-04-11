import { useState, useEffect, useMemo } from 'react';
import { getSavedTrips, clearTrips } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { formatCLP, formatDate, formatTime } from '../lib/format';
import { useUser } from '../App';

const ADMIN_USER = 'Andres';

export default function History() {
  const { user } = useUser();
  const [expandedTrip, setExpandedTrip] = useState(null);
  const isAdmin = user.name === ADMIN_USER;
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [filterDriver, setFilterDriver] = useState('todos');

  useEffect(() => {
    async function load() {
      const local = getSavedTrips();
      let cloud = [];
      try {
        // Admin ve todos, usuarios normales solo los suyos
        let query = supabase.from('trips').select('*').order('created_at', { ascending: false });
        if (!isAdmin) query = query.eq('driver', user.name);
        const { data } = await query;
        cloud = (data || []).map((t) => ({
          id: t.id, driver: t.driver,
          startTime: new Date(t.start_time).getTime(),
          endTime: new Date(t.end_time).getTime(),
          totalCost: t.total_cost, tollCount: t.toll_count,
          routes: t.routes || [], crossings: t.crossings || [],
        }));
      } catch {}
      const cloudIds = new Set(cloud.map((t) => t.id));
      // Local: filtrar por usuario también
      const localFiltered = local.filter((t) => !cloudIds.has(t.id) && (isAdmin || t.driver === user.name));
      const merged = [...cloud, ...localFiltered];
      merged.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setAllTrips(merged);
      setLoading(false);
    }
    load();
  }, [user.name, isAdmin]);

  const driverList = useMemo(() => {
    return [...new Set(allTrips.map(t => t.driver).filter(Boolean))].sort();
  }, [allTrips]);

  const trips = useMemo(() => {
    if (filterDriver === 'todos') return allTrips;
    return allTrips.filter((t) => t.driver === filterDriver);
  }, [allTrips, filterDriver]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = trips.filter((t) => {
      const d = new Date(t.startTime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalGastado = trips.reduce((sum, t) => sum + t.totalCost, 0);
    const totalPeajes = trips.reduce((sum, t) => sum + t.tollCount, 0);
    const gastoMes = thisMonth.reduce((sum, t) => sum + t.totalCost, 0);
    const viajesMes = thisMonth.length;
    const promedioPorViaje = trips.length > 0 ? Math.round(totalGastado / trips.length) : 0;
    return { totalViajes: trips.length, totalGastado, totalPeajes, gastoMes, viajesMes, promedioPorViaje };
  }, [trips]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-surface-tertiary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (allTrips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-8">
        <div className="w-16 h-16 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-[17px] font-semibold text-text">Sin viajes</p>
        <p className="text-[14px] text-text-secondary text-center mt-1">
          Aparecerán aquí al detener un viaje
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5 pb-24">
      <h1 className="text-[22px] font-bold text-text tracking-tight">Historial</h1>

      {/* Filtro — solo admin ve todos los usuarios */}
      {isAdmin && driverList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['todos', ...driverList].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDriver(d)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-[14px] font-medium transition-all min-h-[44px] ${
                filterDriver === d
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-secondary text-text-secondary'
              }`}
            >
              {d === 'todos' ? 'Todos' : d}
            </button>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="bg-primary rounded-3xl p-6 text-white">
        <p className="text-[13px] text-white/60">
          {filterDriver === 'todos' ? 'Total acumulado' : filterDriver}
        </p>
        <p className="text-[38px] font-bold tracking-tight leading-tight mt-1">{formatCLP(stats.totalGastado)}</p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-[20px] font-bold">{stats.totalViajes}</p>
            <p className="text-[13px] text-white/60">viajes</p>
          </div>
          <div>
            <p className="text-[20px] font-bold">{stats.totalPeajes}</p>
            <p className="text-[13px] text-white/60">peajes</p>
          </div>
          <div>
            <p className="text-[20px] font-bold">{formatCLP(stats.promedioPorViaje)}</p>
            <p className="text-[13px] text-white/60">promedio</p>
          </div>
        </div>
      </div>

      {/* Este mes */}
      <div className="bg-surface-secondary rounded-2xl p-4 flex justify-between items-center">
        <div>
          <p className="text-[12px] text-text-tertiary">Este mes</p>
          <p className="text-[20px] font-bold text-text">{formatCLP(stats.gastoMes)}</p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-bold text-text">{stats.viajesMes}</p>
          <p className="text-[12px] text-text-tertiary">viajes</p>
        </div>
      </div>

      {/* Viajes */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide px-1">Recientes</h2>
        {trips.map((trip) => {
          const cx = trip.crossings || [];
          const isOpen = expandedTrip === trip.id;
          const tripName = (trip.routes || []).length > 0
            ? trip.routes.join(' → ')
            : cx.length > 0
              ? `${cx[0].tollNombre} → ${cx[cx.length - 1].tollNombre}`
              : 'Viaje';
          return (
            <button
              key={trip.id}
              onClick={() => setExpandedTrip(isOpen ? null : trip.id)}
              className="bg-surface-secondary rounded-2xl p-4 text-left w-full transition-colors active:bg-surface-tertiary/50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-[15px] font-semibold text-text truncate">{tripName}</p>
                  <p className="text-[13px] text-text-tertiary mt-0.5">
                    {trip.driver && <span className="font-medium text-text-secondary">{trip.driver}</span>}
                    {trip.driver && ' · '}
                    {formatDate(trip.startTime)} · {formatTime(trip.startTime)}
                    {' · '}{cx.length} peajes
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[17px] font-bold text-primary">{formatCLP(trip.totalCost)}</span>
                  <p className="text-[11px] text-text-tertiary">{isOpen ? '▲' : '▼'}</p>
                </div>
              </div>
              {isOpen && cx.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-tertiary flex flex-col gap-2">
                  {cx.map((c, i) => (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span className="text-text-secondary">{c.tollNombre}</span>
                      <span className="text-primary font-medium">{formatCLP(c.tarifa)}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Borrar */}
      <div className="pt-4">
        {!showConfirmClear ? (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="w-full py-3 rounded-xl text-[14px] text-text-tertiary"
          >
            Borrar historial local
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={handleClear} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white bg-danger">
              Confirmar
            </button>
            <button onClick={() => setShowConfirmClear(false)} className="flex-1 py-3 rounded-xl text-[14px] text-text-secondary bg-surface-secondary">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );

  function handleClear() {
    clearTrips();
    // Recargar solo desde Supabase (local se borró)
    setAllTrips((prev) => prev.filter((t) => t.id && !t.id.startsWith('local-')));
    setShowConfirmClear(false);
  }
}
