const db = require('../db');

function attachItems(order) {
  order.items = db
    .prepare('SELECT product_name, variant_label, quantity, unit_price FROM order_items WHERE order_id = ?')
    .all(order.id);
  return order;
}

// Online orders sold through the bot but not yet collected by the Darb
// Assabil courier — physically still on the shelf, already sold. Staff
// check this list to know what to set aside.
function listPendingOrders() {
  const orders = db
    .prepare(`
      SELECT * FROM orders
      WHERE channel = 'online' AND status = 'pending_pickup'
      ORDER BY created_at ASC
    `)
    .all();
  return orders.map(attachItems);
}

function markFulfilled(orderId) {
  const result = db
    .prepare("UPDATE orders SET status = 'fulfilled', fulfilled_at = datetime('now') WHERE id = ? AND status = 'pending_pickup'")
    .run(orderId);
  if (result.changes === 0) {
    return { success: false, reason: 'order not found or already fulfilled' };
  }
  return { success: true };
}

// Recent sales across both channels, newest first — used by the reports
// page and by the customer purchase-history view.
function listRecentOrders(limit = 100) {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);
  return orders.map(attachItems);
}

function listOrdersForCustomer(customerId) {
  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(customerId);
  return orders.map(attachItems);
}

module.exports = { listPendingOrders, markFulfilled, listRecentOrders, listOrdersForCustomer };
