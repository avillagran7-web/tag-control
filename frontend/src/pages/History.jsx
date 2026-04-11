import { useState, useMemo } from 'react';
import { getSavedTrips, clearTrips } from '../lib/storage';
import { formatCLP, formatDate, formatTime } from '../lib/format';

export default function History() {
  const [allTrips, setAllTrips] = useState(getSavedTrips);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [filterDriver, setFilterDriver] = useState('todos');

  // Obtener lista de conductores
  const driverList = useMemo(() => {
    const names = new Set();
    for (const t of allTrips) {
      if (t.driver) names.add(t.driver);
    }
    return [...names].sort();
  }, [allTrips]);

  // Filtrar viajes
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

    const rutaCount = {};
    for (const trip of trips) {
      for (const r of (trip.routes || [])) {
        rutaCount[r] = (rutaCount[r] || 0) + 1;
      }
    }
    const rutaTop = Object.entries(rutaCount).sort((a, b) => b[1] - a[1])[0];

    return {
      totalViajes: trips.length,
      totalGastado,
      totalPeajes,
      gastoMes,
      viajesMes,
      promedioPorViaje,
      rutaTop: rutaTop ? rutaTop[0] : null,
    };
  }, [trips]);

  const handleClear = () => {
    clearTrips();
    setAllTrips([]);
    setShowConfirmClear(false);
  };

  if (allTrips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <svg className="w-16 h-16 mb-3 text-tierra opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-medium text-negro">Sin viajes registrados</p>
        <p className="text-sm mt-1 text-tierra text-center">
          Los viajes aparecerán aquí después de que presiones "Detener viaje"
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="text-lg font-bold text-negro">Historial</h1>

      {/* Filtro por conductor */}
      {driverList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterDriver('todos')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterDriver === 'todos' ? 'bg-negro text-cream' : 'bg-cream-dark text-tierra'
            }`}
          >
            Todos
          </button>
          {driverList.map((d) => (
            <button
              key={d}
              onClick={() => setFilterDriver(d)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterDriver === d ? 'bg-negro text-cream' : 'bg-cream-dark text-tierra'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="bg-negro rounded-2xl p-5 text-cream">
        <p className="text-sm text-tierra mb-1">
          {filterDriver === 'todos' ? 'Total acumulado' : `Total de ${filterDriver}`}
        </p>
        <p className="text-4xl font-bold tracking-tight">{formatCLP(stats.totalGastado)}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-2xl font-bold">{stats.totalViajes}</p>
            <p className="text-xs text-tierra">viajes</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalPeajes}</p>
            <p className="text-xs text-tierra">peajes</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatCLP(stats.promedioPorViaje)}</p>
            <p className="text-xs text-tierra">promedio</p>
          </div>
        </div>
      </div>

      <div className="bg-primary rounded-xl p-4 text-cream">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs opacity-70">Este mes</p>
            <p className="text-2xl font-bold">{formatCLP(stats.gastoMes)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{stats.viajesMes}</p>
            <p className="text-xs opacity-70">viajes</p>
          </div>
        </div>
      </div>

      {stats.rutaTop && (
        <div className="bg-cream-dark rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-tierra">Ruta más frecuente</p>
            <p className="text-sm font-semibold text-negro">{stats.rutaTop}</p>
          </div>
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-negro px-1">Viajes recientes</h2>
        {trips.map((trip) => (
          <div key={trip.id} className="bg-cream-dark rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-negro text-sm">
                  {(trip.routes || []).join(' → ') || 'Viaje'}
                </p>
                <p className="text-xs text-tierra mt-0.5">
                  {trip.driver && <span className="font-medium">{trip.driver} &middot; </span>}
                  {formatDate(trip.startTime)} &middot; {formatTime(trip.startTime)} – {formatTime(trip.endTime)}
                </p>
              </div>
              <span className="font-bold text-primary">{formatCLP(trip.totalCost)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(trip.crossings || []).map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-cream px-2 py-1 rounded-full text-tierra"
                >
                  <span className="font-medium text-negro">{c.tollNombre}</span>
                  <span>{formatCLP(c.tarifa)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2">
        {!showConfirmClear ? (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="w-full py-3 rounded-xl text-sm text-tierra border border-cream-dark active:bg-cream-dark transition-colors"
          >
            Borrar historial
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 active:bg-red-700"
            >
              Confirmar
            </button>
            <button
              onClick={() => setShowConfirmClear(false)}
              className="flex-1 py-3 rounded-xl text-sm text-negro border border-cream-dark active:bg-cream-dark"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
