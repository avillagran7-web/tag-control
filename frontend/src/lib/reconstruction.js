/**
 * Reconstrucción retroactiva de peajes desde posiciones GPS.
 *
 * Este es el safety net del sistema: si la detección en tiempo real falla
 * (background, accuracy, throttle), este módulo reconstruye los peajes
 * analizando TODAS las posiciones GPS guardadas del viaje.
 *
 * Arquitectura:
 * - Detección real-time (useGPS) = fast path, best effort
 * - Reconstrucción post-viaje (este módulo) = safety net, ground truth
 */

import { supabase } from './supabase';
import { haversine, pointToSegmentDistance } from './geoUtils';
import { getTarifa } from './pricing';
import tollsData from '../data/tolls.json';

const DETECTION_RADIUS_M = 150;
const COOLDOWN_MS = 60000; // 60s cooldown entre mismo peaje (más bajo que real-time porque positions están cada 30s)
const MIN_SPEED_KMH = 10; // Más permisivo que real-time (10 vs 20 km/h)
const MAX_SEGMENT_M = 2000; // Gap máximo entre positions consecutivas para usar detección por segmento

/**
 * Reconstruye peajes cruzados a partir de un array de posiciones GPS.
 * Cada posición: { lat, lng, speed, created_at }
 *
 * Retorna array de crossings reconstruidos.
 */
export function reconstructFromPositions(positions) {
  if (!positions || positions.length < 2) return [];

  const crossings = [];
  const cooldowns = {};

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const ts = new Date(pos.created_at).getTime();

    // Calcular velocidad: usar la guardada, o interpolar entre posiciones
    let speed = pos.speed || 0;
    if (speed === 0 && i > 0) {
      const prev = positions[i - 1];
      const dist = haversine(prev.lat, prev.lng, pos.lat, pos.lng);
      const timeSec = (ts - new Date(prev.created_at).getTime()) / 1000;
      if (timeSec > 0) speed = (dist / timeSec) * 3.6;
    }

    // Detección por segmento: con positions cada 30s a 100 km/h hay 800m entre
    // muestras, fácil saltarse un peaje. Medimos al segmento entre posiciones.
    const prev = i > 0 ? positions[i - 1] : null;
    const useSegment =
      prev != null &&
      haversine(prev.lat, prev.lng, pos.lat, pos.lng) <= MAX_SEGMENT_M;

    for (const toll of tollsData.tolls) {
      const distance = useSegment
        ? pointToSegmentDistance(toll.lat, toll.lng, prev.lat, prev.lng, pos.lat, pos.lng)
        : haversine(pos.lat, pos.lng, toll.lat, toll.lng);
      const radius = toll.radio_deteccion_m || DETECTION_RADIUS_M;
      const lastCrossed = cooldowns[toll.id] || 0;
      const inCooldown = ts - lastCrossed < COOLDOWN_MS;

      // Más permisivo que real-time: radio expandido 1.5x (positions son cada 30s,
      // a 120 km/h = 1000m entre lecturas, fácil pasar un peaje entre dos)
      const expandedRadius = radius * 1.5;

      // Speed check más permisivo: si estás dentro del radio, probablemente cruzaste
      const speedOk = speed >= MIN_SPEED_KMH || distance <= radius;

      if (distance <= expandedRadius && speedOk && !inCooldown) {
        cooldowns[toll.id] = ts;
        crossings.push({
          toll,
          timestamp: ts,
          lat: pos.lat,
          lng: pos.lng,
          speed,
          distance: Math.round(distance),
          reconstructed: true,
        });
      }
    }
  }

  return crossings;
}

/**
 * Merge: combina crossings de real-time con los reconstruidos.
 * Prioriza real-time, agrega los reconstruidos que faltan.
 */
