// AdminTeam — visual alignment for the TAGcontrol team.
// Simple diagrams: user journey, how it works, product phases.
// Designed to be readable by both developers and non-technical stakeholders.

// ── User Journey ──────────────────────────────────────────────────────────────

const JOURNEY = [
  { icon: '📱', label: 'Instala',      sub: 'App Store / Play Store',      live: true  },
  { icon: '🔐', label: 'Registro',     sub: 'Nombre + PIN en 30 seg',      live: true  },
  { icon: '🚗', label: 'Inicia viaje', sub: 'Hoy: botón · Próx: auto',     live: true, next: true },
  { icon: '🛣️', label: 'Conduce',      sub: 'GPS activo en background',    live: true  },
  { icon: '🔔', label: 'Peaje',        sub: 'Notificación en tiempo real', live: true  },
  { icon: '📊', label: 'Resumen',      sub: 'Total + historial por viaje', live: true  },
  { icon: '🔗', label: 'Conecta TAG',  sub: 'Verifica cobros reales',      live: false },
  { icon: '⚠️', label: 'Error!',       sub: '"Me cobraron de más"',        live: false },
  { icon: '📢', label: 'Comparte',     sub: 'Momento viral',               live: false },
];

function Journey() {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-start gap-0 min-w-max">
        {JOURNEY.map((step, i) => (
          <div key={step.label} className="flex items-center">
            <div className={`flex flex-col items-center text-center w-[72px]
              ${step.live ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1
                ${step.live
                  ? step.next
                    ? 'bg-yellow-500/20 ring-1 ring-yellow-500/40'
                    : 'bg-green-500/20 ring-1 ring-green-500/30'
                  : 'bg-white/5 ring-1 ring-white/10 ring-dashed'
                }`}>
                {step.icon}
              </div>
              <p className="text-[10px] font-semibold leading-tight">{step.label}</p>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{step.sub}</p>
            </div>
            {i < JOURNEY.length - 1 && (
              <div className={`w-4 h-px mt-[-18px] shrink-0
                ${JOURNEY[i + 1].live ? 'bg-white/20' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-[9px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/40 ring-1 ring-green-500/30" />
          Live
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 ring-1 ring-yellow-500/40" />
          En progreso
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full bg-white/10 ring-1 ring-white/10" style={{borderStyle:'dashed'}} />
          Próximamente
        </span>
      </div>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

const LAYERS = [
  {
    label: 'Usuarios',
    color: 'border-blue-500/30 bg-blue-500/5',
    items: ['iOS App', 'Android App', 'PWA / Browser'],
  },
  {
    label: 'Detección GPS',
    color: 'border-green-500/30 bg-green-500/5',
    items: ['Velocidad ≥15 km/h', 'Segmento A→B (Haversine)', 'Cooldown 120s', 'Inferencia túneles'],
  },
  {
    label: 'Base de datos',
    color: 'border-purple-500/30 bg-purple-500/5',
    items: ['trips (historial)', 'live_trips (activos)', 'positions (GPS 24h)', 'users + budgets'],
  },
  {
    label: 'Agents',
    color: 'border-orange-500/30 bg-orange-500/5',
    items: ['QA (automático)', 'GPS Calibration', 'Analytics', 'Release'],
  },
];

function HowItWorks() {
  return (
    <div className="flex flex-col gap-2">
      {LAYERS.map((layer, i) => (
        <div key={layer.label}>
          <div className={`border rounded-xl px-3 py-2.5 ${layer.color}`}>
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              {layer.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {layer.items.map(item => (
                <span key={item} className="text-[10px] bg-white/5 rounded-lg px-2 py-0.5">
                  {item}
                </span>
              ))}
            </div>
          </div>
          {i < LAYERS.length - 1 && (
            <div className="flex justify-center my-0.5">
              <span className="text-gray-700 text-xs">↓</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Product phases ────────────────────────────────────────────────────────────

const PHASES = [
  {
    label: 'Bloque 1 — Funciona',
    state: 'done',
    items: [
      'GPS detection en tiempo real',
      'Historial de viajes',
      'Notificaciones de peaje',
      'App iOS + Android + PWA',
      'Admin dashboard',
    ],
  },
  {
    label: 'Bloque 0 — Producto inteligente',
    state: 'building',
    items: [
      'Auto-detección de viaje (sin botón)',
      'Conectar cuenta TAG en onboarding',
      'Scraper verifica cobros reales',
    ],
  },
  {
    label: 'Bloque 2 — El diferenciador',
    state: 'next',
    items: [
      'Alerta: "te cobraron de más"',
      'Historial verificado vs GPS',
      'Momento viral del producto',
    ],
  },
  {
    label: 'Bloque 3 — Escala',
    state: 'future',
    items: [
      'Fleet API (B2B empresas)',
      'Multi-país (ARG, COL, MX)',
      'Claude Managed Agents en cloud',
    ],
  },
];

const PHASE_STYLES = {
  done:     { dot: 'bg-green-400',  text: 'text-green-400',  bar: 'bg-green-500/20 border-green-500/30',  label: '✓ Live' },
  building: { dot: 'bg-yellow-400', text: 'text-yellow-400', bar: 'bg-yellow-500/20 border-yellow-500/30', label: '⚡ Construyendo' },
  next:     { dot: 'bg-blue-400',   text: 'text-blue-400',   bar: 'bg-blue-500/10 border-blue-500/20',     label: '→ Siguiente' },
  future:   { dot: 'bg-gray-600',   text: 'text-gray-500',   bar: 'bg-white/3 border-white/10',            label: '◦ Futuro' },
};

function Phases() {
  return (
    <div className="flex flex-col gap-2">
      {PHASES.map(phase => {
        const s = PHASE_STYLES[phase.state];
        return (
          <div key={phase.label} className={`border rounded-xl p-3 ${s.bar}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold">{phase.label}</p>
              <span className={`text-[9px] font-semibold ${s.text}`}>{s.label}</span>
            </div>
            <div className="flex flex-col gap-1">
              {phase.items.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className={`w-1 h-1 rounded-full shrink-0 ${s.dot}`} />
                  <span className="text-[10px] text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <p className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2">
      {children}
    </p>
  );
}

export default function AdminTeam() {
  return (
    <div className="flex flex-col gap-6">

      <div>
        <Label>Flujo del usuario</Label>
        <Journey />
      </div>

      <div>
        <Label>Cómo funciona</Label>
        <HowItWorks />
      </div>

      <div>
        <Label>Fases del producto</Label>
        <Phases />
      </div>

    </div>
  );
}
