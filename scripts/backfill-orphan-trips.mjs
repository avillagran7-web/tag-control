#!/usr/bin/env node
// Backfill trips rows for closed live_trips that never got migrated to `trips`.
// Runs reconstruction from GPS positions if available; otherwise inserts a
// zero-toll row so the trip is visible in Admin "Viajes en riesgo".
//
// Usage:  node scripts/backfill-orphan-trips.mjs            # dry run
//         node scripts/backfill-orphan-trips.mjs --commit   # insert
import { readFileSync } from 'fs';
import { haversine, pointToSegmentDistance } from '../frontend/src/lib/geoUtils.js';
import { getTarifa } from '../frontend/src/lib/pricing.js';

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';
const commit = process.argv.includes('--commit');

const tollsData = JSON.parse(readFileSync(new URL('../frontend/src/data/tolls.json', import.meta.url)));
const TOLLS = tollsData.tolls;

const MIN_SPEED_KMH = 15;
const COOLDOWN_MS = 300_000;
const MAX_SEGMENT_M = 2000;

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
      const radius = toll.radio_deteccion_m || 300;
      if (ts - (cooldowns[toll.id] || 0) < COOLDOWN_MS) continue;
      if (!(speed >= MIN_SPEED_KMH && speed < 200)) continue;
      if (dist <= radius) {
        cooldowns[toll.id] = ts;
        crossings.push({ toll, timestamp: ts });
      }
    }
  }
  return crossings;
}

const [liveTrips, existingTrips] = await Promise.all([
  sb('live_trips?select=id,driver,created_at,updated_at,platform,toll_count,total_cost,is_active&is_active=eq.false&order=created_at.desc'),
  sb('trips?select=id&order=created_at.desc&limit=500'),
]);
const tripIds = new Set(existingTrips.map(t => t.id));
const orphans = liveTrips.filter(t => !tripIds.has(t.id));

console.log(`${orphans.length} orphan live_trips found\n`);

let reconstructed = 0, zeroToll = 0, inserted = 0;
for (const lt of orphans) {
  const positions = await sb(`positions?select=lat,lng,speed,created_at&trip_id=eq.${encodeURIComponent(lt.id)}&order=created_at.asc&limit=2000`);
  const crossings = positions.length ? reconstruct(positions) : [];
  const cost = crossings.reduce((s, c) => s + getTarifa(c.toll, new Date(c.timestamp)), 0);
  const routes = [...new Set(crossings.map(c => c.toll.ruta))];

  const startTime = positions.length ? new Date(positions[0].created_at).toISOString() : lt.created_at;
  const endTime = positions.length ? new Date(positions[positions.length - 1].created_at).toISOString() : (lt.updated_at || lt.created_at);

  const label = crossings.length > 0 ? `✓ ${crossings.length} tolls, $${cost}` : (positions.length ? `∅ 0 tolls (${positions.length} positions)` : '∅ 0 tolls (no positions)');
  console.log(`${lt.created_at.slice(0,10)} ${lt.driver.padEnd(25)} ${label}`);

  if (crossings.length > 0) reconstructed++;
  else zeroToll++;

  if (commit) {
    await sb('trips', {
      method: 'POST',
      body: JSON.stringify({
        id: lt.id,
        driver: lt.driver,
        start_time: startTime,
        end_time: endTime,
        total_cost: cost,
        toll_count: crossings.length,
        routes,
        platform: lt.platform || 'web',
        crossings: crossings.map(c => ({
          tollId: c.toll.id, tollNombre: c.toll.nombre, tollRuta: c.toll.ruta,
          tarifa: getTarifa(c.toll, new Date(c.timestamp)),
          timestamp: c.timestamp, inferred: true,
        })),
      }),
    }).catch(e => console.log(`  ! insert failed: ${e.message}`));
    inserted++;
  }
}

console.log(`\n${reconstructed} reconstructed, ${zeroToll} zero-toll${commit ? `, ${inserted} inserted` : ' (dry run — use --commit)'}`);
