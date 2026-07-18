const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');

function loadManualProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(
      'Could not read src/data/products.json — make sure it exists and is valid JSON:',
      err.message
    );
    return [];
  }
}

function client() {
  return axios.create({
    baseURL: config.darb.baseUrl,
    headers: {
      Authorization: `apikey ${config.darb.apiKey}`,
      'X-API-VERSION': '1.0.0',
      'X-ACCOUNT-ID': config.darb.accountId,
    },
    timeout: 10000,
  });
}

async function fetchStockQuantity(productId) {
  try {
    const { data } = await client().get('/api/warehouse/products/stock/me', {
      params: {
        product: productId,
        warehouse: config.darb.warehouseId || undefined,
        withLockedQuantities: true,
      },
    });
    const entry = data?.data?.[0];
    if (!entry) return 0;
    return (entry.quantity || 0) - (entry.lockedQuantity || 0);
  } catch (err) {
    console.error('Darb Assabil stock check error:', err.response?.data || err.message);
    return null;
  }
}

function searchManual(query) {
  const products = loadManualProducts();
  const tokens = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (tokens.length === 0) return products;

  return products.filter((p) => {
    const keywords = (p.keywords || []).join(' ');
    const haystack = `${p.name} ${p.description || ''} ${keywords}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
}

function toBotShape(manualProduct, quantity) {
  return {
    id: manualProduct.id,
    name: manualProduct.name,
    price: manualProduct.price,
    in_stock: quantity === null ? true : quantity > 0,
    image_url: manualProduct.image_url || null,
    variants: manualProduct.variants || [],
    short_description: manualProduct.description || '',
  };
}

async function searchProducts(query, perPage = 5) {
  const matches = searchManual(query).slice(0, perPage);
  return Promise.all(
    matches.map(async (p) => toBotShape(p, await fetchStockQuantity(p.id)))
  );
}

async function getProduct(productId) {
  const products = loadManualProducts();
  const p = products.find((prod) => String(prod.id) === String(productId));
  if (!p) return null;
  return toBotShape(p, await fetchStockQuantity(p.id));
}

module.exports = { searchProducts, getProduct };
