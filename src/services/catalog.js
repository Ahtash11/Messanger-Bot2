const inventory = require('./inventory');

// Your own managed inventory system is the only catalog source now — no
// WooCommerce, no mock catalog. Kept as a thin wrapper (rather than having
// claude.js require inventory.js directly) so a different catalog source
// could be swapped back in later without touching claude.js again.
module.exports = {
  searchProducts: inventory.searchProducts,
  getProduct: inventory.getProduct,
  decrementStock: inventory.decrementStock,
};
