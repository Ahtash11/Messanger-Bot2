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
      history: [],
      cart: [],
      customer: {},
      createdAt: Date.now(),
      // Set when the bot escalates to the owner (confusion, upset customer,
      // bank transfer request, etc.) — while true, the bot stops
      // auto-responding to this customer until the owner resolves it.
      needsHuman: false,
      humanHelpReason: null,
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

// Returns every session currently flagged for owner attention — used by
// the admin chat's "list_flagged_customers" tool.
function listFlaggedSessions() {
  return Array.from(sessions.values()).filter((s) => s.needsHuman);
}

module.exports = { getSession, saveSession, resetSession, listFlaggedSessions };
