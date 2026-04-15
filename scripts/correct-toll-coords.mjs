#!/usr/bin/env node
// Fetch Francisco's GPS positions and compute closest-approach corrections
// for tolls: Centenario, Kennedy (AVO), Viel/Mapocho (NS).

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';

const TOLLS = [
  { id: 'cn-p2.2',  nombre: 'Centenario',     lat: -33.4153, lng: -70.6077, radio: 300 },
  { id: 'avo-ken',  nombre: 'Kennedy (AVO)',  lat: -33.4220, lng: -70.6030, radio: 250 },
  { id: 'ac-pa13',  nombre: 'Viel/Mapocho',   lat: -33.4489, lng: -70.6596, radio: 300 },
];

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function hav(a, b) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat), la2 = toR(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Perpendicular foot on segment A->B from point P (equirectangular)
function footOnSegment(A, B, P) {
  const toR = d => d * Math.PI / 180;
  const latRef = toR((A.lat + B.lat) / 2);
  const scale = 111320;
  const ax = A.lng * Math.cos(latRef) * scale, ay = A.lat * 111320;
  const bx = B.lng * Math.cos(latRef) * scale, by = B.lat * 111320;
  const px = P.lng * Math.cos(latRef) * scale, py = P.lat * 111320;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-6) return { ...A, dist: hav(A, P) };
  let t = ((px-ax)*dx + (py-ay)*dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const fx = ax + t*dx, fy = ay + t*dy;
  const flat = fy / 111320;
  const flng = fx / (Math.cos(latRef) * scale);
  return { lat: flat, lng: flng, dist: hav({lat:flat,lng:flng}, P) };
}

const trips = await sb(`live_trips?select=id,driver,created_at,platform&platform=eq.android&order=created_at.desc`);
console.log(`Found ${trips.length} Android trips`);

{
  const allByToll = Object.fromEntries(TOLLS.map(t => [t.id, []]));
  for (const trip of trips) {
    const pos = await sb(`positions?select=lat,lng,created_at&trip_id=eq.${trip.id}&order=created_at.asc&limit=2000`);
    if (!pos.length) continue;
    console.log(`\nTrip ${trip.id} (${trip.created_at}) — ${pos.length} positions`);

    for (const toll of TOLLS) {
      let best = { dist: Infinity };
      for (let i = 0; i < pos.length - 1; i++) {
        const f = footOnSegment(pos[i], pos[i+1], toll);
        if (f.dist < best.dist) best = { ...f, idx: i, t: pos[i].created_at };
      }
      const origDist = hav(toll, best);
      if (best.dist < 500) {
        console.log(`  ${toll.nombre}: closest ${best.dist.toFixed(0)}m at ${best.t} → foot lat=${best.lat.toFixed(6)}, lng=${best.lng.toFixed(6)} (shift ${origDist.toFixed(0)}m from current)`);
        allByToll[toll.id].push({ lat: best.lat, lng: best.lng, dist: best.dist });
      }
    }
  }

  console.log('\n=== Aggregate (median foot across all passes) ===');
  const median = arr => { const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  for (const toll of TOLLS) {
    const pts = allByToll[toll.id];
    if (!pts.length) { console.log(`${toll.nombre}: no passes`); continue; }
    const mLat = median(pts.map(p => p.lat));
    const mLng = median(pts.map(p => p.lng));
    const shift = hav(toll, { lat: mLat, lng: mLng });
    console.log(`${toll.nombre}: ${pts.length} passes, median foot lat=${mLat.toFixed(6)}, lng=${mLng.toFixed(6)} (shift ${shift.toFixed(0)}m from current ${toll.lat}, ${toll.lng})`);
  }
}
