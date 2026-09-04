const bcrypt = require('bcryptjs');
const db = require('../db');
const { config } = require('../config');

function listUsers() {
  return db.prepare('SELECT id, username, role, name, active, created_at FROM users ORDER BY id').all();
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function createUser({ username, password, role, name }) {
  if (findUserByUsername(username)) {
    return { success: false, reason: 'username already exists' };
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)')
    .run(username, passwordHash, role, name);
  return { success: true, id: result.lastInsertRowid };
}

function setUserActive(id, active) {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  return { success: true };
}

function resetPassword(id, newPassword) {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  return { success: true };
}

// Returns the safe-to-store-in-session user shape on success, or null.
function verifyLogin(username, password) {
  const user = findUserByUsername(username);
  if (!user || !user.active) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, role: user.role, name: user.name };
}

// Creates the first admin account from ADMIN_USERNAME/ADMIN_PASSWORD, but
// only when no users exist at all yet — so it's safe to leave those env
// vars set permanently; every boot after the first is a no-op.
function bootstrapAdmin() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const { username, password } = config.adminBootstrap;
  if (!username || !password) return;

  createUser({ username, password, role: 'admin', name: username });
  console.log(`Auth: bootstrapped initial admin account "${username}"`);
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') return res.status(403).send('Forbidden — admin access only');
  next();
}

module.exports = {
  listUsers,
  findUserByUsername,
  createUser,
  setUserActive,
  resetPassword,
  verifyLogin,
  bootstrapAdmin,
  requireAuth,
  requireAdmin,
};
