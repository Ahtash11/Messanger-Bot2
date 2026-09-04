require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,

  // Comma-separated Facebook post IDs to auto-reply on. Any comment on a
  // post NOT in this list is ignored entirely.
  commentAutoReply: {
    postIds: (process.env.AUTO_REPLY_POST_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  },

  // Where the LIVE, WRITABLE inventory file lives. In production this
  // should point at a Railway Volume mount path (e.g. /data/products.json)
  // so stock changes survive redeploys. If unset, falls back to the
  // bundled src/data/products.json — fine for local testing, but writes
  // there will be lost on redeploy since that file is only a seed/template.
  inventoryFilePath: process.env.INVENTORY_FILE_PATH || null,

  // Optional — set any random string, then visit /debug/inventory?key=that_string
  // in your browser to see the live, current stock numbers directly.
  // Leave unset and the endpoint is open to anyone who finds the URL.
  debugKey: process.env.DEBUG_KEY || null,

  // Where the SQLite database file lives — same idea as inventoryFilePath
  // above: in production this should point at a Railway Volume mount (e.g.
  // /data/store.db) so it survives redeploys. Falls back to a local file
  // under src/data/ if unset, which is fine for local testing.
  databasePath: process.env.DATABASE_PATH || null,

  // Signs the POS/admin login session cookie. Any long random string works
  // — generate one with `openssl rand -hex 32` or similar. Changing it logs
  // everyone out.
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',

  // Used once, on first boot only, to create the initial admin account (so
  // there's a way to log in before any account exists). Ignored on every
  // later boot once at least one user row exists.
  adminBootstrap: {
    username: process.env.ADMIN_USERNAME || null,
    password: process.env.ADMIN_PASSWORD || null,
  },

  messenger: {
    // Single-page setups: just set PAGE_ACCESS_TOKEN as before, nothing
    // else needed.
    //
    // Multi-page setups: set PAGE_ACCESS_TOKENS instead (plural), formatted
    // as "pageId:token,pageId:token,..." — one pair per Facebook Page you
    // want this same bot running on. Every page shares the same catalog,
    // Telegram alerts, and admin chat; only the "which token do I reply
    // with" part differs per page.
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    pageAccessTokens: (process.env.PAGE_ACCESS_TOKENS || '')
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .reduce((map, pair) => {
        const idx = pair.indexOf(':');
        if (idx === -1) return map;
        const pageId = pair.slice(0, idx).trim();
        const token = pair.slice(idx + 1).trim();
        if (pageId && token) map[pageId] = token;
        return map;
      }, {}),
    verifyToken: process.env.VERIFY_TOKEN,
    appSecret: process.env.APP_SECRET,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    // Supports multiple people (comma-separated chat ids), e.g.
    // TELEGRAM_OWNER_CHAT_IDS=111111,222222 — everyone listed gets order
    // alerts/escalation pings, and can all use the admin chat with equal
    // access. TELEGRAM_OWNER_CHAT_ID (singular) still works if you only
    // have one.
    ownerChatIds: (process.env.TELEGRAM_OWNER_CHAT_IDS || process.env.TELEGRAM_OWNER_CHAT_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    // Set via @BotFather-independent random string you choose, then use it
    // when calling Telegram's setWebhook (see README) — Telegram echoes it
    // back on every real webhook call so we can verify authenticity.
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || null,
    // Your bot's @username (no @ symbol), e.g. PorugasOrders_bot — used to
    // detect when someone tags the bot in a group chat. Only needed if
    // you're using a shared group; personal DMs work without it.
    botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  store: {
    name: process.env.STORE_NAME || 'المحل',
    description: process.env.STORE_DESCRIPTION || 'محل تجارة إلكترونية',
  },
};

// Given the Facebook Page id a webhook event came in on, returns the right
// access token to reply with. Falls back to the single PAGE_ACCESS_TOKEN if
// you're only running on one page and never bothered with the plural env
// var — keeps single-page setups working exactly as before.
function getPageAccessToken(pageId) {
  return config.messenger.pageAccessTokens[pageId] || config.messenger.pageAccessToken;
}

// Fail loudly at startup rather than mysteriously later
function assertConfigured() {
  const required = [
    ['PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKENS', config.messenger.pageAccessToken || Object.keys(config.messenger.pageAccessTokens).length > 0 ? 'set' : ''],
    ['VERIFY_TOKEN', config.messenger.verifyToken],
    ['ANTHROPIC_API_KEY', config.anthropic.apiKey],
    ['OPENAI_API_KEY', config.openai.apiKey],
    ['TELEGRAM_BOT_TOKEN', config.telegram.botToken],
    ['TELEGRAM_OWNER_CHAT_IDS (or TELEGRAM_OWNER_CHAT_ID)', config.telegram.ownerChatIds.length > 0 ? 'set' : ''],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing environment variables: ${missing.join(', ')}\n` +
      `The bot will start but related features will fail until these are set in .env`
    );
  }

  if (!config.inventoryFilePath) {
    console.warn(
      '⚠️  INVENTORY_FILE_PATH is not set — using the bundled src/data/products.json ' +
      'directly. Stock changes (from orders) will be LOST on every redeploy. Set up a ' +
      'Railway Volume and point INVENTORY_FILE_PATH at it before going live.'
    );
  }

  if (!config.databasePath) {
    console.warn(
      '⚠️  DATABASE_PATH is not set — using a local file under src/data/. Sales, staff ' +
      'accounts, expenses, and customers will be LOST on every redeploy. Point it at the ' +
      'same Railway Volume as INVENTORY_FILE_PATH before going live (e.g. /data/store.db).'
    );
  }

  if (config.sessionSecret === 'dev-only-insecure-secret-change-me') {
    console.warn('⚠️  SESSION_SECRET is not set — using an insecure default. Set it before going live.');
  }

  if (!config.adminBootstrap.username || !config.adminBootstrap.password) {
    console.warn(
      '⚠️  ADMIN_USERNAME / ADMIN_PASSWORD not set — if no admin account exists yet in the ' +
      'database, you will not be able to log in to /pos or /admin at all.'
    );
  }
}

module.exports = { config, assertConfigured, getPageAccessToken };
