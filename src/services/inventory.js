const db = require('../db');

// Every write in this file goes through this wrapper — it runs the write as
// a SQLite transaction (so a multi-statement change like "replace all
// variants" can't half-apply) and turns any error into a logged {success:
// false} the same way the old JSON-file version did, instead of throwing
// and taking down the caller (a bot tool call, an admin form submit, etc).
function runWrite(fn) {
  try {
    db.transaction(fn)();
    return true;
  } catch (err) {
    console.error('Inventory: database write failed:', err.message);
    return false;
  }
}

function productExists(id) {
  return !!db.prepare('SELECT 1 FROM products WHERE id = ?').get(String(id));
}

// Normalizes the images map so every color's value is an array — supports
// multiple photos per color (e.g. front + back). Handles the legacy shape
// too (a plain string instead of an array) so nothing breaks if that ever
// got saved before this was added.
function normalizeImages(images) {
  const normalized = {};
  for (const [color, value] of Object.entries(images || {})) {
    normalized[color] = Array.isArray(value) ? value : [value];
  }
  return normalized;
}

function rowToProduct(row) {
  if (!row) return null;
  const variants = db
    .prepare('SELECT label, quantity FROM variants WHERE product_id = ? ORDER BY id')
    .all(row.id);
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    image_url: row.image_url,
    description: row.description,
    keywords: JSON.parse(row.keywords_json || '[]'),
    images: JSON.parse(row.images_json || '{}'),
    variants,
  };
}

// Synchronous by design (not Promise-wrapped) — src/routes/admin.js calls
// this directly without awaiting, same as when it read the JSON file.
function loadProducts() {
  const rows = db.prepare('SELECT * FROM products ORDER BY rowid').all();
  return rows.map(rowToProduct);
}

function loadProduct(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(String(id));
  return rowToProduct(row);
}

function toBotShape(product) {
  const inStockVariants = (product.variants || []).filter((v) => v.quantity > 0);
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    in_stock: inStockVariants.length > 0,
    image_url: product.image_url || null,
    images: normalizeImages(product.images),
    short_description: product.description || '',
    variants: product.variants || [],
  };
}

function searchProducts(query, perPage = 5) {
  const products = loadProducts();
  const tokens = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const matches =
    tokens.length === 0
      ? products
      : products.filter((p) => {
          const keywords = (p.keywords || []).join(' ');
          const haystack = `${p.name} ${p.description || ''} ${keywords}`.toLowerCase();
          return tokens.some((t) => haystack.includes(t));
        });

  return Promise.resolve(matches.slice(0, perPage).map(toBotShape));
}

function getProduct(productId) {
  const p = loadProduct(productId);
  return Promise.resolve(p ? toBotShape(p) : null);
}

