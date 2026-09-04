const axios = require('axios');

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

// Public reply, visible to everyone under the original comment.
async function replyToCommentPublic(commentId, message, pageAccessToken) {
  return axios.post(
    `${GRAPH_BASE}/${commentId}/comments`,
    { message },
    { params: { access_token: pageAccessToken } }
  );
}

// Private reply — delivered as a Messenger DM to the commenter, not visible
// publicly. Note Meta's own constraints on this endpoint: only works within
// 7 days of the comment, and is subject to their messaging policy (no
// unsolicited promotional content) — worth keeping in mind as you decide
// what goes here vs. in the public reply.
async function replyToCommentPrivate(commentId, message, pageAccessToken) {
  return axios.post(
    `${GRAPH_BASE}/${commentId}/private_replies`,
    { message },
    { params: { access_token: pageAccessToken } }
  );
}

module.exports = { replyToCommentPublic, replyToCommentPrivate };
