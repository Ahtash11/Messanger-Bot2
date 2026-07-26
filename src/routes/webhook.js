const express = require('express');
const crypto = require('crypto');
const { config } = require('../config');
const { getSession, saveSession } = require('../services/session');
const { handleMessage, handleImageMessage } = require('../services/claude');
const { transcribeVoiceNote } = require('../services/whisper');
const messenger = require('../services/messenger');

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.messenger.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      handleEvent(event).catch((err) => console.error('Error handling event:', err));
    }
  }
});

async function handleEvent(event) {
  const psid = event.sender?.id;
  if (!psid || !event.message || event.message.is_echo) return;

  await messenger.sendTypingOn(psid);

  const session = getSession(psid);

  const imageAttachment = event.message.attachments?.find((a) => a.type === 'image');
  if (imageAttachment) {
    try {
      const { mediaType, base64 } = await messenger.downloadImageAsBase64(
        imageAttachment.payload.url
      );
      const reply = await handleImageMessage(session, mediaType, base64, psid);
      saveSession(psid, session);
      if (reply) await messenger.sendText(psid, reply);
    } catch (err) {
      console.error('Image handling error:', err);
      await messenger.sendText(psid, 'ما قدرتش نشوف الصورة زينة، تقدر تكتبلي شنو المنتج اللي تسأل عليه؟');
    }
    return;
  }

  let userText = null;

  if (event.message.text) {
    userText = event.message.text;
  } else if (event.message.attachments) {
    const audioAttachment = event.message.attachments.find((a) => a.type === 'audio');
    if (audioAttachment) {
      try {
        userText = await transcribeVoiceNote(audioAttachment.payload.url);
        if (!userText) {
          await messenger.sendText(psid, 'ما سمعتش زينة، تقدر تكتبها؟ 🙏');
          return;
        }
      } catch (err) {
        console.error('Transcription error:', err);
        await messenger.sendText(psid, 'صار مشكل في تسجيلك، تقدر تكتبها؟');
        return;
      }
    }
  }

  if (!userText) return;

  const reply = await handleMessage(session, userText, psid);
  saveSession(psid, session);

  if (reply) {
    await messenger.sendText(psid, reply);
  }
}

function verifySignature(req, res, buf) {
  if (!config.messenger.appSecret) return;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) throw new Error('Missing signature');

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', config.messenger.appSecret).update(buf).digest('hex');

  if (signature !== expected) {
    throw new Error('Invalid signature');
  }
}

module.exports = { router, verifySignature };
