const db = require('../db');

function listExpenses({ from, to } = {}) {
  if (from && to) {
    return db
      .prepare('SELECT * FROM expenses WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC')
      .all(from, to);
  }
  return db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all();
}

function addExpense({ amount, category, note, createdByUserId }) {
  const result = db
    .prepare('INSERT INTO expenses (amount, category, note, created_by_user_id) VALUES (?, ?, ?, ?)')
    .run(Number(amount), category || null, note || null, createdByUserId || null);
  return { success: true, id: result.lastInsertRowid };
}

function deleteExpense(id) {
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { success: result.changes > 0 };
}

module.exports = { listExpenses, addExpense, deleteExpense };
