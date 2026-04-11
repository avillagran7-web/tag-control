import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useTrip } from '../hooks/useTrip';
import { getTarifaLabel } from '../lib/pricing';
import { formatCLP } from '../lib/format';
import { playTollSound, initAudio } from '../lib/sound';
import TollChip from '../components/TollChip';

const DRIVER_KEY = 'tagcontrol_driver';
const DRIVERS_KEY = 'tagcontrol_drivers';

function getSavedDrivers() {
  try { return JSON.parse(localStorage.getItem(DRIVERS_KEY) || '[]'); } catch { return []; }
}
function saveDriver(name) {
  const drivers = getSavedDrivers();
  if (!drivers.includes(name)) {
    drivers.push(name);
    localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
  }
  localStorage.setItem(DRIVER_KEY, name);
}
function getLastDriver() {
  return localStorage.getItem(DRIVER_KEY) || '';
}

export default function Home() {
  const [driver, setDriver] = useState(getLastDriver);
  const [newDriver, setNewDriver] = useState('');
  const [drivers] = useState(getSavedDrivers);
  const trip = useTrip();
  const wakeLockRef = useRef(null);

  const handleTollCrossed = useCallback(
    (crossing) => {
      if (!trip.isActive) return;
      trip.addCrossing(crossing);
      playTollSound();
    },
    [trip.isActive, trip.addCrossing]
  );

  const gps = useGPS({ onTollCrossed: handleTollCrossed });

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
    } else {
      const name = newDriver.trim() || driver;
      if (name) {
        saveDriver(name);
        setDriver(name);
        setNewDriver('');
      }
      initAudio();
      trip.startTrip(name || 'Sin nombre');
      gps.startTracking();
    }
  };

  const tarifaLabel = getTarifaLabel();

  // ─── PANTALLA ANTES DE INICIAR ───
  if (!trip.isActive && trip.crossings.length === 0) {
    return (
      <div className="flex flex-col gap-5 p-5 pb-24">
        <div className="text-center pt-6 pb-2">
          <p className="text-2xl font-bold text-negro">Tu peaje, bajo control</p>
          <p className="text-sm text-tierra mt-1">
            {tarifaLabel === 'Fin de semana'
              ? 'Tarifa de fin de semana activa'
              : 'Tarifa de día de semana activa'}
          </p>
        </div>

        {/* Selector de conductor */}
        <div className="bg-cream-dark rounded-xl p-4">
          <p className="text-xs font-medium text-tierra mb-2">¿Quién viaja?</p>
          {drivers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {drivers.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDriver(d); setNewDriver(''); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    driver === d && !newDriver
                      ? 'bg-negro text-cream'
                      : 'bg-cream text-tierra active:bg-negro/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={newDriver}
            onChange={(e) => { setNewDriver(e.target.value); setDriver(''); }}
            placeholder={drivers.length > 0 ? 'O escribe otro nombre...' : 'Escribe tu nombre'}
            className="w-full bg-cream border border-cream rounded-xl px-3 py-2.5 text-sm text-negro placeholder-hongo focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="bg-primary rounded-2xl p-6 text-cream text-center">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-lg font-medium">Registra tus peajes</p>
          <p className="text-sm opacity-70 mt-1">Detecta automáticamente cada peaje que cruzas</p>
        </div>

        <button
          onClick={handleToggleTrip}
          className="w-full py-5 rounded-2xl font-bold text-xl text-cream bg-negro active:bg-negro/80 transition-colors"
        >
          Comenzar viaje
        </button>

        <div className="bg-cream-dark rounded-xl p-4">
          <p className="text-sm font-semibold text-negro mb-3">¿Cómo funciona?</p>
          <div className="flex flex-col gap-3">
            {[
              ['1', 'Presiona "Comenzar viaje" antes de salir'],
              ['2', 'Acepta el permiso de ubicación si te lo pide'],
              ['3', 'Suena una alerta cada vez que cruzas un peaje'],
              ['4', 'Al llegar, presiona "Detener viaje"'],
            ].map(([n, text]) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{n}</span>
                </span>
                <p className="text-sm text-negro/70">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary-light rounded-xl p-3 text-xs text-primary text-center">
          Deja Safari abierto con la pantalla encendida durante el viaje
        </div>
      </div>
    );
  }

  // ─── PANTALLA DURANTE / DESPUÉS DEL VIAJE ───
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="bg-negro rounded-2xl p-6 text-cream">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-tierra">
            {trip.isActive ? 'Viaje en curso' : 'Viaje terminado'}
            {trip.driver && <span className="text-cream/60"> &middot; {trip.driver}</span>}
          </span>
          {trip.isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/30 text-primary-light">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              GPS activo
            </span>
          )}
        </div>
        <p className="text-5xl font-bold tracking-tight mt-2">{formatCLP(trip.totalCost)}</p>
        <p className="text-sm text-tierra mt-2">
          {trip.tollCount === 0
            ? 'Esperando peajes...'
            : `${trip.tollCount} peaje${trip.tollCount > 1 ? 's' : ''} cruzado${trip.tollCount > 1 ? 's' : ''}`}
        </p>
        <p className="text-xs text-hongo mt-1">Tarifa {tarifaLabel.toLowerCase()}</p>
      </div>

      <button
        onClick={handleToggleTrip}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
          trip.isActive
            ? 'bg-red-600 active:bg-red-700 text-white'
            : 'bg-negro active:bg-negro/80 text-cream'
        }`}
      >
        {trip.isActive ? 'Detener viaje' : 'Nuevo viaje'}
      </button>

      {trip.isActive && (
        <div className="bg-primary-light rounded-xl p-4 text-primary">
          <p className="text-sm font-semibold">Mantén esta pantalla abierta</p>
          <p className="text-xs mt-1 opacity-80">No cambies de app ni bloquees el celular.</p>
        </div>
      )}

      {gps.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{gps.error}</div>
      )}

      {gps.isTracking && gps.position && (
        <div className="bg-cream-dark rounded-xl p-3 text-xs text-tierra flex justify-between">
          <span>{gps.position.lat.toFixed(4)}, {gps.position.lng.toFixed(4)}</span>
          <span>{Math.round(gps.speed)} km/h</span>
        </div>
      )}

      {trip.isActive && trip.crossings.length === 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-2 border-4 border-cream-dark border-t-primary rounded-full animate-spin" />
          <p className="text-sm mt-3 text-negro">Buscando peajes cercanos...</p>
          <p className="text-xs mt-1 text-tierra">Suena una alerta cuando cruces uno</p>
        </div>
      )}

      {trip.crossings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-negro px-1">Peajes cruzados</h2>
          {[...trip.crossings].reverse().map((crossing) => (
            <TollChip key={`${crossing.toll.id}-${crossing.timestamp}`} crossing={crossing} />
          ))}
        </div>
      )}

      {!trip.isActive && trip.crossings.length > 0 && (
        <div className="bg-cream-dark rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-tierra">Ida y vuelta (estimado)</span>
            <span className="font-bold text-negro">{formatCLP(trip.totalCost * 2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
