import { useState, useRef, useEffect, useCallback } from 'react';
import { useTolls } from '../hooks/useTolls';
import { getTarifa, getTarifaLabel } from '../lib/pricing';
import { loadGoogleMaps, getRoute, findTollsOnRoute } from '../lib/gmaps';

function formatCLP(amount) {
  return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

export default function PlanRoute() {
  const { tolls } = useTolls();
  const tarifaLabel = getTarifaLabel();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routes, setRoutes] = useState(null); // array de rutas alternativas
  const [selectedIdx, setSelectedIdx] = useState(0);

  const originRef = useRef(null);
  const destRef = useRef(null);
  const originAutoRef = useRef(null);
  const destAutoRef = useRef(null);

  // Inicializar Google Places Autocomplete
  useEffect(() => {
    loadGoogleMaps().then(() => {
      const options = {
        componentRestrictions: { country: 'cl' },
        fields: ['formatted_address', 'geometry', 'name'],
      };

      if (originRef.current && !originAutoRef.current) {
        originAutoRef.current = new google.maps.places.Autocomplete(originRef.current, options);
        originAutoRef.current.addListener('place_changed', () => {
          const place = originAutoRef.current.getPlace();
          if (place?.formatted_address) setOrigin(place.formatted_address);
          else if (place?.name) setOrigin(place.name);
        });
      }

      if (destRef.current && !destAutoRef.current) {
        destAutoRef.current = new google.maps.places.Autocomplete(destRef.current, options);
        destAutoRef.current.addListener('place_changed', () => {
          const place = destAutoRef.current.getPlace();
          if (place?.formatted_address) setDestination(place.formatted_address);
          else if (place?.name) setDestination(place.name);
        });
      }
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!origin || !destination) return;

    setLoading(true);
    setError(null);
    setRoutes(null);
    setSelectedIdx(0);

    try {
      const routeResults = await getRoute(origin, destination);

      const enriched = routeResults.map((route) => {
        const tollsOnRoute = findTollsOnRoute(route.path, tolls);
        const totalCost = tollsOnRoute.reduce((sum, t) => sum + getTarifa(t), 0);
        return { ...route, tolls: tollsOnRoute, totalCost };
      });

      if (enriched.length === 0) {
        setError('No se encontró una ruta entre esos puntos.');
      } else {
        setRoutes(enriched);
      }
    } catch (err) {
      setError('Error al buscar la ruta. Revisa los nombres e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, tolls]);

  // Rutas rápidas predefinidas
  const quickRoutes = [
    { label: 'Algarrobo → Santiago', from: 'Algarrobo, Chile', to: 'Santiago Centro, Chile' },
    { label: 'Santiago → Algarrobo', from: 'Santiago Centro, Chile', to: 'Algarrobo, Chile' },
    { label: 'Algarrobo → Las Condes', from: 'Algarrobo, Chile', to: 'Las Condes, Chile' },
  ];

  const selected = routes?.[selectedIdx];

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-negro">Planificar ruta</h1>
        <span className="text-xs bg-primary-light text-primary px-2 py-1 rounded-full font-medium">
          {tarifaLabel}
        </span>
      </div>

      {/* Inputs con autocomplete */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-tierra mb-1 block">Origen</label>
          <input
            ref={originRef}
            type="text"
            placeholder="Ej: Algarrobo"
            defaultValue={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-cream-dark border border-cream-dark rounded-xl px-4 py-3 text-sm text-negro placeholder-hongo focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-tierra mb-1 block">Destino</label>
          <input
            ref={destRef}
            type="text"
            placeholder="Ej: Santiago Centro"
            defaultValue={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-cream-dark border border-cream-dark rounded-xl px-4 py-3 text-sm text-negro placeholder-hongo focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Botón buscar */}
      <button
        onClick={handleSearch}
        disabled={loading || !origin || !destination}
        className={`w-full py-3.5 rounded-xl font-semibold text-cream transition-colors ${
          loading || !origin || !destination
            ? 'bg-tierra/40'
            : 'bg-negro active:bg-negro/80'
        }`}
      >
        {loading ? 'Calculando ruta...' : 'Calcular peajes'}
      </button>

      {/* Rutas rápidas */}
      {!routes && !loading && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-tierra px-1">Rutas frecuentes</p>
          {quickRoutes.map((qr) => (
            <button
              key={qr.label}
              onClick={() => {
                setOrigin(qr.from);
                setDestination(qr.to);
                if (originRef.current) originRef.current.value = qr.from;
                if (destRef.current) destRef.current.value = qr.to;
              }}
              className="bg-cream-dark rounded-xl px-4 py-3 text-left active:bg-cream-dark/70 transition-colors"
            >
              <p className="text-sm font-medium text-negro">{qr.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="text-center py-6">
          <div className="w-10 h-10 mx-auto border-4 border-cream-dark border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-tierra mt-3">Consultando Google Maps...</p>
        </div>
      )}

      {/* Rutas alternativas */}
      {routes && routes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {routes.map((route, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                i === selectedIdx
                  ? 'bg-negro text-cream'
                  : 'bg-cream-dark text-tierra'
              }`}
            >
              <p>{route.summary || `Ruta ${i + 1}`}</p>
              <p className="font-bold">{formatCLP(route.totalCost)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Resultado */}
      {selected && (
        <>
          {/* Card resumen */}
          <div className="bg-negro rounded-2xl p-5 text-cream">
            <p className="text-sm text-tierra mb-1">Costo estimado en peajes</p>
            <p className="text-4xl font-bold tracking-tight">{formatCLP(selected.totalCost)}</p>
            <div className="flex gap-4 mt-3 text-sm text-tierra">
              <span>{selected.distance.text}</span>
              <span>&middot;</span>
              <span>{selected.duration.text}</span>
              <span>&middot;</span>
              <span>{selected.tolls.length} peajes</span>
            </div>
            <p className="text-xs text-hongo mt-2">
              Vía {selected.summary} &middot; Tarifa {tarifaLabel.toLowerCase()}
            </p>
          </div>

          {/* Desglose */}
          {selected.tolls.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-negro px-1">Desglose de peajes</h2>
              {selected.tolls.map((toll, i) => (
                <div
                  key={toll.id}
                  className="flex items-center gap-3 bg-cream-dark rounded-xl px-4 py-3"
                >
                  <div className="w-7 h-7 bg-primary-light rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-negro text-sm truncate">{toll.nombre}</p>
                    <p className="text-xs text-tierra">{toll.ruta}</p>
                  </div>
                  <span className="font-semibold text-primary shrink-0">
                    {formatCLP(getTarifa(toll))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-primary-light rounded-xl p-4 text-sm text-primary text-center">
              Esta ruta no pasa por peajes registrados
            </div>
          )}

          {/* Ida y vuelta */}
          {selected.tolls.length > 0 && (
            <div className="bg-cream-dark rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-tierra">Ida y vuelta (estimado)</span>
                <span className="font-bold text-negro">{formatCLP(selected.totalCost * 2)}</span>
              </div>
            </div>
          )}

          {/* Buscar otra ruta */}
          <button
            onClick={() => {
              setRoutes(null);
              setOrigin('');
              setDestination('');
              if (originRef.current) originRef.current.value = '';
              if (destRef.current) destRef.current.value = '';
            }}
            className="w-full py-3 rounded-xl text-sm text-tierra border border-cream-dark active:bg-cream-dark transition-colors"
          >
            Buscar otra ruta
          </button>
        </>
      )}
    </div>
  );
}
