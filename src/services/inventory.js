const fs = require('fs');
const path = require('path');
const { config } = require('../config');

// The bundled catalog (in git) — acts as the starting template/seed.
const SEED_FILE = path.join(__dirname, '..', 'data', 'products.json');

// The LIVE file the bot actually reads/writes at runtime. In production,
// config.inventoryFilePath should point at a Railway Volume mount (e.g.
// /data/products.json) so stock changes survive redeploys. If not set, we
// fall back to using the seed file directly — fine for local testing, but
// any stock changes will be overwritten the next time you redeploy from git.
const LIVE_FILE = config.inventoryFilePath || SEED_FILE;

// On first run against a fresh volume, LIVE_FILE won't exist yet — copy the
// seed catalog there so there's something to read/write.
function ensureLiveFile() {
  if (LIVE_FILE === SEED_FILE) return; // nothing to bootstrap, same file
  if (fs.existsSync(LIVE_FILE)) return;

  try {
    fs.mkdirSync(path.dirname(LIVE_FILE), { recursive: true });
    fs.copyFileSync(SEED_FILE, LIVE_FILE);
    console.log(`Inventory: bootstrapped ${LIVE_FILE} from seed catalog`);
  } catch (err) {
    console.error('Inventory: failed to bootstrap live file:', err.message);
  }
}

function loadProducts() {
  ensureLiveFile();
  try {
    const raw = fs.readFileSync(LIVE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Inventory: could not read products file:', err.message);
    return [];
  }
}

function saveProducts(products) {
  try {
    fs.writeFileSync(LIVE_FILE, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Inventory: could not save products file:', err.message);
    return false;
  }
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

function toBotShape(product) {
  const inStockVariants = (product.variants || []).filter((v) => v.quantity > 0);
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    in_stock: inStockVariants.length > 0,
    image_url: product.image_url || null,
    // Optional per-color photos, e.g. { "أسود": ["front.jpg", "back.jpg"] }.
    // Falls back to image_url above for any color not listed here.
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
  const products = loadProducts();
  const p = products.find((prod) => String(prod.id) === String(productId));
  return Promise.resolve(p ? toBotShape(p) : null);
}

// Reduces stock for one specific product+variant by `quantity`, floored at
// 0. Called once per cart item when a customer order is finalized.
function decrementStock(productId, variantLabel, quantity) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const variant = (product.variants || []).find((v) => v.label === variantLabel);
  if (!variant) {
    console.warn(
      `Inventory: could not find variant "${variantLabel}" for product "${productId}" — stock not adjusted`
    );
    return Promise.resolve({ success: false, reason: 'variant not found' });
  }

  variant.quantity = Math.max(0, (variant.quantity || 0) - (quantity || 1));
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved, remaining: variant.quantity });
}

// Increases or decreases one variant's quantity by `delta` (negative to
// reduce). If the variant doesn't exist and delta is positive, it's created
// — this is how a new size/color gets added to an existing product via the
// admin chat. Floored at 0.
function adjustStock(productId, variantLabel, delta) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  product.variants = product.variants || [];
  let variant = product.variants.find((v) => v.label === variantLabel);

  if (!variant) {
    if (delta <= 0) {
      return Promise.resolve({ success: false, reason: 'variant not found' });
    }
    variant = { label: variantLabel, quantity: 0 };
    product.variants.push(variant);
  }

  variant.quantity = Math.max(0, (variant.quantity || 0) + delta);
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved, remaining: variant.quantity });
}

// Sets a variant's quantity to an exact number — creates it if missing.
function setStock(productId, variantLabel, quantity) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  product.variants = product.variants || [];
  let variant = product.variants.find((v) => v.label === variantLabel);
  if (!variant) {
    variant = { label: variantLabel, quantity: 0 };
    product.variants.push(variant);
  }
  variant.quantity = Math.max(0, quantity || 0);

  const saved = saveProducts(products);
  return Promise.resolve({ success: saved, remaining: variant.quantity });
}

// Removes one specific size/color option from a product entirely (not the
// whole product — use deleteProduct for that).
function deleteVariant(productId, variantLabel) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const before = (product.variants || []).length;
  product.variants = (product.variants || []).filter((v) => v.label !== variantLabel);
  if (product.variants.length === before) {
    return Promise.resolve({ success: false, reason: 'variant not found' });
  }

  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

// Adds one more photo for a specific color — does NOT remove existing
// photos for that color, so calling this twice (once for a front photo,
// once for a back photo) keeps both.
function addColorImage(productId, color, imageUrl) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  product.images = normalizeImages(product.images);
  if (!product.images[color]) product.images[color] = [];
  product.images[color].push(imageUrl);

  const saved = saveProducts(products);
  return Promise.resolve({ success: saved, totalPhotosForColor: product.images[color].length });
}

// Removes ALL photos for one color (useful to fix a mistake before
// re-adding the correct ones).
function clearColorImages(productId, color) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  product.images = normalizeImages(product.images);
  delete product.images[color];

  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

// Adds a brand new product. Returns { success: true } or
// { success: false, reason } (e.g. duplicate id).
function addProduct(newProduct) {
  const products = loadProducts();

  if (products.some((p) => String(p.id) === String(newProduct.id))) {
    return Promise.resolve({ success: false, reason: 'a product with this ID already exists' });
  }

  products.push(newProduct);
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

// Merges partial updates into an existing product (only overwrites the
// fields you pass in). Used for both the web admin edit form (which passes
// everything including a full variants replacement) and the chat admin
// agent (which typically only updates a field like price or name).
function updateProduct(id, updates) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(id));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  Object.assign(product, updates);
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

function deleteProduct(id) {
  const products = loadProducts();
  const index = products.findIndex((p) => String(p.id) === String(id));
  if (index === -1) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  products.splice(index, 1);
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

// Compact list for the admin chat agent to reference by name/id without
// pulling every variant of every product into context each time.
function listProducts() {
  const products = loadProducts();
  return Promise.resolve(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      total_quantity: (p.variants || []).reduce((s, v) => s + (v.quantity || 0), 0),
      variant_count: (p.variants || []).length,
    }))
  );
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
  getRawInventory: loadProducts,
};
