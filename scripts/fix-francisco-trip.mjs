#!/usr/bin/env node
// Reconstruct Francisco's trip from his 160 GPS positions and insert a
// `trips` record (he's only in live_trips because 0 tolls were detected
// in real-time).
import { readFileSync } from 'fs';
import { haversine, pointToSegmentDistance } from '../frontend/src/lib/geoUtils.js';
import { getTarifa } from '../frontend/src/lib/pricing.js';

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';
const TRIP_ID = 'trip-Φρανσίσκο Βιλλαγραν-1776254576977';

const tollsData = JSON.parse(readFileSync(new URL('../frontend/src/data/tolls.json', import.meta.url)));
const TOLLS = tollsData.tolls;

const COOLDOWN_MS = 300_000; // 5 min — one-off reconstruction, avoid dup near parked car
const MAX_SEGMENT_M = 2000;
const DEFAULT_RADIUS = 150;
const RADIUS_MULTIPLIER = 1.0; // radii ya están calibrados con datos reales
const MIN_SPEED_KMH = 15;

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: ANON, Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...opts.headers,
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

function reconstruct(positions) {
  const crossings = [];
  const cooldowns = {};
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const ts = new Date(pos.created_at).getTime();
    let speed = pos.speed || 0;
    if (speed === 0 && i > 0) {
      const prev = positions[i - 1];
      const dist = haversine(prev.lat, prev.lng, pos.lat, pos.lng);
      const dt = (ts - new Date(prev.created_at).getTime()) / 1000;
      if (dt > 0) speed = (dist / dt) * 3.6;
    }
    const prev = i > 0 ? positions[i - 1] : null;
    const useSeg = prev && haversine(prev.lat, prev.lng, pos.lat, pos.lng) <= MAX_SEGMENT_M;

    for (const toll of TOLLS) {
      const dist = useSeg
        ? pointToSegmentDistance(toll.lat, toll.lng, prev.lat, prev.lng, pos.lat, pos.lng)
        : haversine(pos.lat, pos.lng, toll.lat, toll.lng);
      const radius = (toll.radio_deteccion_m || DEFAULT_RADIUS) * RADIUS_MULTIPLIER;
      const last = cooldowns[toll.id] || 0;
      if (ts - last < COOLDOWN_MS) continue;
      if (!(speed >= MIN_SPEED_KMH && speed < 200)) continue; // require real motion, filter GPS glitches
      if (dist <= radius) {
        cooldowns[toll.id] = ts;
        crossings.push({ toll, timestamp: ts, distance: Math.round(dist), speed });
      }
    }
  }
  return crossings;
}

const positions = await sb(`positions?select=lat,lng,speed,created_at&trip_id=eq.${encodeURIComponent(TRIP_ID)}&order=created_at.asc&limit=2000`);
console.log(`Loaded ${positions.length} positions`);

const crossings = reconstruct(positions);
console.log(`\nReconstructed ${crossings.length} crossings:`);
for (const c of crossings) {
  console.log(`  ${new Date(c.timestamp).toISOString()}  ${c.toll.nombre} (${c.distance}m, ${c.speed.toFixed(0)} km/h)`);
}

const totalCost = crossings.reduce((s, c) => s + getTarifa(c.toll, new Date(c.timestamp)), 0);
const routes = [...new Set(crossings.map(c => c.toll.ruta))];
const startTime = new Date(positions[0].created_at).toISOString();
const endTime = new Date(positions[positions.length - 1].created_at).toISOString();

const payload = {
  id: TRIP_ID,
  driver: 'Φρανσίσκο Βιλλαγραν',
  start_time: startTime,
  end_time: endTime,
  total_cost: totalCost,
  toll_count: crossings.length,
  routes,
  platform: 'android',
  crossings: crossings.map(c => ({
    tollId: c.toll.id,
    tollNombre: c.toll.nombre,
    tollRuta: c.toll.ruta,
    tarifa: getTarifa(c.toll, new Date(c.timestamp)),
    timestamp: c.timestamp,
    inferred: true,
  })),
};

console.log(`\nTotal cost: $${totalCost}, routes: ${routes.join(', ')}`);
console.log(`Start: ${startTime}, End: ${endTime}`);

if (process.argv.includes('--commit')) {
  const res = await sb('trips', { method: 'POST', body: JSON.stringify(payload) });
  console.log('\n✓ Inserted:', res);
} else {
  console.log('\n(dry run — pass --commit to insert)');
}
