const axios = require('axios');
const { config } = require('../config');

async function sendOrderSummary(summaryText) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: config.telegram.ownerChatId,
      text: summaryText,
    });
  } catch (err) {
    console.error('Telegram send error:', err.response?.data || err.message);
  }
}

module.exports = { sendOrderSummary };
