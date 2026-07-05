// Simple in-memory session store, keyed by Messenger PSID (per-customer id).
//
// NOTE: this resets whenever the server restarts. That's fine to launch with —
// most orders happen in one sitting. When you want conversations to survive
// restarts/deploys, swap this file's internals for Redis or a small database
// table (same three functions: getSession, saveSession, resetSession) and
// nothing else in the codebase needs to change.

const sessions = new Map();

function getSession(psid) {
  if (!sessions.has(psid)) {
    sessions.set(psid, {
      psid,
      history: [], // Claude message history: [{role, content}]
      cart: [], // [{ product_id, name, price, quantity, variant }]
      customer: {}, // { name, phone, address, notes }
      createdAt: Date.now(),
    });
  }
  return sessions.get(psid);
}

function saveSession(psid, session) {
  sessions.set(psid, session);
}

function resetSession(psid) {
  sessions.delete(psid);
}

module.exports = { getSession, saveSession, resetSession };
