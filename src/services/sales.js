const db = require('../db');

// Thrown when one or more cart lines can't be fulfilled — carries enough
// detail for the POS screen to show exactly which item(s) ran out (which
// may be because someone else's device just sold the last one, or because
// it's already reserved by an online order — either way, "we don't have
// that many" is the right message).
class InsufficientStockError extends Error {
  constructor(shortItems) {
    super('Insufficient stock for one or more items');
    this.shortItems = shortItems;
  }
}

// Records an in-store sale. Every stock check-and-decrement happens as a
// single atomic SQL statement inside one transaction — if two POS devices
// try to sell the last unit of the same variant at the same moment, SQLite
// serializes the two transactions, so exactly one succeeds and the other
// gets a clean InsufficientStockError instead of silently overselling.
//
// cartItems: [{ product_id, name, price, quantity, variant }]
// Returns the new order's id on success; throws InsufficientStockError on
// failure (nothing is written in that case — the transaction rolls back).
const recordInStoreSale = db.transaction((cashierUserId, cartItems, customerId) => {
  const shortItems = [];

  for (const item of cartItems) {
    const result = db
      .prepare(
        `UPDATE variants SET quantity = quantity - ?
         WHERE product_id = ? AND label = ? AND quantity >= ?`
      )
      .run(item.quantity, item.product_id, item.variant || '', item.quantity);

    if (result.changes === 0) {
      shortItems.push({ product_id: item.product_id, variant: item.variant, name: item.name });
    }
  }

  if (shortItems.length > 0) {
    throw new InsufficientStockError(shortItems);
  }

  const total = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const orderId = db
    .prepare(`
      INSERT INTO orders (channel, status, cashier_user_id, customer_id, total)
      VALUES ('in_store', 'completed', ?, ?, ?)
    `)
    .run(cashierUserId, customerId || null, total).lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, variant_label, quantity, unit_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of cartItems) {
    insertItem.run(orderId, item.product_id, item.name, item.variant || '', item.quantity, Number(item.price));
  }

  return orderId;
});

module.exports = { recordInStoreSale, InsufficientStockError };
