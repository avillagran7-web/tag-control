// Architecture tab — living documentation of TAGcontrol's system and agent layer.
// Update this file when the architecture changes so the team stays aligned.

const PRIMARY = '#2D6A4F';

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2">{title}</p>
      {children}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white/5 rounded-xl p-3 ${className}`}>{children}</div>
  );
}

function Badge({ label, color }) {
  const colors = {
    active:  'bg-green-500/20 text-green-400',
    planned: 'bg-yellow-500/20 text-yellow-400',
    pending: 'bg-blue-500/20 text-blue-400',
    deprecated: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${colors[color] || colors.planned}`}>
      {label}
    </span>
  );
}

function Arrow() {
  return <div className="flex justify-center my-1"><span className="text-gray-600 text-xs">↓</span></div>;
}

// ── System Architecture ───────────────────────────────────────────────────────

function SystemArch() {
  const clients = [
    { label: 'iOS App',     sub: 'Expo SDK 54',        status: 'pending',    note: 'Apple Dev pending' },
    { label: 'Android App', sub: 'Expo SDK 54',        status: 'active',     note: 'EAS preview activo' },
    { label: 'PWA',         sub: 'React 19 + Vite',    status: 'deprecated', note: 'Deprecando → app-only' },
    { label: 'Admin',       sub: '/admin web-only',    status: 'active',     note: 'PIN 2026' },
  ];

  const tables = [
    { name: 'trips',          desc: 'Viajes finalizados con crossings' },
    { name: 'live_trips',     desc: 'Viajes activos en tiempo real' },
    { name: 'live_crossings', desc: 'Peajes cruzados en vivo' },
    { name: 'positions',      desc: 'Cache GPS 24h para reconstrucción' },
    { name: 'users',          desc: 'Usuarios (nombre + PIN hash + email)' },
    { name: 'budgets',        desc: 'Límite mensual por usuario' },
  ];

  const pipeline = [
    { step: 'GPS', detail: 'BestForNavigation · 20m / 3s (foreground) · 50m / 5s (background)' },
    { step: 'Detección', detail: 'Segment-based proximity — distancia al segmento A→B, no solo al punto' },
    { step: 'Speed + Cooldown', detail: '≥15 km/h · 120s cooldown por peaje · radio_deteccion_m por peaje' },
    { step: 'Inferencia real-time', detail: 'inferMissingTolls() — gaps en ROUTE_SEQUENCES durante el viaje' },
    { step: 'Post-trip inference', detail: 'inferPostTrip() — timestamps por haversine / 90 km/h' },
    { step: 'Reconstrucción GPS', detail: 'reconstructFromPositions() — segmentos sobre positions (24h)' },
    { step: 'Persistencia', detail: 'trips INSERT siempre (0 peajes incluidos) + retry 3x' },
  ];

  return (
    <div>
      {/* Clients */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {clients.map(c => (
          <Card key={c.label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold">{c.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{c.sub}</p>
              </div>
              <Badge label={c.status} color={c.status} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 italic">{c.note}</p>
          </Card>
        ))}
      </div>

      <Arrow />

      {/* Supabase */}
      <Card className="mb-2 border border-primary/30">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-primary">Supabase</p>
          <span className="text-[9px] text-gray-500">nttnryildsxllxqfkkvz</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {tables.map(t => (
            <div key={t.name} className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-mono text-primary/80 shrink-0">{t.name}</span>
              <span className="text-[10px] text-gray-500 truncate">{t.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Arrow />

      {/* Detection pipeline */}
      <Card>
        <p className="text-[10px] font-semibold text-gray-400 mb-2">Pipeline de detección</p>
        <div className="flex flex-col gap-1">
          {pipeline.map((p, i) => (
            <div key={p.step} className="flex items-start gap-2">
              <span className="text-[9px] text-gray-600 w-3 shrink-0 pt-0.5">{i + 1}</span>
              <div>
                <span className="text-[10px] font-semibold text-gray-300">{p.step}</span>
                <span className="text-[10px] text-gray-500 ml-1.5">{p.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Build & Deploy */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Card>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">App build</p>
          <p className="text-[10px] text-gray-300">EAS Build</p>
          <p className="text-[10px] text-gray-500">Android: preview APK</p>
          <p className="text-[10px] text-gray-500">iOS: pending Apple Dev</p>
          <p className="text-[10px] text-gray-500 mt-1">Org: @andrespanthervillagran</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">Web deploy</p>
          <p className="text-[10px] text-gray-300">Vercel</p>
          <p className="text-[10px] text-gray-500">git push → auto-deploy</p>
          <p className="text-[10px] text-gray-500 mt-1">Shared logic: frontend/ canonical</p>
          <p className="text-[10px] text-gray-500">check-shared-drift.mjs</p>
        </Card>
      </div>
    </div>
  );
}

// ── Agent Architecture ────────────────────────────────────────────────────────

const AGENTS = [
  {
    emoji: '🔍',
    name: 'QA Agent',
    status: 'planned',
    trigger: 'Supabase RT · cada 10 min',
    detail: 'Viajes 0 peajes · live_trips >2h · positions huérfanas',
    output: '⚠ Alerta en Admin',
    outputDetail: '"Viajes en riesgo"',
  },
  {
    emoji: '📍',
    name: 'GPS Calibration',
    status: 'planned',
    trigger: 'Nuevo viaje completado',
    detail: 'Foot-of-perpendicular por peaje · ≥3 pasadas → propone radio',
    output: '🔀 PR automático',
    outputDetail: 'Coordenadas calibradas en tolls.json',
  },
  {
    emoji: '🛡',
    name: 'Code Review',
    status: 'planned',
    trigger: 'Pre-commit · PR creation',
    detail: 'Drift frontend↔app · .catch() faltantes · queries sin límite',
    output: '🚫 Bloquea o ✅ aprueba',
    outputDetail: 'Comenta en PR si hay issues',
  },
  {
    emoji: '📦',
    name: 'Release Agent',
    status: 'planned',
    trigger: 'Merge a main',
    detail: 'eas build --profile preview · espera APK listo',
    output: '📲 APK distribuido',
    outputDetail: 'Link por WhatsApp al grupo',
  },
  {
    emoji: '📊',
    name: 'Analytics Agent',
    status: 'planned',
    trigger: 'Cron 08:00 Santiago',
    detail: 'Usuarios activos · CLP total · anomalías de detección',
    output: '💬 Resumen diario',
    outputDetail: 'WhatsApp · formato CEO',
  },
];

function AgentArch() {
  return (
    <div className="flex flex-col gap-2">

      {/* Header columns */}
      <div className="grid gap-2 mb-1" style={{ gridTemplateColumns: '1fr 16px 1fr 16px 1fr' }}>
        {['TRIGGER', '', 'AGENT', '', 'OUTPUT'].map((h, i) => (
          <p key={i} className={`text-[9px] font-semibold tracking-widest uppercase ${h ? 'text-gray-500' : ''}`}>{h}</p>
        ))}
      </div>

      {/* Agent rows */}
      {AGENTS.map((a, i) => (
        <div key={a.name} className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 16px 1fr 16px 1fr' }}>

          {/* Trigger */}
          <div className="bg-white/5 rounded-lg p-2.5">
            <p className="text-[11px] font-medium text-gray-300">{a.trigger}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{a.detail}</p>
          </div>

          {/* Arrow */}
          <p className="text-gray-600 text-center text-xs">→</p>

          {/* Agent */}
          <div className="bg-white/5 rounded-lg p-2.5 border border-primary/25">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[11px] font-semibold">{a.emoji} {a.name}</p>
              <Badge label={`#${i + 1}`} color="planned" />
            </div>
          </div>

          {/* Arrow */}
          <p className="text-gray-600 text-center text-xs">→</p>

          {/* Output */}
          <div className="bg-white/5 rounded-lg p-2.5">
            <p className="text-[11px] font-medium text-primary">{a.output}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{a.outputDetail}</p>
          </div>
        </div>
      ))}

      {/* Infra footer */}
      <div className="mt-2 bg-white/5 rounded-xl p-3 flex flex-wrap gap-x-5 gap-y-1">
        {[
          ['Runtime', 'Claude SDK · claude-sonnet-4-6'],
          ['Infra',   'Supabase webhooks · GitHub Actions · Vercel cron'],
          ['Keys',    'SERVICE_ROLE_KEY · GITHUB_TOKEN · EAS_TOKEN'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-1.5">
            <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide">{k}</span>
            <span className="text-[10px] text-gray-400">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminArchitecture() {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Sistema TAGcontrol">
        <SystemArch />
      </Section>
      <Section title="Arquitectura de agents">
        <AgentArch />
      </Section>
    </div>
  );
}
