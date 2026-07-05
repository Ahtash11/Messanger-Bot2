const express = require('express');
const { config, assertConfigured } = require('./config');
const { router: webhookRouter, verifySignature } = require('./routes/webhook');

assertConfigured();

const app = express();

app.use(express.json({ verify: verifySignature }));

app.get('/', (req, res) => {
  res.send('Messenger order bot is running.');
});

app.use('/webhook', webhookRouter);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