export function mergeCrossings(realtimeCrossings, reconstructedCrossings) {
  const realtimeIds = new Set(
    realtimeCrossings.map(c => c.toll?.id || c.tollId)
  );

  // Agregar solo los reconstruidos que no se detectaron en real-time
  const newCrossings = reconstructedCrossings.filter(
    c => !realtimeIds.has(c.toll.id)
  );

  // Merge y ordenar por timestamp
  const merged = [
    ...realtimeCrossings,
    ...newCrossings.map(c => ({ ...c, inferred: true })),
  ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return merged;
}

/**
 * Reconstrucción completa de un viaje:
 * 1. Fetch posiciones GPS desde Supabase
 * 2. Reconstruir crossings
 * 3. Merge con crossings existentes
 * 4. Actualizar trip en Supabase
 *
 * Retorna { crossings, totalCost, tollCount, newTolls } o null si no hay positions.
 */
export async function reconstructTrip(tripId, existingCrossings = []) {
  // Fetch posiciones del viaje
  const { data: positions, error } = await supabase
    .from('positions')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error || !positions || positions.length < 2) return null;

  // Reconstruir desde posiciones
  const reconstructed = reconstructFromPositions(positions);
  if (reconstructed.length === 0 && existingCrossings.length === 0) return null;

  // Merge con crossings existentes
  const merged = mergeCrossings(existingCrossings, reconstructed);

  // Calcular costos
  const totalCost = merged.reduce(
    (sum, c) => sum + getTarifa(c.toll || tollsData.tolls.find(t => t.id === c.tollId), new Date(c.timestamp)),
    0
  );

  const newTolls = merged.length - existingCrossings.length;

  return {
    crossings: merged,
    totalCost,
    tollCount: merged.length,
    newTolls,
    positionCount: positions.length,
  };
}

/**
 * Reconstruye y actualiza un trip en Supabase.
 * Retorna el resultado de la reconstrucción o null.
 */
export async function reconstructAndUpdateTrip(tripId) {
  // Fetch trip actual
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (!trip) return null;

  const existingCrossings = (trip.crossings || []).map(c => ({
    toll: tollsData.tolls.find(t => t.id === c.tollId) || { id: c.tollId, nombre: c.tollNombre, ruta: c.tollRuta },
    tollId: c.tollId,
    tollNombre: c.tollNombre,
    timestamp: c.timestamp || new Date(c.crossed_at).getTime(),
  }));

  const result = await reconstructTrip(tripId, existingCrossings);
  if (!result || result.newTolls === 0) return result;

  // Actualizar trip en Supabase con crossings reconstruidos
  const crossingsForDb = result.crossings.map(c => ({
    tollId: c.toll?.id || c.tollId,
    tollNombre: c.toll?.nombre || c.tollNombre,
    tollRuta: c.toll?.ruta || c.tollRuta,
    tarifa: getTarifa(c.toll, new Date(c.timestamp)),
    timestamp: c.timestamp,
    inferred: c.inferred || c.reconstructed || false,
  }));

  const routes = [...new Set(crossingsForDb.map(c => c.tollRuta).filter(Boolean))];

  await supabase
    .from('trips')
    .update({
      crossings: crossingsForDb,
      total_cost: result.totalCost,
      toll_count: result.tollCount,
      routes,
    })
    .eq('id', tripId);

  return result;
}

/**
 * Reconstruye TODOS los viajes que tienen posiciones GPS disponibles.
 * Para usar desde Admin o como batch job.
 */
export async function reconstructAllTrips() {
  // Buscar trips que tienen posiciones asociadas
  const { data: trips } = await supabase
    .from('trips')
    .select('id, crossings, total_cost, toll_count')
    .order('created_at', { ascending: false });

  if (!trips) return [];

  const results = [];
  for (const trip of trips) {
    const result = await reconstructAndUpdateTrip(trip.id);
    if (result && result.newTolls > 0) {
      results.push({
        tripId: trip.id,
        originalTolls: trip.toll_count,
        newTolls: result.newTolls,
        totalTolls: result.tollCount,
        newCost: result.totalCost,
      });
    }
  }

  return results;
}
