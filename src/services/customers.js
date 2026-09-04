const db = require('../db');

function listCustomers(search) {
  if (search) {
    const like = `%${search}%`;
    return db
      .prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name')
      .all(like, like);
  }
  return db.prepare('SELECT * FROM customers ORDER BY name').all();
}

function getCustomer(id) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function addCustomer({ name, phone, notes }) {
  const result = db
    .prepare('INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?)')
    .run(name || null, phone || null, notes || null);
  return { success: true, id: result.lastInsertRowid };
}

function updateCustomer(id, { name, phone, notes }) {
  const result = db
    .prepare('UPDATE customers SET name = ?, phone = ?, notes = ? WHERE id = ?')
    .run(name || null, phone || null, notes || null, id);
  return { success: result.changes > 0 };
}

function deleteCustomer(id) {
  const result = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  return { success: result.changes > 0 };
}

module.exports = { listCustomers, getCustomer, addCustomer, updateCustomer, deleteCustomer };
