const axios = require('axios');
const { config } = require('../config');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

async function callSendAPI(payload) {
  try {
    await axios.post(GRAPH_URL, payload, {
      params: { access_token: config.messenger.pageAccessToken },
    });
  } catch (err) {
    console.error('Messenger send error:', err.response?.data || err.message);
  }
}

async function sendText(psid, text) {
  // Messenger caps text at 2000 chars; split just in case a summary runs long
  const chunks = text.match(/[\s\S]{1,1900}/g) || [text];
  for (const chunk of chunks) {
    await callSendAPI({
      recipient: { id: psid },
      message: { text: chunk },
    });
  }
}

async function sendImage(psid, imageUrl) {
  await callSendAPI({
    recipient: { id: psid },
    message: {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true },
      },
    },
  });
}

async function sendTypingOn(psid) {
  await callSendAPI({ recipient: { id: psid }, sender_action: 'typing_on' });
}

module.exports = { sendText, sendImage, sendTypingOn };
