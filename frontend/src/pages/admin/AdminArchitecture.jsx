import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
const AdminTeam = lazy(() => import('./AdminTeam'));

// ── Primitives ────────────────────────────────────────────────────────────────

function StatusDot({ state = 'ok' }) {
  const styles = {
    ok:      'bg-green-400',
    pending: 'bg-blue-400',
    warn:    'bg-yellow-400',
    error:   'bg-red-400',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${styles[state]}`} />;
}

function Label({ children }) {
  return (
    <p className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2">{children}</p>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white/5 rounded-xl p-3 ${className}`}>{children}</div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, pulse }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-[26px] font-bold tabular-nums leading-none">{value ?? '—'}</p>
        {pulse && value > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mt-1" />
        )}
      </div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1.5">{label}</p>
      {sub != null && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </Card>
  );
}

// ── Agent row ─────────────────────────────────────────────────────────────────

function AgentRow({ emoji, name, trigger, state = 'ok' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-base leading-none">{emoji}</span>
        <div>
          <p className="text-[11px] font-medium leading-none">{name}</p>
          <p className="text-[9px] text-gray-600 mt-0.5">{trigger}</p>
        </div>
      </div>
      <StatusDot state={state} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminArchitecture({ qaResult }) {
  const [stats, setStats] = useState({ users: null, trips: null, live: null, today: null });

  async function loadStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [u, t, l, td] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('trips').select('*', { count: 'exact', head: true }),
      supabase.from('live_trips').select('*', { count: 'exact', head: true }),
      supabase.from('trips').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
    ]);

    setStats({
      users: u.count ?? 0,
      trips: t.count ?? 0,
      live:  l.count ?? 0,
      today: td.count ?? 0,
    });
  }

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 30_000);
    return () => clearInterval(id);
  }, []);

  const healthy = !qaResult || qaResult.healthy;

  return (
    <div className="flex flex-col gap-5">

      {/* ── System status ─────────────────────────────────────────────────── */}
      <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between
        ${healthy
          ? 'bg-green-500/10 border border-green-500/20'
          : 'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
        <div className="flex items-center gap-2">
          <StatusDot state={healthy ? 'ok' : 'warn'} />
          <span className="text-[11px] font-semibold">
            {healthy
              ? 'Todos los sistemas operativos'
              : `QA: ${qaResult.findings.length} issue${qaResult.findings.length !== 1 ? 's' : ''} detectado${qaResult.findings.length !== 1 ? 's' : ''}`
            }
          </span>
        </div>
        <span className="text-[9px] text-gray-600">actualiza cada 30s</span>
      </div>

      {/* ── Live metrics ──────────────────────────────────────────────────── */}
      <div>
        <Label>En vivo</Label>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Usuarios" value={stats.users} />
          <Stat label="Viajes totales" value={stats.trips} sub={`${stats.today ?? '—'} hoy`} />
          <Stat label="Live ahora" value={stats.live} pulse />
        </div>
      </div>

      {/* ── Agents ────────────────────────────────────────────────────────── */}
      <div>
        <Label>Agents</Label>
        <Card>
          <AgentRow emoji="🔍" name="QA Agent"         trigger="Auto · cada carga Admin"              state={healthy ? 'ok' : 'warn'} />
          <AgentRow emoji="📍" name="GPS Calibration"  trigger="node scripts/gps-calibration-agent.mjs" state="ok" />
          <AgentRow emoji="📊" name="Analytics"        trigger="node scripts/analytics-agent.mjs"      state="ok" />
          <AgentRow emoji="🛡" name="Code Review"      trigger="node scripts/code-review-agent.mjs"    state="ok" />
          <AgentRow emoji="📦" name="Release"          trigger="node scripts/release-agent.mjs"        state="ok" />
        </Card>
      </div>

      {/* ── Build & deploy ────────────────────────────────────────────────── */}
      <div>
        <Label>Build & Deploy</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <div className="flex items-center gap-1.5 mb-1.5">
              <StatusDot state="pending" />
              <p className="text-[11px] font-semibold">iOS App</p>
            </div>
            <p className="text-[10px] text-gray-400">Build 5 · Apple Review</p>
            <p className="text-[10px] text-gray-600 mt-0.5">co.blooming.tagcontrol</p>
          </Card>
          <Card>
            <div className="flex items-center gap-1.5 mb-1.5">
              <StatusDot state="ok" />
              <p className="text-[11px] font-semibold">Android + PWA</p>
            </div>
            <p className="text-[10px] text-gray-400">EAS preview · Vercel live</p>
            <p className="text-[10px] text-gray-600 mt-0.5">tagcontrol.vercel.app</p>
          </Card>
        </div>
      </div>

      {/* ── Detection pipeline ────────────────────────────────────────────── */}
      <div>
        <Label>Pipeline de detección</Label>
        <Card>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {[
              'GPS',
              'Segmento A→B',
              '≥15 km/h',
              'Cooldown 120s',
              'Inferencia',
              'Reconstrucción',
              'Supabase',
            ].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-300">{step}</span>
                {i < arr.length - 1 && (
                  <span className="text-gray-700 text-[10px]">→</span>
                )}
              </span>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}
