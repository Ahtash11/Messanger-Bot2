const express = require('express');
const crypto = require('crypto');
const { config, getPageAccessToken } = require('../config');
const { getSession, saveSession } = require('../services/session');
const { handleMessage, handleImageMessage } = require('../services/claude');
const { transcribeVoiceNote } = require('../services/whisper');
const messenger = require('../services/messenger');
const facebookComments = require('../services/facebookComments');

const router = express.Router();

// Scoped to this router only (not applied globally in server.js) — every
// other route (POS, admin, telegram webhook) parses its own body without
// this Messenger-specific signature check, so a JSON POST there doesn't
// get rejected for lacking a Facebook signature header it was never going
// to have.
router.use(express.json({ verify: verifySignature }));

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
    // entry.id is the Facebook Page this event came in on — needed to pick
    // the right access token when running more than one Page off this same
    // bot (they all share the same catalog/Telegram, just different
    // Messenger credentials).
    const pageId = entry.id;

    // Diagnostic: confirms the webhook actually received something and
    // what shape it was, regardless of whether downstream handling
    // succeeds — this line alone would have shown a "feed" test payload
    // arriving, even before the entry.changes handling below existed.
    console.log(
      `Webhook entry for page ${pageId}: messaging=${(entry.messaging || []).length}, changes=${(entry.changes || []).length}`
    );

    for (const event of entry.messaging || []) {
      handleEvent(event, pageId).catch((err) => console.error('Error handling event:', err));
    }

    for (const change of entry.changes || []) {
      handleCommentEvent(change, pageId).catch((err) => console.error('Error handling comment event:', err));
    }
  }
});

// Handles Page feed changes — specifically new comments on posts you've
// opted into auto-replying on (config.commentAutoReply.postIds).
async function handleCommentEvent(change, pageId) {
  if (change.field !== 'feed') return;

  const value = change.value || {};
  if (value.item !== 'comment' || value.verb !== 'add') return; // ignore edits/deletes/reactions

  if (!config.commentAutoReply.postIds.includes(value.post_id)) return; // not one of our configured posts

  const pageAccessToken = getPageAccessToken(pageId);

  try {
    // Public acknowledgment on the comment thread itself.
    await facebookComments.replyToCommentPublic(
      value.comment_id,
      'شكراً على تعليقك! بنتواصل معاك بالخاص قريب 🙏',
      pageAccessToken
    );

    // Private follow-up (e.g. for anything price/order related). Adjust
    // this message/condition once you've decided the exact public vs.
    // private mapping — currently sends on every matched comment.
    await facebookComments.replyToCommentPrivate(
      value.comment_id,
      'أهلاً! قولي شنو تحب تعرف عن المنتج وأنا نساعدك.',
      pageAccessToken
    );
  } catch (err) {
    console.error('Comment reply error:', err.response?.data || err.message);
  }
}

async function handleEvent(event, pageId) {
  const psid = event.sender?.id;
  if (!psid || !event.message || event.message.is_echo) return;

  const pageAccessToken = getPageAccessToken(pageId);

  await messenger.sendTypingOn(psid, pageAccessToken);

  const session = getSession(psid);
  // Keep the session's page info current — a PSID is already unique per
  // page (Facebook scopes it that way), so this never actually changes for
  // an existing conversation, but it's cheap to just always set it.
  session.pageId = pageId;
  session.pageAccessToken = pageAccessToken;

  // This customer's conversation was escalated to the owner — stop
  // auto-responding until the owner resolves it (via the Telegram admin
  // chat's "استأنف" command), so the bot doesn't talk over a human reply.
  if (session.needsHuman) {
    await messenger.sendText(psid, 'طلبك عند صاحب المحل يشوفه توا، شوي وبيتواصل معاك 🙏', pageAccessToken);
    return;
  }

  const imageAttachment = event.message.attachments?.find((a) => a.type === 'image');
  if (imageAttachment) {
    try {
      const { mediaType, base64 } = await messenger.downloadImageAsBase64(
        imageAttachment.payload.url
      );
      const reply = await handleImageMessage(session, mediaType, base64, psid);
      saveSession(psid, session);
      if (reply) await messenger.sendText(psid, reply, pageAccessToken);
    } catch (err) {
      console.error('Image handling error:', err);
      await messenger.sendText(psid, 'ما قدرتش نشوف الصورة زينة، تقدر تكتبلي شنو المنتج اللي تسأل عليه؟', pageAccessToken);
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
          await messenger.sendText(psid, 'ما سمعتش زينة، تقدر تكتبها؟ 🙏', pageAccessToken);
          return;
        }
      } catch (err) {
        console.error('Transcription error:', err);
        await messenger.sendText(psid, 'صار مشكل في تسجيلك، تقدر تكتبها؟', pageAccessToken);
        return;
      }
    }
  }

  if (!userText) return;

  const reply = await handleMessage(session, userText, psid);
  saveSession(psid, session);

  if (reply) {
    await messenger.sendText(psid, reply, pageAccessToken);
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
