import tollsData from '../data/tolls.json';
import { getTarifa } from './pricing';

// Orden de pórticos por ruta (poniente → oriente)
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

/**
 * Inferencia post-viaje: analiza TODOS los crossings de un viaje terminado
 * y rellena gaps completos. Más agresivo que la inferencia en tiempo real
 * porque tiene la ruta completa para analizar.
 */
export function inferPostTrip(crossings) {
  if (crossings.length < 2) return [];

  const inferred = inferMissingTolls(crossings);

  // Filtrar los que ya existen
  const crossedIds = new Set(crossings.map(c => c.toll?.id || c.tollId));
  return inferred.filter(inf => !crossedIds.has(inf.toll.id));
}
