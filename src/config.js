require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  mockCatalog: process.env.MOCK_CATALOG === 'true',
  // 'darb' switches product lookup to Darb Assabil (manual products.json +
  // their live stock API). Anything else falls back to woocommerce.js,
  // which handles MOCK_CATALOG itself.
  catalogSource: process.env.CATALOG_SOURCE || null,

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

  darb: {
    baseUrl: 'https://v2.sabil.ly',
    apiKey: process.env.DARB_API_KEY,
    accountId: process.env.DARB_ACCOUNT_ID,
    warehouseId: process.env.DARB_WAREHOUSE_ID, // optional
  },
};

// Fail loudly at startup rather than mysteriously later
function assertConfigured() {
  const required = [
    ['PAGE_ACCESS_TOKEN', config.messenger.pageAccessToken],
    ['VERIFY_TOKEN', config.messenger.verifyToken],
    ['ANTHROPIC_API_KEY', config.anthropic.apiKey],
    ['OPENAI_API_KEY', config.openai.apiKey],
    ...(config.mockCatalog || config.catalogSource === 'darb'
      ? []
      : [
          ['WOOCOMMERCE_URL', config.woocommerce.url],
          ['WOOCOMMERCE_CONSUMER_KEY', config.woocommerce.consumerKey],
          ['WOOCOMMERCE_CONSUMER_SECRET', config.woocommerce.consumerSecret],
        ]),
    ...(config.catalogSource === 'darb'
      ? [
          ['DARB_API_KEY', config.darb.apiKey],
          ['DARB_ACCOUNT_ID', config.darb.accountId],
        ]
      : []),
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
}

module.exports = { config, assertConfigured };
