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

  // Security layer 2: only ever process messages from an authorized chat id
  // (TELEGRAM_OWNER_CHAT_IDS) — a chat id alone isn't secret, so this check
  // matters even with the secret token above. Anyone else who somehow
  // messages this bot is silently ignored, not just unauthorized-error'd
  // (no point telling a stranger this bot does anything interesting).
  const senderChatId = String(message.chat?.id || '');
  if (!config.telegram.ownerChatIds.includes(senderChatId)) {
    console.warn(`Telegram admin webhook: ignored message from unauthorized chat id ${senderChatId}`);
    return;
  }

  // In a group chat, only respond when the bot is actually tagged —
  // otherwise normal conversation between people in the group would get
  // treated as commands. This check happens in our own code (rather than
  // relying on Telegram's built-in privacy mode) because privacy mode's
  // mention detection can be unreliable, especially mixed with RTL text —
  // this way it works consistently regardless. Personal DMs skip this
  // check entirely, since there's no "normal chatter to ignore" there.
  const isGroup = message.chat?.type === 'group' || message.chat?.type === 'supergroup';
  let text = message.text;

  if (isGroup) {
    if (!config.telegram.botUsername) {
      // No username configured — can't tell what counts as a mention, so
      // ignore group messages entirely rather than risk responding to
      // every message in the group.
      return;
    }
    const mentionPattern = new RegExp(`@${config.telegram.botUsername}\\b`, 'i');
    if (!mentionPattern.test(text)) {
      return; // not addressed to the bot — ignore, this is normal chat
    }
    text = text.replace(mentionPattern, '').trim();
  }

  try {
    const reply = await handleAdminMessage(text, senderChatId);
    if (reply) await sendMessage(senderChatId, reply);
  } catch (err) {
    console.error('Admin agent error:', err);
    await sendMessage(senderChatId, 'صار خطأ، جرب مرة ثانية.');
  }
});

module.exports = router;
