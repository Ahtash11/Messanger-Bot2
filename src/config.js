require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,

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

  messenger: {
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    appSecret: process.env.APP_SECRET,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    ownerChatId: process.env.TELEGRAM_OWNER_CHAT_ID,
    // Set via @BotFather-independent random string you choose, then use it
    // when calling Telegram's setWebhook (see README) — Telegram echoes it
    // back on every real webhook call so we can verify authenticity.
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || null,
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

// Fail loudly at startup rather than mysteriously later
function assertConfigured() {
  const required = [
    ['PAGE_ACCESS_TOKEN', config.messenger.pageAccessToken],
    ['VERIFY_TOKEN', config.messenger.verifyToken],
    ['ANTHROPIC_API_KEY', config.anthropic.apiKey],
    ['OPENAI_API_KEY', config.openai.apiKey],
    ['TELEGRAM_BOT_TOKEN', config.telegram.botToken],
    ['TELEGRAM_OWNER_CHAT_ID', config.telegram.ownerChatId],
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
}

module.exports = { config, assertConfigured };
