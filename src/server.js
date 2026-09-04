const express = require('express');
const session = require('express-session');
const { config, assertConfigured } = require('./config');
const { router: webhookRouter } = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const adminStaffRouter = require('./routes/adminStaff');
const adminExpensesRouter = require('./routes/adminExpenses');
const adminCustomersRouter = require('./routes/adminCustomers');
const adminOrdersRouter = require('./routes/adminOrders');
const adminReportsRouter = require('./routes/adminReports');
const authRouter = require('./routes/auth');
const posRouter = require('./routes/pos');
const telegramWebhookRouter = require('./routes/telegramWebhook');
const { requireAuth, requireAdmin, bootstrapAdmin } = require('./services/auth');

assertConfigured();
bootstrapAdmin();

const app = express();

// Railway (like most PaaS) terminates HTTPS at its edge and forwards plain
// HTTP to this container — without this, Express sees every request as
// insecure, so the session cookie's `secure: true` flag below would never
// actually get set and logins would silently break in production.
app.set('trust proxy', 1);

// Note: Messenger's request-signature check lives inside routes/webhook.js
// itself now (scoped to just that router) rather than as a global body
// parser here — otherwise every JSON POST on the site (POS checkout,
// admin forms, etc) would be rejected for lacking a Facebook signature
// header they were never going to have.
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

app.get('/', (req, res) => {
  // The meta tag below is for Facebook/Meta Business domain verification —
  // proves you control this server, which is what unlocks App Review
  // without needing formal business registration documents. If you ever
  // need to verify a different domain, get a new tag from Meta's Business
  // Settings > Domains and swap the "content" value below.
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
app.use('/telegram-webhook', telegramWebhookRouter);

// POS/admin system — everything here needs a logged-in session; the
// /admin/* pages additionally require the admin role (employees only get
// the POS screen). See services/auth.js for the login/role logic.
app.use('/', authRouter);
app.use('/pos', requireAuth, posRouter);
app.use('/admin', requireAdmin, adminRouter);
app.use('/admin/staff', requireAdmin, adminStaffRouter);
app.use('/admin/expenses', requireAdmin, adminExpensesRouter);
app.use('/admin/customers', requireAdmin, adminCustomersRouter);
app.use('/admin/pending-orders', requireAdmin, adminOrdersRouter);
app.use('/admin/reports', requireAdmin, adminReportsRouter);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
