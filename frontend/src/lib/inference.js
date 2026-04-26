import tollsData from '../data/tolls.json';
import { getTarifa } from './pricing';
import { haversine } from './geoUtils';

// Default speed for timestamp estimation. Urban Santiago routes run ~70 km/h;
// intercity routes (Ruta 68, Ruta 78) run ~100 km/h.
const AVG_HIGHWAY_SPEED_KMH = 90;

// Per-route speed overrides for accurate timestamp inference.
const ROUTE_SPEEDS_KMH = {
  'Ruta 68':                    100,
  'Ruta 78 (Autopista del Sol)': 100,
  'Autopista Nororiente':        80,
  'Costanera Norte (eje)':       70,
  'Costanera Norte (Kennedy)':   70,
  'Autopista Central (NS)':      70,
  'Autopista Central (GV)':      70,
  'Vespucio Norte Express':      70,
  'Vespucio Sur':                70,
  'Vespucio Oriente (AVO)':      70,
};

// Orden de pórticos por ruta (poniente → oriente / sur → norte)
const ROUTE_SEQUENCES = {
  'Costanera Norte (eje)': [
    'cn-p9', 'cn-p6.2', 'cn-p6.1', 'cn-p5', 'cn-ev', 'cn-p4', 'cn-ep', 'cn-p3', 'cn-sb', 'cn-p2.2', 'cn-p2.1', 'cn-p1', 'cn-p0'
  ],
  'Costanera Norte (Kennedy)': [
    'cn-p2.2', 'cn-p2.1', 'cn-p7', 'cn-p8'
  ],
  'Autopista Central (NS)': [
    'ac-ns-guindos', 'ac-ns-capilla', 'ac-sb', 'ac-ns-acacias', 'ac-ruta5', 'ac-ns-departamental', 'ac-ns-valdovinos', 'ac-ns-alameda', 'ac-pa13', 'ac-ns-fama', 'ac-norte'
  ],
  'Autopista Central (GV)': [
    'ac-gv-ruta5sur', 'ac-gv-vespucio', 'ac-gv-valdovinos', 'ac-pa26', 'ac-gv-mapocho', 'ac-gv-ruta5norte'
  ],
  'Vespucio Norte Express': [
    'vn-salto', 'vn-recoleta', 'vn-independencia', 'vn-fontova', 'vn-ruta5', 'vn-ce', 'vn-condell', 'vn-costanera', 'vn-ruta68', 'vn-oficina', 'vn-p16', 'vn-losmares', 'vn-ruta78'
  ],
  'Vespucio Sur': [
    'vs-grecia', 'vs-quilin', 'vs-lastorres', 'vs-florida', 'vs-mackenna', 'vs-santajulia', 'vs-departamental', 'vs-santarosa', 'vs-granavenida', 'vs-ruta5', 'vs-cisterna', 'vs-velasquez', 'vs-melipilla', 'vs-ruta78'
  ],
  'Vespucio Oriente (AVO)': [
    'avo-elsalto', 'avo-cdempresarial', 'avo-piramide', 'avo-kennedy', 'avo-tobalaba', 'avo-eliodoro', 'avo-bilbao', 'avo-princesa'
  ],
  // Intercity routes — single-direction, no branching
  'Ruta 68': [
    'ruta68-lo-prado', 'ruta68-zapata'
  ],
  'Ruta 78 (Autopista del Sol)': [
    'r78-vespucio', 'r78-rinconada', 'r78-padrehurtado', 'r78-malloco', 'r78-talagante', 'r78-elpaico', 'r78-pomaire', 'r78-puangue'
  ],
  // Autopista Nororiente: south (city entry, Llano Subercaseaux) → north (Chicureo)
  'Autopista Nororiente': [
    'nororiente-llano', 'nororiente-chicureo', 'nororiente-poniente'
  ],
};

const tollMap = {};
for (const t of tollsData.tolls) {
  tollMap[t.id] = t;
}

/**
 * Dado un array de crossings, detecta pórticos faltantes entre dos detectados
 * y retorna los que hay que inferir.
 */
