import { useEffect, useCallback, useRef } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useTrip } from '../hooks/useTrip';
import { getTarifaLabel } from '../lib/pricing';
import TollChip from '../components/TollChip';

function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function Home() {
  const trip = useTrip();
  const wakeLockRef = useRef(null);

  const handleTollCrossed = useCallback(
    (crossing) => {
      if (!trip.isActive) return;
      trip.addCrossing(crossing);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    },
    [trip.isActive, trip.addCrossing]
  );

  const gps = useGPS({ onTollCrossed: handleTollCrossed });

  // Wake Lock
  useEffect(() => {
    async function toggleWakeLock() {
      if (trip.isActive) {
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
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, [trip.isActive]);

  const handleToggleTrip = () => {
    if (trip.isActive) {
      gps.stopTracking();
      trip.endTrip();
    } else {
      trip.startTrip();
      gps.startTracking();
    }
  };

  const tarifaLabel = getTarifaLabel();

  // ─── PANTALLA ANTES DE INICIAR ───
  if (!trip.isActive && trip.crossings.length === 0) {
    return (
      <div className="flex flex-col gap-5 p-5 pb-24">
        {/* Saludo */}
        <div className="text-center pt-6 pb-2">
          <p className="text-2xl font-bold text-negro">Tu peaje, bajo control</p>
          <p className="text-sm text-tierra mt-1">
            {tarifaLabel === 'Fin de semana'
              ? 'Tarifa de fin de semana activa'
              : 'Tarifa de día de semana activa'}
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-primary rounded-2xl p-6 text-cream text-center">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-lg font-medium">Registra tus peajes</p>
          <p className="text-sm opacity-70 mt-1">
            Detecta automáticamente cada peaje que cruzas
          </p>
        </div>

        {/* Botón grande */}
        <button
          onClick={handleToggleTrip}
          className="w-full py-5 rounded-2xl font-bold text-xl text-cream bg-negro active:bg-negro/80 transition-colors"
        >
          Comenzar viaje
        </button>

        {/* Instrucciones simples */}
        <div className="bg-cream-dark rounded-xl p-4">
          <p className="text-sm font-semibold text-negro mb-3">¿Cómo funciona?</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">1</span>
              </span>
              <p className="text-sm text-negro/70">Presiona <strong className="text-negro">"Comenzar viaje"</strong> antes de salir</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">2</span>
              </span>
              <p className="text-sm text-negro/70">Acepta el permiso de ubicación si te lo pide</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">3</span>
              </span>
              <p className="text-sm text-negro/70">El celular <strong className="text-negro">vibra</strong> cada vez que cruzas un peaje</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">4</span>
              </span>
              <p className="text-sm text-negro/70">Al llegar, presiona <strong className="text-negro">"Detener viaje"</strong></p>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="bg-primary-light rounded-xl p-3 text-xs text-primary text-center">
          Deja Safari abierto con la pantalla encendida durante el viaje
        </div>
      </div>
    );
  }

  // ─── PANTALLA DURANTE / DESPUÉS DEL VIAJE ───
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Hero con total */}
      <div className="bg-negro rounded-2xl p-6 text-cream">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-tierra">
            {trip.isActive ? 'Viaje en curso' : 'Viaje terminado'}
          </span>
          {trip.isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/30 text-primary-light">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              GPS activo
            </span>
          )}
        </div>
        <p className="text-5xl font-bold tracking-tight mt-2">
          {formatCLP(trip.totalCost)}
        </p>
        <p className="text-sm text-tierra mt-2">
          {trip.tollCount === 0
            ? 'Esperando peajes...'
            : `${trip.tollCount} peaje${trip.tollCount > 1 ? 's' : ''} cruzado${trip.tollCount > 1 ? 's' : ''}`}
        </p>
        <p className="text-xs text-hongo mt-1">Tarifa {tarifaLabel.toLowerCase()}</p>
      </div>

      {/* Botón detener / nuevo viaje */}
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

      {/* Aviso pantalla */}
      {trip.isActive && (
        <div className="bg-primary-light rounded-xl p-3 text-xs text-primary text-center">
          No cierres Safari. La pantalla se mantiene encendida.
        </div>
      )}

      {/* Error GPS */}
      {gps.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {gps.error}
        </div>
      )}

      {/* Coordenadas + velocidad */}
      {gps.isTracking && gps.position && (
        <div className="bg-cream-dark rounded-xl p-3 text-xs text-tierra flex justify-between">
          <span>
            {gps.position.lat.toFixed(4)}, {gps.position.lng.toFixed(4)}
          </span>
          <span>{Math.round(gps.speed)} km/h</span>
        </div>
      )}

      {/* Spinner esperando peajes */}
      {trip.isActive && trip.crossings.length === 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-2 border-4 border-cream-dark border-t-primary rounded-full animate-spin" />
          <p className="text-sm mt-3 text-negro">Buscando peajes cercanos...</p>
          <p className="text-xs mt-1 text-tierra">El celular vibrará cuando cruces uno</p>
        </div>
      )}

      {/* Lista de peajes cruzados */}
      {trip.crossings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-negro px-1">
            Peajes cruzados
          </h2>
          {[...trip.crossings].reverse().map((crossing) => (
            <TollChip key={`${crossing.toll.id}-${crossing.timestamp}`} crossing={crossing} />
          ))}
        </div>
      )}

      {/* Resumen ida y vuelta si terminó */}
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
