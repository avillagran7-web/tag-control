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

function AgentArch() {
  const agents = [
    {
      name: 'QA Agent',
      status: 'planned',
      trigger: 'Supabase realtime · cada 10 min',
      does: 'Detecta viajes con 0 peajes, positions huérfanas, live_trips abiertas >2h, anomalías de costo',
      output: 'Alerta en Admin "Viajes en riesgo" + notificación a Andrés',
      priority: 1,
    },
    {
      name: 'GPS Calibration Agent',
      status: 'planned',
      trigger: 'Trigger: nuevo viaje completado con positions',
      does: 'Corre foot-of-perpendicular por peaje. Si ≥3 pasadas, propone actualizar radio_deteccion_m en tolls.json',
      output: 'PR automático con nuevas coordenadas calibradas',
      priority: 2,
    },
    {
      name: 'Code Review Agent',
      status: 'planned',
      trigger: 'Pre-commit hook + PR creation',
      does: 'Verifica drift frontend↔app, detecta .then(()=>{}) sin catch, queries sin límite, patrones inseguros',
      output: 'Bloquea commit si hay drift. Comenta en PR si hay issues.',
      priority: 3,
    },
    {
      name: 'Release Agent',
      status: 'planned',
      trigger: 'Merge a main en GitHub',
      does: 'Corre eas build --profile preview, espera APK, lo distribuye al grupo interno',
      output: 'Link de descarga APK por WhatsApp al grupo familiar + early users',
      priority: 4,
    },
    {
      name: 'Analytics Agent',
      status: 'planned',
      trigger: 'Cron diario 08:00 Santiago',
      does: 'Usuarios activos ayer, viajes, CLP total, anomalías (usuario sin viajes, 0 peajes en 3 viajes seguidos)',
      output: 'Resumen diario en formato WhatsApp/Slack',
      priority: 5,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Card className="border border-yellow-500/20">
        <p className="text-[10px] text-yellow-400 font-semibold mb-1">Estado actual</p>
        <p className="text-[10px] text-gray-400">
          Todos los agents están <span className="text-yellow-400">planificados</span> — la arquitectura está diseñada,
          la implementación arranca próxima sesión. El QA Agent tiene prioridad 1 por impacto directo en confiabilidad.
        </p>
      </Card>

      {agents.map(a => (
        <Card key={a.name}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 font-mono">{a.priority}</span>
              <p className="text-sm font-semibold">{a.name}</p>
            </div>
            <Badge label={a.status} color={a.status} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <span className="text-[9px] text-gray-600 w-12 shrink-0 pt-0.5 uppercase tracking-wide">Trigger</span>
              <span className="text-[10px] text-gray-400">{a.trigger}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[9px] text-gray-600 w-12 shrink-0 pt-0.5 uppercase tracking-wide">Hace</span>
              <span className="text-[10px] text-gray-400">{a.does}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[9px] text-gray-600 w-12 shrink-0 pt-0.5 uppercase tracking-wide">Output</span>
              <span className="text-[10px] text-primary">{a.output}</span>
            </div>
          </div>
        </Card>
      ))}

      <Card className="border border-primary/20">
        <p className="text-[10px] text-gray-400 font-semibold mb-1">Infraestructura de agents</p>
        <div className="flex flex-col gap-1">
          {[
            ['Runtime',   'Claude Code SDK (claude-sonnet-4-6 por defecto)'],
            ['Triggers',  'Supabase webhooks · GitHub Actions · cron en Vercel'],
            ['Auth',      'SUPABASE_SERVICE_ROLE_KEY · GITHUB_TOKEN · EAS_TOKEN'],
            ['Logs',      'Admin tab "Agents" (próximo) + output en terminal'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-[9px] text-gray-600 w-14 shrink-0 pt-0.5 uppercase tracking-wide">{k}</span>
              <span className="text-[10px] text-gray-400">{v}</span>
            </div>
          ))}
        </div>
      </Card>
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