export function inferMissingTolls(crossings) {
  if (crossings.length < 2) return [];

  const inferred = [];
  const crossedIds = crossings.map(c => c.toll?.id || c.tollId);

  for (const [routeName, sequence] of Object.entries(ROUTE_SEQUENCES)) {
    // Encontrar qué pórticos de esta secuencia fueron cruzados
    const crossedInSequence = [];
    for (let i = 0; i < crossedIds.length; i++) {
      const seqIdx = sequence.indexOf(crossedIds[i]);
      if (seqIdx !== -1) {
        crossedInSequence.push({ seqIdx, crossingIdx: i, id: crossedIds[i] });
      }
    }

    if (crossedInSequence.length < 2) continue;

    // Direction is determined implicitly by Math.min/max below — no variable needed.

    // Revisar pares consecutivos de cruzados
    for (let i = 0; i < crossedInSequence.length - 1; i++) {
      const a = crossedInSequence[i].seqIdx;
      const b = crossedInSequence[i + 1].seqIdx;
      const start = Math.min(a, b);
      const end = Math.max(a, b);

      // Si hay gap > 1, inferir los del medio
      if (end - start > 1) {
        for (let j = start + 1; j < end; j++) {
          const tollId = sequence[j];
          if (!crossedIds.includes(tollId)) {
            const toll = tollMap[tollId];
            if (toll) {
              // Timestamp interpolado entre los dos cruces reales
              const crossA = crossings[crossedInSequence[i].crossingIdx];
              const crossB = crossings[crossedInSequence[i + 1].crossingIdx];
              const tsA = crossA.timestamp || new Date(crossA.crossed_at).getTime();
              const tsB = crossB.timestamp || new Date(crossB.crossed_at).getTime();
              const ratio = (j - start) / (end - start);
              const inferredTs = tsA + (tsB - tsA) * ratio;

              inferred.push({
                toll,
                timestamp: Math.round(inferredTs),
                lat: toll.lat,
                lng: toll.lng,
                speed: 0,
                distance: 0,
                inferred: true,
              });
            }
          }
        }
      }
    }
  }

  return inferred;
}

/**
 * Inferencia post-viaje: analiza TODOS los crossings de un viaje terminado
 * y rellena gaps completos. Más agresivo que la inferencia en tiempo real
 * porque tiene la ruta completa para analizar.
 *
 * Con 2+ peajes: rellena gaps entre ellos en la secuencia.
 * Con 1 peaje: infiere peajes anteriores/posteriores usando GPS positions
 * del viaje si están disponibles en los crossings metadata.
 */
export function inferPostTrip(crossings) {
  if (crossings.length === 0) return [];

  const crossedIds = new Set(crossings.map(c => c.toll?.id || c.tollId));

  if (crossings.length >= 2) {
    const inferred = inferMissingTolls(crossings);
    return inferred.filter(inf => !crossedIds.has(inf.toll.id));
  }

  // Con 1 solo peaje: buscar peajes adyacentes en la misma ruta
  // que deberían haberse detectado (probablemente perdidos por background)
  return inferFromSingleToll(crossings[0], crossedIds);
}

/**
 * Dado un solo peaje detectado, infiere peajes adyacentes que probablemente
 * se cruzaron pero no se detectaron (típico de background GPS loss).
 *
 * Lógica: si detectaste un peaje que está en medio de una secuencia,
 * los de entrada a esa ruta probablemente también se cruzaron.
 */
function inferFromSingleToll(crossing, crossedIds) {
  const tollId = crossing.toll?.id || crossing.tollId;
  const inferred = [];

  for (const [routeName, sequence] of Object.entries(ROUTE_SEQUENCES)) {
    const idx = sequence.indexOf(tollId);
    if (idx === -1) continue;

    // Infer entry tolls the driver crossed before the detected one.
    // Typical case: user enters autopista, background GPS drops,
    // first detected toll is mid-sequence. We don't infer forward
    // (post-detection) because the trip may have ended before reaching them.
    if (idx === 0) continue;

    const detectedToll = tollMap[tollId];
    const routeSpeed = ROUTE_SPEEDS_KMH[routeName] || AVG_HIGHWAY_SPEED_KMH;

    for (let j = 0; j < idx; j++) {
      const inferredId = sequence[j];
      if (crossedIds.has(inferredId)) continue;
      const toll = tollMap[inferredId];
      if (!toll) continue;
      const ts = crossing.timestamp || new Date(crossing.crossed_at).getTime();

      // Estimate travel time from haversine distance between toll positions.
      // Much more accurate than a hardcoded constant — Costanera end-to-end is ~15 km.
      const distM = detectedToll
        ? haversine(toll.lat, toll.lng, detectedToll.lat, detectedToll.lng)
        : (idx - j) * 4000; // fallback: ~4 km per toll if coords missing
      const travelMs = (distM / 1000 / routeSpeed) * 3600 * 1000;

      inferred.push({
        toll,
        timestamp: Math.round(ts - travelMs),
        lat: toll.lat,
        lng: toll.lng,
        speed: 0,
        distance: 0,
        inferred: true,
      });
    }
  }

  return inferred;
}
