const axios = require('axios');
const { config } = require('../config');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

// accessToken is required now — callers must pass the token for the
// specific Facebook Page this message belongs to (resolved via
// config.getPageAccessToken(pageId) in the webhook). Falls back to the
// single PAGE_ACCESS_TOKEN if none is passed, so any old call site that
// forgets the new argument still works for single-page setups.
async function callSendAPI(payload, accessToken) {
  try {
    await axios.post(GRAPH_URL, payload, {
      params: { access_token: accessToken || config.messenger.pageAccessToken },
    });
  } catch (err) {
    console.error('Messenger send error:', err.response?.data || err.message);
  }
}

async function sendText(psid, text, accessToken) {
  const chunks = text.match(/[\s\S]{1,1900}/g) || [text];
  for (const chunk of chunks) {
    await callSendAPI(
      {
        recipient: { id: psid },
        message: { text: chunk },
      },
      accessToken
    );
  }
}

async function sendImage(psid, imageUrl, accessToken) {
  await callSendAPI(
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    },
    accessToken
  );
}

async function sendTypingOn(psid, accessToken) {
  await callSendAPI({ recipient: { id: psid }, sender_action: 'typing_on' }, accessToken);
}

async function downloadImageAsBase64(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const mediaType = response.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return { mediaType, base64 };
}

module.exports = { sendText, sendImage, sendTypingOn, downloadImageAsBase64 };
