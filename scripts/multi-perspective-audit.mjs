#!/usr/bin/env node
/**
 * Multi-Perspective Audit Agent
 *
 * Simula las voces de un equipo interdisciplinario (Tech, Product, UX, Growth)
 * analizando TAGcontrol desde sus ángulos críticos.
 *
 * Uso:
 *   node scripts/multi-perspective-audit.mjs               # all roles
 *   node scripts/multi-perspective-audit.mjs --focus=ux    # solo UX
 *   node scripts/multi-perspective-audit.mjs --format=whatsapp
 *
 * Requiere: ANTHROPIC_API_KEY en env
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Context ───────────────────────────────────────────────────────────────────

const CLAUDE_MD  = existsSync('./CLAUDE.md')  ? readFileSync('./CLAUDE.md', 'utf8')  : '';
const ROADMAP_MD = existsSync('./ROADMAP.md') ? readFileSync('./ROADMAP.md', 'utf8') : '';
const gitLog     = execSync('git log --oneline -15').toString().trim();
const gitStatus  = execSync('git status --short').toString().trim() || 'clean';

const CONTEXT = `
# TAGcontrol — Contexto completo del proyecto

${CLAUDE_MD}

---

## Roadmap actual

${ROADMAP_MD}

---

## Estado del repo
Últimos commits:
${gitLog}

Cambios sin commit: ${gitStatus || 'ninguno'}
`.trim();

// ── Roles ─────────────────────────────────────────────────────────────────────

const ROLES = {
  tech: {
    emoji: '⚙️',
    name:  'Senior Engineer',
    focus: 'arquitectura, seguridad, escalabilidad, deuda técnica',
    questions: [
      'La deuda técnica más crítica que bloquea escalar de 21 a 1000 usuarios',
      'El mayor riesgo de seguridad o pérdida de datos que ves',
      'Una mejora de arquitectura de alto impacto y bajo esfuerzo',
      'El anti-pattern más peligroso que ves en el diseño actual',
    ],
  },
  product: {
    emoji: '📋',
    name:  'Product Manager',
    focus: 'user journey, retención, features, métricas',
    questions: [
      'El mayor punto de fricción en el user journey que haría churn en semana 1',
      'La feature ausente de mayor impacto en retención',
      'El único metric en el que deberían obsesionarse ahora mismo',
      'Una hipótesis de producto que validarías en las próximas 48 horas',
    ],
  },
  ux: {
    emoji: '🎨',
    name:  'UX Designer',
    focus: 'usabilidad móvil, onboarding, notificaciones, flujos para conductores',
    questions: [
      'El problema de usabilidad más grave para un conductor no-técnico',
      'Cómo simplificarías "iniciar viaje" al mínimo absoluto posible',
      'La notificación o alerta que más valor daría al usuario (y cómo redactarla)',
      'Qué perderías en los primeros 5 minutos de onboarding y por qué',
    ],
  },
  growth: {
    emoji: '🚀',
    name:  'Growth Lead',
    focus: 'viralidad, adquisición, monetización, Chile específicamente',
    questions: [
      'El mecanismo viral que falta para que un usuario convenza a otro en Chile',
      'El canal de adquisición que atacarías primero con $0 de presupuesto',
      'Cómo monetizarías sin matar el crecimiento orgánico',
      'La historia de usuario específica que haría que esto se comparta en WhatsApp',
    ],
  },
  ceo: {
    emoji: '👔',
    name:  'CEO / Investor',
    focus: 'riesgo de negocio, competencia, timing, defensibilidad',
    questions: [
      'El mayor riesgo de negocio que ves en los próximos 90 días',
      'Por qué RutaTag u otro competidor podría ganar si no se mueven rápido',
      'Qué haría que este negocio fuera difícil de copiar en 12 meses',
      'La pregunta más incómoda que le harías al equipo hoy',
    ],
  },
};

// ── Runner ────────────────────────────────────────────────────────────────────

async function auditRole(roleKey) {
  const role = ROLES[roleKey];
  const questionsText = role.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    system: `Eres un ${role.name} de una empresa tech top con experiencia en apps de movilidad y fintech en Latinoamérica.
Tu especialidad es: ${role.focus}.
Eres crítico, directo, y NO das halagos vacíos. Identificas problemas reales con recomendaciones específicas.
Contexto: estás en una sesión de 48 horas con el equipo de TAGcontrol para mejorar el producto.`,
    messages: [{
      role: 'user',
      content: `Aquí está el contexto completo del proyecto TAGcontrol:\n\n${CONTEXT}\n\n---\n\nResponde estas ${role.questions.length} preguntas desde tu rol. Máximo 3 líneas por respuesta. Directo, sin intro:\n\n${questionsText}`,
    }],
  });

  return { key: roleKey, ...role, findings: response.content[0].text };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const focus   = args.find(a => a.startsWith('--focus='))?.split('=')[1] ?? 'all';
  const format  = args.find(a => a.startsWith('--format='))?.split('=')[1] ?? 'console';

  const roleKeys = focus === 'all' ? Object.keys(ROLES) : [focus];

  if (!ROLES[focus] && focus !== 'all') {
    console.error(`Role desconocido: "${focus}". Usa: ${Object.keys(ROLES).join(', ')}, all`);
    process.exit(1);
  }

  console.log(`\n🔍  Multi-Perspective Audit — TAGcontrol`);
  console.log(`    Roles: ${roleKeys.join(', ')} | ${new Date().toLocaleString('es-CL')}\n`);

  const results = await Promise.all(roleKeys.map(auditRole));

  if (format === 'whatsapp') {
    const lines = ['*🔍 TAGcontrol — Audit Multi-Perspectiva*', ''];
    for (const r of results) {
      lines.push(`*${r.emoji} ${r.name}*`);
      const short = r.findings.split('\n').slice(0, 6).join('\n');
      lines.push(short);
      lines.push('');
    }
    console.log(lines.join('\n'));
    return;
  }

  for (const r of results) {
    console.log(`\n${'─'.repeat(56)}`);
    console.log(`${r.emoji}  ${r.name.toUpperCase()}  ·  ${r.focus}`);
    console.log('─'.repeat(56));
    console.log(r.findings);
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`✓  Audit completado — ${results.length} perspectivas`);
  console.log('   Agrega hallazgos críticos al ROADMAP.md si corresponde.\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
