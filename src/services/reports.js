const db = require('../db');

// All revenue figures come from the `orders` table, which both the POS
// checkout (sales.js) and the Messenger bot (inventory.recordOnlineOrder)
// write to — so this is the one place "how much did we sell" is answered,
// across both channels.
function getSummary({ from, to } = {}) {
  const range = from && to ? 'AND created_at >= ? AND created_at <= ?' : '';
  const params = from && to ? [from, to] : [];

  const inStoreRevenue = db
    .prepare(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE channel = 'in_store' ${range}`)
    .get(...params).total;

  const onlineRevenue = db
    .prepare(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE channel = 'online' ${range}`)
    .get(...params).total;

  const totalExpenses = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE 1=1 ${range}`)
    .get(...params).total;

  return {
    inStoreRevenue,
    onlineRevenue,
    totalRevenue: inStoreRevenue + onlineRevenue,
    totalExpenses,
    netProfit: inStoreRevenue + onlineRevenue - totalExpenses,
    // Only in-store sales pass through the physical till — online orders
    // are collected/paid through the Darb Assabil courier and never touch
    // shop cash. Assumes expenses are paid out of the till; if that's not
    // true this'll need a "paid from" field on expenses later.
    expectedCash: inStoreRevenue - totalExpenses,
  };
}

function getBestSellers({ from, to, limit = 10 } = {}) {
  const range = from && to ? 'AND o.created_at >= ? AND o.created_at <= ?' : '';
  const params = from && to ? [from, to] : [];
  return db
    .prepare(`
      SELECT oi.product_name AS name, SUM(oi.quantity) AS total_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE 1=1 ${range}
      GROUP BY oi.product_name
      ORDER BY total_sold DESC
      LIMIT ?
    `)
    .all(...params, limit);
}

function getDailySales(days = 30) {
  return db
    .prepare(`
      SELECT date(created_at) AS day, channel, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS order_count
      FROM orders
      WHERE created_at >= datetime('now', ?)
      GROUP BY day, channel
      ORDER BY day DESC
    `)
    .all(`-${days} days`);
}

module.exports = { getSummary, getBestSellers, getDailySales };
