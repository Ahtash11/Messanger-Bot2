-- Products and their size/color variants replace the old products.json file.
-- keywords_json and images_json store what used to be plain JS arrays/objects
-- as JSON text, since SQLite has no native array/object column type.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  image_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  keywords_json TEXT NOT NULL DEFAULT '[]',
  images_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);

-- Login accounts for the in-store POS/admin system. Not related to Telegram
-- (the owner's Telegram admin chat keeps working via TELEGRAM_OWNER_CHAT_IDS,
-- unrelated to this table).
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Known repeat customers, curated from the in-store side. Online orders do
-- NOT require a row here (see orders.customer_name/phone/address below) —
-- this table is for the owner's own customer record-keeping, e.g. optionally
-- linking a walk-in sale to a known customer.
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- One row per sale, whether rung up in-store or placed through the
-- Messenger bot. channel='online' orders start life as status='pending_pickup'
-- (physically still on the shelf, already sold, waiting for the Darb Assabil
-- courier to collect them) and move to 'fulfilled' once picked up.
-- channel='in_store' orders are always 'completed' immediately — the
-- customer walks out with the item.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('in_store', 'online')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'pending_pickup', 'fulfilled')),
  cashier_user_id INTEGER REFERENCES users(id),
  customer_id INTEGER REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Line items snapshot product_name/variant_label/unit_price at sale time
-- (rather than joining to the live products table) so historical sales stay
-- accurate even after a product's price or name changes later.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  variant_label TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  category TEXT,
  note TEXT,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
