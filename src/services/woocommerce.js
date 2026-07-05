const axios = require('axios');
const { config } = require('../config');

function client() {
  return axios.create({
    baseURL: `${config.woocommerce.url}/wp-json/wc/v3`,
    auth: {
      username: config.woocommerce.consumerKey,
      password: config.woocommerce.consumerSecret,
    },
    timeout: 10000,
  });
}

// Searches products by keyword (name/description). Returns a compact list
// that's cheap to hand to Claude — full WooCommerce product objects are huge.
async function searchProducts(query, perPage = 5) {
  try {
    const { data } = await client().get('/products', {
      params: { search: query, per_page: perPage, status: 'publish' },
    });

    return data.map(simplifyProduct);
  } catch (err) {
    console.error('WooCommerce search error:', err.response?.data || err.message);
    return [];
  }
}

async function getProduct(productId) {
  try {
    const { data } = await client().get(`/products/${productId}`);
    return simplifyProduct(data);
  } catch (err) {
    console.error('WooCommerce getProduct error:', err.response?.data || err.message);
    return null;
  }
}

function simplifyProduct(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    in_stock: p.stock_status === 'instock',
    image_url: p.images?.[0]?.src || null,
    variants: (p.attributes || [])
      .filter((a) => a.variation)
      .map((a) => ({ name: a.name, options: a.options })),
    short_description: (p.short_description || '').replace(/<[^>]+>/g, '').trim(),
  };
}

module.exports = { searchProducts, getProduct };
