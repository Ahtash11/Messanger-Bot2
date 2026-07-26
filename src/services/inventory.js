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

function toBotShape(product) {
  const inStockVariants = (product.variants || []).filter((v) => v.quantity > 0);
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    in_stock: inStockVariants.length > 0,
    image_url: product.image_url || null,
    short_description: product.description || '',
    // Full variant list with live quantities — lets Claude answer "is size
    // M available?" precisely, and tells it exactly which variant labels
    // are valid to pass to add_item_to_cart.
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
// 0. Returns { success: true, remaining } or { success: false, reason }.
// This is called once per cart item when an order is finalized — never
// earlier — so browsing/adding-to-cart mid-conversation never reserves
// stock a customer hasn't actually committed to buying.
function decrementStock(productId, variantLabel, quantity) {
  const products = loadProducts();
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return Promise.resolve({ success: false, reason: 'product not found' });
  }

  const variant = (product.variants || []).find((v) => v.label === variantLabel);
  if (!variant) {
    // Don't block the order over this — the order is already confirmed and
    // the owner gets notified via Telegram regardless. Just log it so the
    // shop owner/developer notices stock wasn't auto-adjusted for this item.
    console.warn(
      `Inventory: could not find variant "${variantLabel}" for product "${productId}" — stock not adjusted`
    );
    return Promise.resolve({ success: false, reason: 'variant not found' });
  }

  variant.quantity = Math.max(0, (variant.quantity || 0) - (quantity || 1));
  const saved = saveProducts(products);

  return Promise.resolve({
    success: saved,
    remaining: variant.quantity,
  });
}

// Adds a brand new product to the live inventory. Returns
// { success: true } or { success: false, reason } (e.g. duplicate id).
function addProduct(newProduct) {
  const products = loadProducts();

  if (products.some((p) => String(p.id) === String(newProduct.id))) {
    return Promise.resolve({ success: false, reason: 'a product with this ID already exists' });
  }

  products.push(newProduct);
  const saved = saveProducts(products);
  return Promise.resolve({ success: saved });
}

// Replaces a product's editable fields (name/price/image/description/
// keywords/variants) entirely. Used by the admin edit page — the variants
// array passed in fully replaces the old one, so increasing a quantity
// number is how you "add pieces" to existing stock, and adding a new
// line is how you add a new size/color to an existing product.
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

module.exports = {
  searchProducts,
  getProduct,
  decrementStock,
  addProduct,
  updateProduct,
  deleteProduct,
  getRawInventory: loadProducts,
};
