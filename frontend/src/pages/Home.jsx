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
    }, 10000);
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
      <div className="flex flex-col gap-5 p-5 pb-24">
        <div className="text-center pt-8 pb-4">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold text-text tracking-tight">Registra tus peajes</h1>
          <p className="text-[15px] text-text-secondary mt-1">
            Detecta automáticamente cada peaje que cruzas
          </p>
        </div>

        {/* Meta de gasto mensual */}
        {budget && (
          <div className="bg-surface-secondary rounded-2xl p-5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">Este mes</p>
              <button
                onClick={() => { setEditingBudget(!editingBudget); setBudgetInput(budget.monthly_limit > 0 ? String(budget.monthly_limit) : ''); }}
                className="text-[12px] text-primary font-medium"
              >
                {budget.monthly_limit > 0 ? 'Editar meta' : 'Fijar meta'}
              </button>
            </div>
            <p className="text-[28px] font-bold text-text tracking-tight">{formatCLP(budget.spent)}</p>
            {budget.monthly_limit > 0 && (
              <>
                <div className="flex justify-between text-[12px] text-text-tertiary mt-2 mb-1">
                  <span>{Math.round((budget.spent / budget.monthly_limit) * 100)}% usado</span>
                  <span>Meta: {formatCLP(budget.monthly_limit)}</span>
                </div>
                <div className="w-full bg-surface-tertiary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${budget.spent > budget.monthly_limit ? 'bg-danger' : budget.spent > budget.monthly_limit * 0.8 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min((budget.spent / budget.monthly_limit) * 100, 100)}%` }}
                  />
                </div>
                {budget.spent > budget.monthly_limit && (
                  <p className="text-[12px] text-danger mt-1">Excediste tu meta por {formatCLP(budget.spent - budget.monthly_limit)}</p>
                )}
              </>
            )}
            {editingBudget && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="Ej: 50000"
                  className="flex-1 bg-surface rounded-xl px-3 py-2 text-[15px] text-text border border-surface-tertiary focus:outline-none focus:border-primary"
                />
                <button onClick={saveBudget} className="px-4 py-2 bg-primary text-white rounded-xl text-[14px] font-semibold">OK</button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleToggleTrip}
          className="w-full py-[18px] rounded-2xl font-semibold text-[17px] text-white bg-primary active:bg-primary-dark transition-all shadow-sm"
        >
          Comenzar viaje
        </button>

        <div className="bg-surface-secondary rounded-2xl p-5">
          <p className="text-[15px] font-semibold text-text mb-4">¿Cómo funciona?</p>
          <div className="flex flex-col gap-4">
            {[
              ['Comenzar viaje', 'Presiona el botón antes de salir'],
              ['Permiso GPS', 'Acepta la ubicación si te lo pide'],
              ['Alerta sonora', 'Suena cada vez que cruzas un peaje'],
              ['Detener viaje', 'Al llegar, para ver el resumen'],
            ].map(([title, desc], i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[12px] font-bold text-primary">{i + 1}</span>
                </span>
                <div>
                  <p className="text-[14px] font-medium text-text">{title}</p>
                  <p className="text-[13px] text-text-secondary">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-text-tertiary text-center">
          Mantén Safari abierto durante el viaje &middot; Tarifa {tarifaLabel.toLowerCase()}
        </p>
      </div>
    );
  }

  // ─── PANTALLA DURANTE / DESPUÉS DEL VIAJE ───
  return (
    <div className="flex flex-col gap-4 p-5 pb-24">
      {/* Hero total */}
      <div className="bg-primary rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-white/70">
            {trip.isActive ? 'Viaje en curso' : 'Viaje terminado'}
          </span>
          {trip.isActive && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              GPS
            </span>
          )}
        </div>
        <p className="text-[44px] font-bold tracking-tight leading-none">{formatCLP(trip.totalCost)}</p>
        <p className="text-[14px] text-white/60 mt-2">
          {trip.tollCount === 0
            ? 'Esperando peajes...'
            : `${trip.tollCount} peaje${trip.tollCount > 1 ? 's' : ''}`}
          {' '}&middot; Tarifa {tarifaLabel.toLowerCase()}
        </p>
      </div>

      {/* Botones */}
      {trip.isActive ? (
        <button
          onClick={() => {
            if (window.confirm('¿Seguro que quieres detener el viaje?')) handleToggleTrip();
          }}
          className="w-full py-[16px] rounded-2xl font-semibold text-[17px] bg-danger text-white active:opacity-80 transition-all"
        >
          Detener viaje
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {trip.crossings.length > 0 && (
            <button
              onClick={handleResumeTrip}
              className="w-full py-[16px] rounded-2xl font-semibold text-[17px] bg-primary text-white active:opacity-80 transition-all"
            >
              Reanudar viaje
            </button>
          )}
          <button
            onClick={handleToggleTrip}
            className="w-full py-[14px] rounded-2xl font-semibold text-[15px] bg-surface-secondary text-text-secondary active:opacity-80 transition-all"
          >
            Nuevo viaje
          </button>
        </div>
      )}

      {/* Aviso prominente */}
      {trip.isActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-[20px] mt-0.5">⚠️</span>
          <div>
            <p className="text-[14px] font-semibold text-yellow-800">No cierres esta pantalla</p>
            <p className="text-[13px] text-yellow-700 mt-0.5">Si cambias de app o bloqueas el celular, los peajes no se detectarán</p>
          </div>
        </div>
      )}

      {/* Error GPS */}
      {gps.error && (
        <div className="bg-danger/10 rounded-2xl p-4">
          <p className="text-[14px] font-medium text-danger">Problema con el GPS</p>
          <p className="text-[13px] text-danger/80 mt-0.5">{gps.error}</p>
        </div>
      )}

      {/* Velocidad (sin coordenadas crudas) */}
      {gps.isTracking && gps.position && (
        <div className="flex justify-center px-1">
          <span className="text-[14px] text-text-tertiary">{Math.round(gps.speed || 0)} km/h</span>
        </div>
      )}

      {/* Spinner */}
      {trip.isActive && trip.crossings.length === 0 && (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto border-[3px] border-surface-tertiary border-t-primary rounded-full animate-spin" />
          <p className="text-[14px] text-text mt-4">Buscando peajes...</p>
          <p className="text-[12px] text-text-tertiary mt-1">Suena una alerta al cruzar</p>
        </div>
      )}

      {/* Peajes cruzados */}
      {trip.crossings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-text-secondary px-1 uppercase tracking-wide">Peajes</h2>
          {[...trip.crossings].reverse().map((crossing) => (
            <TollChip key={`${crossing.toll.id}-${crossing.timestamp}`} crossing={crossing} />
          ))}
        </div>
      )}

      {/* Ida y vuelta */}
      {!trip.isActive && trip.crossings.length > 0 && (
        <div className="bg-surface-secondary rounded-2xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-text-secondary">Ida y vuelta</span>
            <span className="text-[17px] font-bold text-text">{formatCLP(trip.totalCost * 2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
