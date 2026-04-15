/**
 * Calcula la distancia en metros entre dos puntos GPS usando la fórmula haversine.
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convierte m/s a km/h
 */
export function msToKmh(ms) {
  return ms * 3.6;
}

// Shortest distance (meters) from point P to segment A→B using equirectangular
// projection — accurate within ~0.1% for segments < 1km. Critical for highway
// toll detection: at 80 km/h with 5s sampling, consecutive GPS points are ~110m
// apart and a point-only check can "skip over" a 150m radius without any sample
// landing inside.
export function pointToSegmentDistance(pLat, pLng, aLat, aLng, bLat, bLng) {
  const cosLat = Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  const toX = (lng) => lng * cosLat * 111320;
  const toY = (lat) => lat * 110540;
  const ax = toX(aLng), ay = toY(aLat);
  const bx = toX(bLng), by = toY(bLat);
  const px = toX(pLng), py = toY(pLat);
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
