const express = require('express');
const { config, assertConfigured } = require('./config');
const { router: webhookRouter, verifySignature } = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const telegramWebhookRouter = require('./routes/telegramWebhook');

assertConfigured();

const app = express();

app.use(express.json({ verify: verifySignature }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="facebook-domain-verification" content="21gp4h4wiitfo1lkrbgh7gdlnhrbzf" />
  <title>Messenger order bot</title>
</head>
<body>
  Messenger order bot is running.
</body>
</html>`);
});

// Visit this in your browser to see the LIVE, current stock numbers —
// useful for confirming stock actually decremented after an order, since
// that data lives on the Railway Volume, not in GitHub.
// Example: https://yourapp.up.railway.app/debug/inventory?key=your_secret
app.get('/debug/inventory', (req, res) => {
  if (config.debugKey && req.query.key !== config.debugKey) {
    return res.status(403).send('Forbidden — add ?key=your_secret to the URL');
  }
  const inventory = require('./services/inventory');
  res.json(inventory.getRawInventory());
});

app.use('/webhook', webhookRouter);
app.use('/admin', adminRouter);
app.use('/telegram-webhook', telegramWebhookRouter);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
