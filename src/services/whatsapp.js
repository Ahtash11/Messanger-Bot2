const axios = require('axios');
const { config } = require('../config');

// IMPORTANT — read this before relying on it in production:
//
// Meta's WhatsApp Cloud API only allows free-form text messages (like the
// order summary below) inside a 24-hour "customer service window" — meaning
// a conversation the recipient (you) started within the last 24 hours.
//
// Practical way to keep the window open: send any message (e.g. "شغال")
// from your own WhatsApp to your WhatsApp Business number once a day, or
// set up a recurring reminder. If more than 24h pass with no message from
// you, this send will fail with an error about the messaging window.
//
// The fully reliable fix is to create an approved message template (e.g.
// "order_notification") in Meta Business Manager and send that instead —
// templates work anytime, no window needed. Once you have one approved,
// swap the payload below for a "template" type payload. Happy to add that
// once you've created the template if you want zero missed orders.

async function sendOrderSummary(summaryText) {
  const url = `https://graph.facebook.com/v19.0/${config.whatsapp.phoneNumberId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: config.whatsapp.ownerNumber,
        type: 'text',
        text: { body: summaryText },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('WhatsApp send error:', err.response?.data || err.message);
    // Don't let a failed WhatsApp send break the customer-facing flow —
    // just log it loudly so you notice in your hosting logs.
  }
}

module.exports = { sendOrderSummary };
