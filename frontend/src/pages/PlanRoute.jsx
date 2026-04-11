import { useState, useEffect, useMemo, useRef } from 'react';
import routesData from '../data/routes.json';
import { useTolls } from '../hooks/useTolls';
import { getTarifa, getTarifaLabel } from '../lib/pricing';

function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function PlanRoute() {
  const { getTollById } = useTolls();
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [simMode, setSimMode] = useState(true);
  const [simRunning, setSimRunning] = useState(false);
  const [simVisibleTolls, setSimVisibleTolls] = useState(0);
  const [simRunningTotal, setSimRunningTotal] = useState(0);
  const intervalRef = useRef(null);

  const tarifaLabel = getTarifaLabel();

  const origenes = [...new Set(routesData.routes.map((r) => r.origen))];
  const destinos = [...new Set(routesData.routes.map((r) => r.destino))];

  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');

  const matchingRoutes = useMemo(() => {
    if (!origen && !destino) return [];
    return routesData.routes.filter((r) => {
      if (origen && destino) return r.origen === origen && r.destino === destino;
      if (origen) return r.origen === origen;
      if (destino) return r.destino === destino;
      return false;
    });
  }, [origen, destino]);

  const selectedRoute = selectedRouteId
    ? routesData.routes.find((r) => r.id === selectedRouteId)
    : matchingRoutes.length === 1
      ? matchingRoutes[0]
      : null;

  const tollDetails = selectedRoute
    ? selectedRoute.peajes.map((id) => getTollById(id)).filter(Boolean)
    : [];

  const totalCost = tollDetails.reduce((sum, t) => sum + getTarifa(t), 0);

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startSimulation = () => {
    setOrigen('Algarrobo');
    setDestino('Santiago Centro');
    setSelectedRouteId('algarrobo-santiago');
    setSimVisibleTolls(0);
    setSimRunningTotal(0);
    setSimRunning(true);

    const route = routesData.routes.find((r) => r.id === 'algarrobo-santiago');
    const tolls = route.peajes.map((id) => getTollById(id)).filter(Boolean);
    let step = 0;

    intervalRef.current = setInterval(() => {
      if (step >= tolls.length) {
        clearInterval(intervalRef.current);
        setSimRunning(false);
        return;
      }
      step++;
      setSimVisibleTolls(step);
      setSimRunningTotal(
        tolls.slice(0, step).reduce((sum, t) => sum + getTarifa(t), 0)
      );
    }, 1200);
  };

  const stopSimulation = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimRunning(false);
  };

  const resetAll = () => {
    stopSimulation();
    setOrigen('');
    setDestino('');
    setSelectedRouteId(null);
    setSimVisibleTolls(0);
    setSimRunningTotal(0);
  };

  const isSimActive = simMode && (simRunning || simVisibleTolls > 0);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-800">Planificar ruta</h1>
        <span className="text-xs bg-primary-light text-primary px-2 py-1 rounded-full font-medium">
          {tarifaLabel}
        </span>
      </div>

      {/* Toggle simulación */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">Modo simulación</p>
          <p className="text-xs text-gray-400">Algarrobo → Santiago paso a paso</p>
        </div>
        <button
          onClick={() => {
            if (!simRunning) {
              resetAll();
              setSimMode(!simMode);
            }
          }}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            simMode ? 'bg-primary' : 'bg-gray-300'
          } ${simRunning ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              simMode ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Modo simulación */}
      {simMode && (
        <>
          <button
            onClick={simRunning ? stopSimulation : simVisibleTolls > 0 ? resetAll : startSimulation}
            className={`w-full py-3.5 rounded-xl font-semibold text-white transition-colors ${
              simRunning
                ? 'bg-red-500 active:bg-red-600'
                : simVisibleTolls > 0
                  ? 'bg-gray-500 active:bg-gray-600'
                  : 'bg-primary active:bg-primary-dark'
            }`}
          >
            {simRunning
              ? 'Detener simulación'
              : simVisibleTolls > 0
                ? 'Reiniciar'
                : 'Simular Algarrobo → Santiago'}
          </button>

          {isSimActive && (
            <>
              <div className="bg-primary rounded-2xl p-5 text-white shadow-lg">
                <p className="text-sm opacity-80 mb-1">Costo estimado en peajes</p>
                <p className="text-4xl font-bold tracking-tight transition-all">
                  {formatCLP(simRunningTotal)}
                </p>
                <div className="flex gap-4 mt-3 text-sm opacity-80">
                  <span>120 km</span>
                  <span>&middot;</span>
                  <span>95 min</span>
                  <span>&middot;</span>
                  <span>{simVisibleTolls}/{tollDetails.length} peajes</span>
                </div>
                <p className="text-xs opacity-60 mt-2">
                  Vía Ruta 68 &middot; Tarifa {tarifaLabel.toLowerCase()}
                </p>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-700"
                  style={{ width: `${(simVisibleTolls / tollDetails.length) * 100}%` }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-gray-700 px-1">Desglose de peajes</h2>
                {tollDetails.slice(0, simVisibleTolls).map((toll, i) => (
                  <div
                    key={toll.id}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm animate-[fadeIn_0.4s_ease-out]"
                  >
                    <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{toll.nombre}</p>
                      <p className="text-xs text-gray-400">{toll.ruta}</p>
                    </div>
                    <span className="font-semibold text-primary shrink-0">
                      {formatCLP(getTarifa(toll))}
                    </span>
                  </div>
                ))}
              </div>

              {!simRunning && simVisibleTolls === tollDetails.length && (
                <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Ida y vuelta (estimado)</span>
                    <span className="font-bold text-gray-800">{formatCLP(totalCost * 2)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modo manual */}
      {!simMode && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Origen</label>
            <select
              value={origen}
              onChange={(e) => { setOrigen(e.target.value); setSelectedRouteId(null); }}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 appearance-none"
            >
              <option value="">Seleccionar origen</option>
              {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Destino</label>
            <select
              value={destino}
              onChange={(e) => { setDestino(e.target.value); setSelectedRouteId(null); }}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 appearance-none"
            >
              <option value="">Seleccionar destino</option>
              {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {matchingRoutes.length > 1 && !selectedRoute && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-500">
                {matchingRoutes.length} rutas disponibles
              </p>
              {matchingRoutes.map((route) => {
                const cost = route.peajes
                  .map((id) => getTollById(id))
                  .filter(Boolean)
                  .reduce((sum, t) => sum + getTarifa(t), 0);

                return (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className="bg-white rounded-xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{route.via}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {route.distancia_km} km &middot; {route.tiempo_min} min &middot; {route.peajes.length} peajes
                        </p>
                      </div>
                      <span className="font-bold text-primary">{formatCLP(cost)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {origen && destino && matchingRoutes.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
              No hay rutas precargadas para este trayecto. En la Fase 2 se calculará con Google Maps.
            </div>
          )}

          {selectedRoute && (
            <>
              <div className="bg-primary rounded-2xl p-5 text-white shadow-lg">
                <p className="text-sm opacity-80 mb-1">Costo estimado en peajes</p>
                <p className="text-4xl font-bold tracking-tight">{formatCLP(totalCost)}</p>
                <div className="flex gap-4 mt-3 text-sm opacity-80">
                  <span>{selectedRoute.distancia_km} km</span>
                  <span>&middot;</span>
                  <span>{selectedRoute.tiempo_min} min</span>
                  <span>&middot;</span>
                  <span>{tollDetails.length} peajes</span>
                </div>
                <p className="text-xs opacity-60 mt-2">
                  Vía {selectedRoute.via} &middot; Tarifa {tarifaLabel.toLowerCase()}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-gray-700 px-1">Desglose de peajes</h2>
                {tollDetails.map((toll, i) => (
                  <div
                    key={toll.id}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm"
                  >
                    <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{toll.nombre}</p>
                      <p className="text-xs text-gray-400">{toll.ruta}</p>
                    </div>
                    <span className="font-semibold text-primary shrink-0">
                      {formatCLP(getTarifa(toll))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Ida y vuelta (estimado)</span>
                  <span className="font-bold text-gray-800">{formatCLP(totalCost * 2)}</span>
                </div>
              </div>
            </>
          )}

          {!origen && !destino && (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm">Selecciona origen y destino para ver el costo en peajes</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
