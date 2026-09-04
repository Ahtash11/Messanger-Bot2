# Messenger order bot + in-store POS (Libyan dialect)

A Messenger DM bot that chats in Libyan dialect, understands voice notes,
looks up your own product catalog, sends product photos, takes orders, and
pings your Telegram with a clean order summary when a customer confirms —
plus an in-store POS/admin system (`/pos`, `/admin`) that shares the exact
same live stock, so an in-store sale and an online order never disagree
about what's left.

## How it works

Customer message → Messenger webhook → (voice notes go through Whisper first)
→ Claude (Libyan dialect + order logic, looks up your catalog as a tool) →
replies to the customer + sends product photos when relevant → when the
order is confirmed, stock is reduced, the order is saved (status "pending
pickup" until the Darb Assabil courier collects it), and you get a Telegram
summary.

In the shop, employees log in at `/pos` to ring up walk-in sales on a
tap-to-add screen — the same SQLite database backs both the bot and the
POS, so a product sold online is already reflected in what an employee sees
on the shop floor. The owner manages products, staff accounts, expenses,
customers, pending online pickups, and sales reports at `/admin`.

## 1. Get your keys (do this first)

You need five sets of credentials. None of these can be set up by me — they
require you to click "create"/"approve" on your own accounts.

### A. Meta app + Messenger

1. Go to developers.facebook.com → My Apps → Create App → "Other" → "Business".
2. Add the **Messenger** product to the app.
3. Under Messenger → Settings, generate a **Page Access Token** for your Facebook Page → put it in `PAGE_ACCESS_TOKEN`.
4. Note your **App Secret** (App Settings → Basic) → put it in `APP_SECRET`.
5. Make up any random string yourself → put it in `VERIFY_TOKEN`.
6. Deploy the bot first (see Section 3) so you have a public URL.
7. In Messenger → Settings → Webhooks, add your `/webhook` URL and `VERIFY_TOKEN`.
8. Subscribe to webhook fields: `messages`, `messaging_postbacks`.
9. Subscribe your Page to the app.
10. Meta requires App Review before the public (not just admins/testers) can message the bot.

### B. Telegram (for order summaries to you)

1. Open Telegram, search for **@BotFather**, start a chat, send `/newbot`.
2. Give it a name and username (must end in `bot`).
3. Copy the token it gives you → `TELEGRAM_BOT_TOKEN`.
4. Search **@userinfobot**, start a chat, copy your numeric Id → `TELEGRAM_OWNER_CHAT_ID`.
5. Message your new bot at least once (required before it can message you back).

### C. Anthropic (Claude)

Get an API key at console.anthropic.com → `ANTHROPIC_API_KEY`.

### D. OpenAI (Whisper, for voice notes)

Get an API key at platform.openai.com → `OPENAI_API_KEY`.

### E. Products & the POS/admin login

There's no external product source (no WooCommerce) — the catalog lives in
this project's own SQLite database, managed either from the owner's
Telegram chat (conversationally: "زيد قميص أسود...") or from `/admin` in
the browser.

Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` before the first boot —
that creates the one initial admin login (ignored on every later boot once
any account exists). Log in at `/login`, then create employee accounts from
`/admin/staff`.

Set `SESSION_SECRET` to any long random string (`openssl rand -hex 32`).

## 2. Run it locally first

```bash
cp env.example .env
npm install
node scripts/migrate-products-json-to-sqlite.js   # one-time: imports src/data/products.json
npm start
```

## 3. Deploy (Railway)

1. Push this project to a GitHub repo.
2. railway.app → New Project → Deploy from GitHub repo.
3. Paste your env vars into the Variables tab.
4. Add a Railway Volume, mount it (e.g. at `/data`), and set
   `INVENTORY_FILE_PATH=/data/products.json` and `DATABASE_PATH=/data/store.db`
   so stock, sales, staff accounts, expenses, and customers all survive
   redeploys.
5. Generate a public domain under Settings → Networking.
6. Run the migration script once against the deployed database (Railway →
   your service → the "Shell" / one-off command feature) if you're bringing
   over existing products.

## 4. Test it

Message your Page from an admin/tester account. Try a text question, a
voice note, and a full order to confirm the Telegram summary arrives and
the order shows up under `/admin/pending-orders`.

Log in at `/pos` as an employee and `/admin` as the admin account to try
the in-store side: ring up a sale, check it appears in `/admin/reports`,
and confirm stock dropped by revisiting `/admin`.

## Known limitations

- Chat session memory (Messenger + Telegram admin chat) is in-memory —
  resets on restart/redeploy. Login sessions (`/pos`, `/admin`) are also
  in-memory, so everyone gets logged out on redeploy too.
- Whisper + Libyan dialect isn't perfect; bot asks to retype if unclear.
- Telegram bot must be messaged first before it can reply to you.
- App Review required before non-admin Facebook accounts can use the bot.
- "Cash expected in the store" assumes all logged expenses are paid out of
  the till — there's no separate "paid from" tracking yet.

## Project structure

```
src/
  config.js
  server.js
  db.js                    -- SQLite connection + schema bootstrap
  db/schema.sql
  routes/
    webhook.js              -- Messenger
    telegramWebhook.js       -- owner's Telegram admin chat
    auth.js                  -- /login, /logout
    pos.js                    -- in-store checkout screen
    admin.js                   -- product CRUD
    adminStaff.js
    adminExpenses.js
    adminCustomers.js
    adminOrders.js             -- pending online pickups
    adminReports.js
  services/
    claude.js                -- customer-facing bot
    adminAgent.js              -- owner's Telegram admin bot
    catalog.js, inventory.js   -- shared product/stock data (SQLite)
    sales.js                   -- atomic in-store checkout
    orders.js, customers.js, expenses.js, reports.js
    auth.js                    -- login/session/staff accounts
    messenger.js, whisper.js, telegram.js, facebookComments.js, session.js
  views/layout.js             -- shared HTML shell for POS/admin pages
scripts/
  migrate-products-json-to-sqlite.js
```
