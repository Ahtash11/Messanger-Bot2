# Domain glossary

- **Customer bot** — the Messenger-facing agent (`src/services/claude.js`) that chats with shoppers in Libyan dialect, searches the catalog, and finalizes orders.
- **Owner bot** — the Telegram-facing agent (`src/services/adminAgent.js`) the store owner uses to manage inventory conversationally.
- **Agent loop** — the shared tool-use exchange mechanism (`src/services/agentLoop.js`) both the Customer bot and Owner bot are built on: send a message to Claude, resolve any tool calls, repeat until Claude answers in plain text. Owns the invariants both bots need — every tool call gets a result even if it throws, and a truncated (`max_tokens`) response never corrupts history — so neither bot has to reimplement them.
