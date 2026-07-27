const axios = require('axios');
const { config } = require('../config');

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text,
    });
  } catch (err) {
    console.error('Telegram send error:', err.response?.data || err.message);
  }
}

async function sendOrderSummary(summaryText) {
  return sendMessage(config.telegram.ownerChatId, summaryText);
}

module.exports = { sendMessage, sendOrderSummary };
