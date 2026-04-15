#!/usr/bin/env node
// Audit all tolls vs Francisco's Android trajectory — flag any whose closest
// approach is < 600m but outside the current detection radius.
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';
const TRIP = 'trip-Φρανσίσκο Βιλλαγραν-1776254576977';

const tollsData = JSON.parse(readFileSync(new URL('../frontend/src/data/tolls.json', import.meta.url)));
const tolls = tollsData.peajes || tollsData.tolls || Object.values(tollsData).flat().filter(x => x && x.id && x.lat);

function hav(a, b) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat), la2 = toR(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function footOnSegment(A, B, P) {
  const toR = d => d * Math.PI / 180;
  const latRef = toR((A.lat + B.lat) / 2);
  const scale = 111320;
  const ax = A.lng * Math.cos(latRef) * scale, ay = A.lat * 111320;
  const bx = B.lng * Math.cos(latRef) * scale, by = B.lat * 111320;
  const px = P.lng * Math.cos(latRef) * scale, py = P.lat * 111320;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-6) return hav(A, P);
  let t = ((px-ax)*dx + (py-ay)*dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const fx = ax + t*dx, fy = ay + t*dy;
  const flat = fy / 111320, flng = fx / (Math.cos(latRef) * scale);
  return hav({lat:flat,lng:flng}, P);
}

const pos = await fetch(`${SUPABASE_URL}/rest/v1/positions?select=lat,lng,created_at&trip_id=eq.${encodeURIComponent(TRIP)}&order=created_at.asc&limit=2000`,
  { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }).then(r => r.json());
console.log(`${pos.length} positions loaded`);

const flat = tollsData.tolls || tollsData.peajes || [];
const results = [];
for (const toll of flat) {
  let best = Infinity;
  for (let i = 0; i < pos.length - 1; i++) {
    const d = footOnSegment(pos[i], pos[i+1], toll);
    if (d < best) best = d;
  }
  results.push({ id: toll.id, nombre: toll.nombre, ruta: toll.ruta, radius: toll.radio_deteccion_m, closest: best });
}

results.sort((a,b) => a.closest - b.closest);
console.log('\n=== Tolls within 800m of trajectory ===');
for (const r of results) {
  if (r.closest > 800) continue;
  const status = r.closest < r.radius ? '✓ IN RANGE' : `✗ outside (${(r.closest - r.radius).toFixed(0)}m short)`;
  console.log(`${r.closest.toFixed(0).padStart(4)}m / r=${r.radius}m  ${status}  ${r.nombre} [${r.ruta}]`);
}
