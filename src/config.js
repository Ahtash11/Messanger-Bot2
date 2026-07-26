require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  mockCatalog: process.env.MOCK_CATALOG === 'true',
  // 'woocommerce' uses woocommerce.js (which also handles MOCK_CATALOG
  // internally). Anything else (including unset) uses your own managed
  // inventory system — src/services/inventory.js + src/data/products.json —
  // which supports live stock tracking and auto-decrementing on order.
  catalogSource: process.env.CATALOG_SOURCE || null,

  // Where the LIVE, WRITABLE inventory file lives. In production this
  // should point at a Railway Volume mount path (e.g. /data/products.json)
  // so stock changes survive redeploys. If unset, falls back to the
  // bundled src/data/products.json — fine for local testing, but writes
  // there will be lost on redeploy since that file is only a seed/template.
  inventoryFilePath: process.env.INVENTORY_FILE_PATH || null,

  messenger: {
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    appSecret: process.env.APP_SECRET,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    ownerChatId: process.env.TELEGRAM_OWNER_CHAT_ID,
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

  woocommerce: {
    url: process.env.WOOCOMMERCE_URL,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  },
};

// Fail loudly at startup rather than mysteriously later
function assertConfigured() {
  const required = [
    ['PAGE_ACCESS_TOKEN', config.messenger.pageAccessToken],
    ['VERIFY_TOKEN', config.messenger.verifyToken],
    ['ANTHROPIC_API_KEY', config.anthropic.apiKey],
    ['OPENAI_API_KEY', config.openai.apiKey],
    ...(config.mockCatalog || config.catalogSource !== 'woocommerce'
      ? []
      : [
          ['WOOCOMMERCE_URL', config.woocommerce.url],
          ['WOOCOMMERCE_CONSUMER_KEY', config.woocommerce.consumerKey],
          ['WOOCOMMERCE_CONSUMER_SECRET', config.woocommerce.consumerSecret],
        ]),
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

  if (!config.mockCatalog && config.catalogSource !== 'woocommerce' && !config.inventoryFilePath) {
    console.warn(
      '⚠️  INVENTORY_FILE_PATH is not set — using the bundled src/data/products.json ' +
      'directly. Stock changes (from orders) will be LOST on every redeploy. Set up a ' +
      'Railway Volume and point INVENTORY_FILE_PATH at it before going live.'
    );
  }
}

module.exports = { config, assertConfigured };
