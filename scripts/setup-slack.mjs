#!/usr/bin/env node
/**
 * Setup inicial de Slack para TAGcontrol.
 * Crea el canal #tagcontrol-ops y verifica la conexión.
 *
 * Uso:
 *   SLACK_BOT_TOKEN=xoxb-... node scripts/setup-slack.mjs
 *
 * Cómo obtener el token:
 *   1. https://api.slack.com/apps → Create New App → From scratch
 *   2. Nombre: "TAGcontrol Agents" · Workspace: Blooming
 *   3. OAuth & Permissions → Bot Token Scopes:
 *      - channels:manage
 *      - chat:write
 *      - chat:write.public
 *   4. Install to workspace → copiar Bot User OAuth Token
 */

import { createChannel, sendMessage } from './lib/slack.mjs';

const CHANNEL = 'tagcontrol-ops';

async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('Error: SLACK_BOT_TOKEN no encontrado en el env.');
    console.error('Uso: SLACK_BOT_TOKEN=xoxb-... node scripts/setup-slack.mjs');
    process.exit(1);
  }

  console.log(`\n⚡  TAGcontrol Slack Setup\n`);

  // 1. Crear canal
  process.stdout.write(`Creando canal #${CHANNEL}... `);
  try {
    const channel = await createChannel(CHANNEL);
    if (channel.already_existed) {
      console.log('ya existe ✓');
    } else {
      console.log(`creado ✓ (ID: ${channel.id})`);
    }
  } catch (err) {
    console.log(`error: ${err.message}`);
    process.exit(1);
  }

  // 2. Mensaje de bienvenida (requiere webhook configurado)
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    process.stdout.write('Enviando mensaje de prueba... ');
    try {
      await sendMessage({
        text: '🚀 *TAGcontrol Agents conectados* — #tagcontrol-ops está activo.\nLos outputs de QA, Analytics, Audit y Release llegarán acá.',
      }, { webhookUrl });
      console.log('enviado ✓');
    } catch (err) {
      console.log(`error: ${err.message}`);
    }
  } else {
    console.log('\n⚠️  SLACK_WEBHOOK_URL no configurado — los mensajes automáticos no funcionarán.');
    console.log('   Para configurarlo:');
    console.log('   1. En tu app Slack → Incoming Webhooks → Activate');
    console.log('   2. Add New Webhook to Workspace → selecciona #tagcontrol-ops');
    console.log('   3. Copia la URL y agrégala como SLACK_WEBHOOK_URL en tu env');
  }

  console.log('\n✓  Setup completado');
  console.log('   Próximo paso: agrega estas variables a tu .env o shell profile:\n');
  console.log('   SLACK_BOT_TOKEN=xoxb-...');
  console.log('   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
