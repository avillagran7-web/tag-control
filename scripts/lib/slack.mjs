/**
 * Slack integration helper for TAGcontrol agents.
 *
 * Setup (una vez):
 *   1. Ir a https://api.slack.com/apps → Create New App → From scratch
 *   2. Nombre: "TAGcontrol Agents", Workspace: Blooming
 *   3. OAuth & Permissions → Bot Token Scopes: channels:manage, chat:write, chat:write.public
 *   4. Install to workspace → copiar "Bot User OAuth Token" (xoxb-...)
 *   5. Incoming Webhooks → Activate → Add New Webhook → canal #tagcontrol-ops → copiar URL
 *   6. Agregar al env: SLACK_BOT_TOKEN=xoxb-... y SLACK_WEBHOOK_URL=https://hooks.slack.com/...
 */

const BOT_TOKEN   = process.env.SLACK_BOT_TOKEN;
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const API         = 'https://slack.com/api';

// ── Create channel ────────────────────────────────────────────────────────────

export async function createChannel(name) {
  if (!BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN no configurado');

  const res = await fetch(`${API}/conversations.create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, is_private: false }),
  });

  const data = await res.json();
  if (!data.ok && data.error !== 'name_taken') {
    throw new Error(`Slack error: ${data.error}`);
  }

  return data.channel ?? { name, already_existed: true };
}

// ── Send message via webhook ──────────────────────────────────────────────────

export async function sendMessage(text, options = {}) {
  const url = options.webhookUrl ?? WEBHOOK_URL;
  if (!url) throw new Error('SLACK_WEBHOOK_URL no configurado');

  const body = typeof text === 'string'
    ? { text }
    : text;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
  return true;
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function agentBlock(agentName, content, status = 'ok') {
  const emoji = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '🚨';
  return {
    text: `${emoji} *${agentName}*\n${content}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${agentName}*\n${content}`,
        },
      },
      { type: 'divider' },
    ],
  };
}

export function isConfigured() {
  return !!(BOT_TOKEN || WEBHOOK_URL);
}
