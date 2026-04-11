import tollsData from '../data/tolls.json';
import { getTarifa } from './pricing';

// Orden de pórticos por ruta (poniente → oriente)
const ROUTE_SEQUENCES = {
  'Costanera Norte (eje)': [
    'cn-p9', 'cn-p6.2', 'cn-p6.1', 'cn-p5', 'cn-ev', 'cn-ep', 'cn-p3', 'cn-sb', 'cn-p2.2', 'cn-p2.1', 'cn-p1', 'cn-p0'
  ],
  'Costanera Norte (Kennedy)': [
    'cn-p2.2', 'cn-p2.1', 'cn-p7', 'cn-p8'
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

    // Determinar dirección (poniente→oriente o oriente→poniente)
    const first = crossedInSequence[0].seqIdx;
    const last = crossedInSequence[crossedInSequence.length - 1].seqIdx;
    const forward = last > first;

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
