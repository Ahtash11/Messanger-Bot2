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

### E. WooCommerce

**Testing without your real store first?** Set `MOCK_CATALOG=true` and skip
this section — the bot uses a small built-in fake catalog
(`src/services/mockCatalog.js`) instead. Set `MOCK_CATALOG=false` and fill
in the three variables below once you're ready to connect your real store.

In WordPress admin: WooCommerce → Settings → Advanced → REST API → Add key,
Read permissions. Copy the Consumer Key/Secret and your store URL.

## 2. Run it locally first

```bash
cp .env.example .env
npm install
npm start
```

## 3. Deploy (Railway)

1. Push this project to a GitHub repo.
2. railway.app → New Project → Deploy from GitHub repo.
3. Paste your env vars into the Variables tab.
4. Generate a public domain under Settings → Networking.

## 4. Test it

Message your Page from an admin/tester account. Try a text question, a
voice note, and a full order to confirm the Telegram summary arrives.

## Known limitations

- Session memory is in-memory — resets on restart/redeploy.
- Whisper + Libyan dialect isn't perfect; bot asks to retype if unclear.
- Telegram bot must be messaged first before it can reply to you.
- App Review required before non-admin accounts can use the bot.

## Project structure

```
src/
  config.js
  server.js
  routes/webhook.js
  services/
    claude.js
    messenger.js
    whisper.js
    woocommerce.js
    telegram.js
    session.js
    mockCatalog.js
```
