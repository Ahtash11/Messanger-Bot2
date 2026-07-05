# Messenger order bot (Libyan dialect)

A Messenger DM bot that chats in Libyan dialect, understands voice notes,
looks up your WooCommerce catalog, sends product photos, takes orders, and
pings your Telegram with a clean order summary when a customer confirms.

## How it works

Customer message → Messenger webhook → (voice notes go through Whisper first)
→ Claude (Libyan dialect + order logic, looks up your WooCommerce catalog as
a tool) → replies to the customer + sends product photos when relevant →
when the order is confirmed, sends you a Telegram summary.

## 1. Get your keys (do this first)

You need five sets of credentials. None of these can be set up by me — they
require you to click "create"/"approve" on your own accounts.

### A. Meta app + Messenger

1. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → "Other" → "Business".
2. Add the **Messenger** product to the app.
3. Under Messenger → Settings, generate a **Page Access Token** for your Facebook Page → put it in `PAGE_ACCESS_TOKEN`.
4. Note your **App Secret** (App Settings → Basic) → put it in `APP_SECRET`.
5. Make up any random string yourself (e.g. `libya-bot-2026-xyz`) → put it in `VERIFY_TOKEN`. You'll enter this same string in Meta's dashboard in step 8.
6. Deploy the bot first (see Section 3) so you have a public URL, e.g. `https://yourapp.up.railway.app`.
7. In Messenger → Settings → Webhooks, click "Add Callback URL": use `https://yourapp.up.railway.app/webhook` as the URL and your `VERIFY_TOKEN` string as the token.
8. Subscribe to these webhook fields: `messages`, `messaging_postbacks`.
9. Subscribe your Page to the app (same settings page).
10. Meta requires **App Review** before you can message the public (not just admins/testers of the app) — submit for the `pages_messaging` permission once you've tested it working with your own account.

### B. Telegram (for order summaries to you)

1. Open Telegram, search for **@BotFather**, start a chat with it.
2. Send `/newbot`, give it a name and a username (must end in `bot`, e.g. `mystore_orders_bot`).
3. BotFather replies with a token like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` → put it in `TELEGRAM_BOT_TOKEN`.
4. Now get your own chat id: search for **@userinfobot** in Telegram, start a chat with it, it immediately replies with your numeric **Id** → put it in `TELEGRAM_OWNER_CHAT_ID`.
5. Last step: open a chat with the bot you just created (search its username) and send it any message, e.g. "hi". This is required — Telegram bots can't message you until you've messaged them first at least once.

That's it — no window expiry, no business number, no approval wait.

### C. Anthropic (Claude)

Get an API key at [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY`.

### D. OpenAI (Whisper, for voice notes)

Get an API key at [platform.openai.com](https://platform.openai.com) → `OPENAI_API_KEY`.

### E. WooCommerce

In your WordPress admin: WooCommerce → Settings → Advanced → REST API → Add key.
Give it **Read** permissions. Copy the Consumer Key/Secret into
`WOOCOMMERCE_CONSUMER_KEY` / `WOOCOMMERCE_CONSUMER_SECRET`, and your store's
base URL into `WOOCOMMERCE_URL` (e.g. `https://yourstore.com`, no trailing slash).

## 2. Run it locally first

```bash
cp .env.example .env
# fill in .env with the keys above
npm install
npm start
```

You won't be able to receive real Messenger events until it's deployed
with a public HTTPS URL (Meta requires HTTPS), but this confirms the server
boots and there are no typos in your `.env`.

## 3. Deploy (Railway)

1. Push this project to a GitHub repo.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. Railway auto-detects Node and runs `npm start`.
4. In the Railway project → Variables tab, paste in everything from your `.env` file.
5. Railway gives you a public URL like `https://yourapp.up.railway.app` — use that as your webhook URL in Meta (Section 1A, step 7).

Render works the same way if you'd rather use that instead.

## 4. Test it

Message your Facebook Page from an account that's an admin/tester on the
app (before App Review is approved, only these accounts can message the
bot). Try:
- A plain text product question
- A voice note asking about a product
- Confirming an order all the way through — check your Telegram chat with the bot for the summary

## Known limitations to know about going in

- **Session memory is in-memory** (`src/services/session.js`) — conversations reset if the server restarts or redeploys. Fine to launch with; swap to Redis/a DB table later if you want conversations to survive restarts.
- **Whisper and Libyan dialect**: works reasonably but isn't perfect — see the comment in `src/services/whisper.js`. The bot is prompted to ask the customer to type it again if transcription looks empty/garbled.
- **Telegram bot must be messaged first**: if summaries stop arriving, check you (and only you, since `TELEGRAM_OWNER_CHAT_ID` is fixed to your chat) have messaged the bot at least once — Telegram won't let a bot message someone who's never started a chat with it.
- **App Review**: until Meta approves `pages_messaging`, only admins/testers of your Facebook App can message the bot.

## Project structure

```
src/
  config.js              # loads .env
  server.js              # Express app entry point
  routes/webhook.js       # Messenger webhook (verification + incoming events)
  services/
    claude.js             # system prompt, tools, and the agent loop
    messenger.js           # Send API — text, images, typing indicator
    whisper.js              # voice note transcription
    woocommerce.js           # product search/lookup
    telegram.js               # order summary to your Telegram
    session.js                  # per-customer conversation state + cart
```
