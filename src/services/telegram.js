const axios = require('axios');
const { config } = require('../config');

// Sends the order summary to your personal Telegram, via a bot you control.
// Much simpler than WhatsApp's Cloud API: no business number registration,
// no 24-hour messaging window — just a bot token and your chat id.
async function sendOrderSummary(summaryText) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: config.telegram.ownerChatId,
      text: summaryText,
    });
  } catch (err) {
    console.error('Telegram send error:', err.response?.data || err.message);
    // Don't let a failed notification break the customer-facing flow —
    // just log it loudly so you notice in your hosting logs.
  }
}

module.exports = { sendOrderSummary };
