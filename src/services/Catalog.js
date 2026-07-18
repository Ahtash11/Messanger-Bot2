const { config } = require('../config');
const woocommerce = require('./woocommerce');
const darbCatalog = require('./darbCatalog');

function useDarb() {
  return config.catalogSource === 'darb';
}

async function searchProducts(query, perPage = 5) {
  return useDarb()
    ? darbCatalog.searchProducts(query, perPage)
    : woocommerce.searchProducts(query, perPage);
}

async function getProduct(productId) {
  return useDarb() ? darbCatalog.getProduct(productId) : woocommerce.getProduct(productId);
}

module.exports = { searchProducts, getProduct };
