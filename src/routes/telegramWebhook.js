const express = require('express');
const { config } = require('../config');
const { handleAdminMessage } = require('../services/adminAgent');
const { sendMessage } = require('../services/telegram');

const router = express.Router();

router.post('/', express.json(), async (req, res) => {
  // Security layer 1: if you've set TELEGRAM_WEBHOOK_SECRET, Telegram
  // includes it in this header on every real request. Anything else (e.g.
  // someone guessing your webhook URL and POSTing a fake payload directly)
  // gets rejected before we even look at the message content.
  if (config.telegram.webhookSecret) {
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingSecret !== config.telegram.webhookSecret) {
      return res.sendStatus(403);
    }
  }

  res.sendStatus(200); // acknowledge immediately, Telegram expects a fast response

  const message = req.body?.message;
  if (!message || !message.text) return;

  // Security layer 2: only ever process messages from YOUR chat id — a
  // chat id alone isn't secret, so this check matters even with the
  // secret token above. Anyone else who somehow messages this bot is
  // silently ignored, not just unauthorized-error'd (no point telling a
  // stranger this bot does anything interesting).
  const senderChatId = String(message.chat?.id || '');
  if (senderChatId !== String(config.telegram.ownerChatId)) {
    console.warn(`Telegram admin webhook: ignored message from unauthorized chat id ${senderChatId}`);
    return;
  }

  try {
    const reply = await handleAdminMessage(message.text);
    if (reply) await sendMessage(senderChatId, reply);
  } catch (err) {
    console.error('Admin agent error:', err);
    await sendMessage(senderChatId, 'صار خطأ، جرب مرة ثانية.');
  }
});

module.exports = router;
