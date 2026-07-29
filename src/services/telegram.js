const axios = require('axios');
const { config } = require('../config');

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  try {
    const { data } = await axios.post(url, {
      chat_id: chatId,
      text,
    });
    return data?.result?.message_id || null;
  } catch (err) {
    console.error('Telegram send error:', err.response?.data || err.message);
    return null;
  }
}

async function pinMessage(chatId, messageId) {
  if (!messageId) return;
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/pinChatMessage`;

  try {
    // Notification left ON deliberately — pinning triggers Telegram's
    // separate "📌 pinned a message" alert, which is the whole point here:
    // a second, distinct ping on top of the normal message notification.
    await axios.post(url, { chat_id: chatId, message_id: messageId });
  } catch (err) {
    console.error('Telegram pin error:', err.response?.data || err.message);
  }
}

async function unpinMessage(chatId, messageId) {
  if (!messageId) return;
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/unpinChatMessage`;

  try {
    await axios.post(url, { chat_id: chatId, message_id: messageId });
  } catch (err) {
    console.error('Telegram unpin error:', err.response?.data || err.message);
  }
}

async function sendOrderSummary(summaryText) {
  return Promise.all(config.telegram.ownerChatIds.map((chatId) => sendMessage(chatId, summaryText)));
}

module.exports = { sendMessage, sendOrderSummary, pinMessage, unpinMessage };