// Reduces stock for one specific product+variant by `quantity`, floored at
// 0 — never rejects. Used by the Messenger bot's finalize_order, where
// Claude has already shown the customer live quantities before they
// confirmed, so a hard reject here isn't the right UX; see
// recordOnlineOrder below for where this gets paired with actually saving
// the order. For the in-store POS, where two devices really can race for
// the last unit, see sales.js's recordInStoreSale — that one DOES reject.
function decrementStock(productId, variantLabel, quantity) {
  if (!productExists(productId)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const variant = db
    .prepare('SELECT id, quantity FROM variants WHERE product_id = ? AND label = ?')
    .get(String(productId), variantLabel);

  if (!variant) {
    console.warn(
      `Inventory: could not find variant "${variantLabel}" for product "${productId}" — stock not adjusted`
    );
    return Promise.resolve({ success: false, reason: 'variant not found' });
  }

  const remaining = Math.max(0, variant.quantity - (quantity || 1));
  const saved = runWrite(() => {
    db.prepare('UPDATE variants SET quantity = ? WHERE id = ?').run(remaining, variant.id);
  });
  return Promise.resolve({ success: saved, remaining });
}

// Increases or decreases one variant's quantity by `delta` (negative to
// reduce). If the variant doesn't exist and delta is positive, it's created
// — this is how a new size/color gets added to an existing product via the
// admin chat. Floored at 0.
function adjustStock(productId, variantLabel, delta) {
  if (!productExists(productId)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const variant = db
    .prepare('SELECT id, quantity FROM variants WHERE product_id = ? AND label = ?')
    .get(String(productId), variantLabel);

  if (!variant) {
    if (delta <= 0) {
      return Promise.resolve({ success: false, reason: 'variant not found' });
    }
    const remaining = Math.max(0, delta);
    const saved = runWrite(() => {
      db.prepare('INSERT INTO variants (product_id, label, quantity) VALUES (?, ?, ?)').run(
        String(productId),
        variantLabel,
        remaining
      );
    });
    return Promise.resolve({ success: saved, remaining });
  }

  const remaining = Math.max(0, variant.quantity + delta);
  const saved = runWrite(() => {
    db.prepare('UPDATE variants SET quantity = ? WHERE id = ?').run(remaining, variant.id);
  });
  return Promise.resolve({ success: saved, remaining });
}

// Sets a variant's quantity to an exact number — creates it if missing.
function setStock(productId, variantLabel, quantity) {
  if (!productExists(productId)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const remaining = Math.max(0, quantity || 0);
  const variant = db
    .prepare('SELECT id FROM variants WHERE product_id = ? AND label = ?')
    .get(String(productId), variantLabel);

  const saved = runWrite(() => {
    if (variant) {
      db.prepare('UPDATE variants SET quantity = ? WHERE id = ?').run(remaining, variant.id);
    } else {
      db.prepare('INSERT INTO variants (product_id, label, quantity) VALUES (?, ?, ?)').run(
        String(productId),
        variantLabel,
        remaining
      );
    }
  });
  return Promise.resolve({ success: saved, remaining });
}

// Removes one specific size/color option from a product entirely (not the
// whole product — use deleteProduct for that).
function deleteVariant(productId, variantLabel) {
  if (!productExists(productId)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  let changed = 0;
  const saved = runWrite(() => {
    changed = db
      .prepare('DELETE FROM variants WHERE product_id = ? AND label = ?')
      .run(String(productId), variantLabel).changes;
  });

  if (saved && changed === 0) {
    return Promise.resolve({ success: false, reason: 'variant not found' });
  }
  return Promise.resolve({ success: saved });
}

// Adds one more photo for a specific color — does NOT remove existing
// photos for that color, so calling this twice (once for a front photo,
// once for a back photo) keeps both.
function addColorImage(productId, color, imageUrl) {
  const row = db.prepare('SELECT images_json FROM products WHERE id = ?').get(String(productId));
  if (!row) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const images = normalizeImages(JSON.parse(row.images_json || '{}'));
  if (!images[color]) images[color] = [];
  images[color].push(imageUrl);

  const saved = runWrite(() => {
    db.prepare("UPDATE products SET images_json = ?, updated_at = datetime('now') WHERE id = ?").run(
      JSON.stringify(images),
      String(productId)
    );
  });
  return Promise.resolve({ success: saved, totalPhotosForColor: images[color].length });
}

// Removes ALL photos saved for one color (useful to fix a mistake before
// re-adding the correct ones).
function clearColorImages(productId, color) {
  const row = db.prepare('SELECT images_json FROM products WHERE id = ?').get(String(productId));
  if (!row) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const images = normalizeImages(JSON.parse(row.images_json || '{}'));
  delete images[color];

  const saved = runWrite(() => {
    db.prepare("UPDATE products SET images_json = ?, updated_at = datetime('now') WHERE id = ?").run(
      JSON.stringify(images),
      String(productId)
    );
  });
  return Promise.resolve({ success: saved });
}

// Adds a brand new product. Returns { success: true } or
// { success: false, reason } (e.g. duplicate id).
function addProduct(newProduct) {
  if (productExists(newProduct.id)) {
    return Promise.resolve({ success: false, reason: 'a product with this ID already exists' });
  }

  const saved = runWrite(() => {
    db.prepare(`
      INSERT INTO products (id, name, price, image_url, description, keywords_json, images_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(newProduct.id),
      newProduct.name,
      String(newProduct.price),
      newProduct.image_url || null,
      newProduct.description || '',
      JSON.stringify(newProduct.keywords || []),
      JSON.stringify(newProduct.images || {})
    );

    const insertVariant = db.prepare('INSERT INTO variants (product_id, label, quantity) VALUES (?, ?, ?)');
    for (const v of newProduct.variants || []) {
      insertVariant.run(String(newProduct.id), v.label, v.quantity || 0);
    }
  });

  return Promise.resolve({ success: saved });
}

// Merges partial updates into an existing product (only overwrites the
// fields you pass in). If `updates.variants` is given, it fully replaces
// the variant list — used by both the web admin edit form (which always
// sends the complete list) and the chat admin agent (which typically only
// touches name/price/description and leaves variants out entirely).
function updateProduct(id, updates) {
  if (!productExists(id)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const saved = runWrite(() => {
    const sets = [];
    const params = [];
    const setField = (column, value) => {
      sets.push(`${column} = ?`);
      params.push(value);
    };

    if (updates.name !== undefined) setField('name', updates.name);
    if (updates.price !== undefined) setField('price', String(updates.price));
    if (updates.image_url !== undefined) setField('image_url', updates.image_url);
    if (updates.description !== undefined) setField('description', updates.description);
    if (updates.keywords !== undefined) setField('keywords_json', JSON.stringify(updates.keywords));
    if (updates.images !== undefined) setField('images_json', JSON.stringify(updates.images));

    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      params.push(String(id));
      db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    if (updates.variants !== undefined) {
      db.prepare('DELETE FROM variants WHERE product_id = ?').run(String(id));
      const insertVariant = db.prepare('INSERT INTO variants (product_id, label, quantity) VALUES (?, ?, ?)');
      for (const v of updates.variants) {
        insertVariant.run(String(id), v.label, v.quantity || 0);
      }
    }
  });

  return Promise.resolve({ success: saved });
}

function deleteProduct(id) {
  if (!productExists(id)) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const saved = runWrite(() => {
    db.prepare('DELETE FROM products WHERE id = ?').run(String(id)); // variants cascade
  });
  return Promise.resolve({ success: saved });
}

// Compact list for the admin chat agent to reference by name/id without
// pulling every variant of every product into context each time.
function listProducts() {
  const rows = db
    .prepare(`
      SELECT p.id, p.name, p.price,
             COALESCE(SUM(v.quantity), 0) AS total_quantity,
             COUNT(v.id) AS variant_count
      FROM products p
      LEFT JOIN variants v ON v.product_id = p.id
      GROUP BY p.id
      ORDER BY p.rowid
    `)
    .all();
  return Promise.resolve(rows);
}

// Decrements stock for a confirmed online order AND persists the order
// itself (channel='online', status='pending_pickup') in one transaction —
// so it shows up in /admin/pending-orders for staff to physically set
// aside, and in sales reports. Previously finalize_order only decremented
// stock and pinged Telegram; the order itself was never actually recorded
// anywhere, which is exactly why "already sold online" had no way to
// surface as a warning in the shop.
function recordOnlineOrder(cartItems, customer) {
  const total = cartItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );

  let orderId = null;
  const saved = runWrite(() => {
    for (const item of cartItems) {
      if (!item.product_id) continue;
      const variant = db
        .prepare('SELECT id, quantity FROM variants WHERE product_id = ? AND label = ?')
        .get(String(item.product_id), item.variant);

      if (!variant) {
        console.warn(
          `Inventory: could not find variant "${item.variant}" for product "${item.product_id}" — stock not adjusted`
        );
        continue;
      }

      const remaining = Math.max(0, variant.quantity - (Number(item.quantity) || 1));
      db.prepare('UPDATE variants SET quantity = ? WHERE id = ?').run(remaining, variant.id);
    }

    orderId = db
      .prepare(`
        INSERT INTO orders (channel, status, customer_name, customer_phone, customer_address, total)
        VALUES ('online', 'pending_pickup', ?, ?, ?, ?)
      `)
      .run(customer?.name || null, customer?.phone || null, customer?.address || null, total).lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, variant_label, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of cartItems) {
      insertItem.run(
        orderId,
        item.product_id || null,
        item.name,
        item.variant || '',
        item.quantity || 1,
        Number(item.price) || 0
      );
    }
  });

  return Promise.resolve({ success: saved, orderId: saved ? orderId : null });
}

module.exports = {
  searchProducts,
  getProduct,
  decrementStock,
  adjustStock,
  setStock,
  deleteVariant,
  addProduct,
  updateProduct,
  deleteProduct,
  addColorImage,
  clearColorImages,
  listProducts,
  recordOnlineOrder,
  getRawInventory: loadProducts,
};
