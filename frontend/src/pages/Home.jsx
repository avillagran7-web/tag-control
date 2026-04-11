import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useSimulatedGPS } from '../hooks/useSimulatedGPS';
import { useTrip } from '../hooks/useTrip';
import HeroCard from '../components/HeroCard';
import TollChip from '../components/TollChip';
import TripCard from '../components/TripCard';

export default function Home() {
  const [simMode, setSimMode] = useState(false); // GPS real por defecto
  const trip = useTrip();
  const wakeLockRef = useRef(null);

  const handleTollCrossed = useCallback(
    (crossing) => {
      if (!trip.isActive) return;
      trip.addCrossing(crossing);
      // Vibrar al cruzar peaje (si el dispositivo lo soporta)
      if (navigator.vibrate) navigator.vibrate(200);
    },
    [trip.isActive, trip.addCrossing]
  );

  const realGPS = useGPS({ onTollCrossed: handleTollCrossed });
  const simGPS = useSimulatedGPS({ onTollCrossed: handleTollCrossed });
  const gps = simMode ? simGPS : realGPS;

  // Wake Lock: mantener pantalla encendida durante viaje
  useEffect(() => {
    async function toggleWakeLock() {
      if (trip.isActive && !simMode) {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
          }
        } catch {}
      } else {
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      }
    }
    toggleWakeLock();
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [trip.isActive, simMode]);

  const handleToggleTrip = () => {
    if (trip.isActive) {
      gps.stopTracking();
      trip.endTrip();
    } else {
      trip.startTrip();
      gps.startTracking();
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Toggle simulación */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {simMode ? 'Modo simulación' : 'Modo GPS real'}
          </p>
          <p className="text-xs text-gray-400">
            {simMode ? 'Demo: Algarrobo → Santiago' : 'Detecta peajes automáticamente'}
          </p>
        </div>
        <button
          onClick={() => {
            if (!trip.isActive) setSimMode(!simMode);
          }}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            simMode ? 'bg-orange-400' : 'bg-primary'
          } ${trip.isActive ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              simMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <HeroCard
        totalCost={trip.totalCost}
        tollCount={trip.tollCount}
        isTracking={gps.isTracking}
      />

      {/* Botón iniciar/detener viaje */}
      <button
        onClick={handleToggleTrip}
        className={`w-full py-3.5 rounded-xl font-semibold text-white transition-colors ${
          trip.isActive
            ? 'bg-red-500 active:bg-red-600'
            : 'bg-primary active:bg-primary-dark'
        }`}
      >
        {trip.isActive
          ? 'Detener viaje'
          : simMode
            ? 'Simular viaje Algarrobo → Santiago'
            : 'Iniciar viaje'}
      </button>

      {/* Aviso pantalla encendida */}
      {trip.isActive && !simMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          Pantalla activa para mantener el GPS. No cierres Safari durante el viaje.
        </div>
      )}

      {/* Error GPS */}
      {gps.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {gps.error}
        </div>
      )}

      {/* Barra de progreso simulación */}
      {simMode && gps.isTracking && gps.label && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{gps.label}</span>
            <span className="text-xs text-gray-400">
              {gps.progress + 1}/{gps.totalSteps}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${((gps.progress + 1) / gps.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Info GPS */}
      {gps.isTracking && gps.position && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 flex justify-between">
          <span>
            {gps.position.lat.toFixed(4)}, {gps.position.lng.toFixed(4)}
          </span>
          <span>{Math.round(gps.speed)} km/h</span>
        </div>
      )}

      {/* Viaje en curso */}
      {trip.isActive && trip.crossings.length > 0 && (
        <TripCard crossings={trip.crossings} totalCost={trip.totalCost} />
      )}

      {/* Lista de peajes cruzados */}
      {trip.crossings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-700 px-1">
            Peajes cruzados
          </h2>
          {[...trip.crossings].reverse().map((crossing) => (
            <TollChip key={`${crossing.toll.id}-${crossing.timestamp}`} crossing={crossing} />
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!trip.isActive && trip.crossings.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">
            {simMode
              ? 'Presiona el botón para simular un viaje por Ruta 68'
              : 'Presiona "Iniciar viaje" antes de salir a la carretera'}
          </p>
        </div>
      )}
    </div>
  );
}
