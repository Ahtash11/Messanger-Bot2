const sessions = new Map();

function getSession(psid) {
  if (!sessions.has(psid)) {
    sessions.set(psid, {
      psid,
      history: [],
      cart: [],
      customer: {},
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
