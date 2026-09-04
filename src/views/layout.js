// Shared HTML shell for every POS/admin page — one nav bar, one set of
// styles, so each route file only has to provide its own body markup.

function baseStyles() {
  return `
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background:#f7f7f7; color:#222; }
    header { background:#2c3e50; color:#fff; padding: 10px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
    header nav a { color:#fff; text-decoration:none; margin-left: 14px; font-size: 14px; }
    header nav a.active { text-decoration: underline; font-weight:bold; }
    header .who { font-size: 13px; display:flex; align-items:center; gap:10px; }
    header .who form { margin:0; }
    header .who button { margin:0; padding:5px 10px; font-size:12px; background:#1a242f; }
    main { max-width: 960px; margin: 20px auto; padding: 0 15px; }
    h1 { font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; background:#fff; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 14px; }
    th { background: #34495e; color: white; }
    form.card { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    label { display: block; margin-top: 12px; font-weight: bold; font-size: 14px; }
    input, textarea, select { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; font-size: 14px; }
    textarea { height: 120px; font-family: monospace; direction: ltr; text-align: left; }
    button { margin-top: 16px; padding: 10px 20px; background: #2c3e50; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer; }
    button.danger { background: #c0392b; }
    button.secondary { background: #7f8c8d; }
    .msg { padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
    .hint { color: #666; font-size: 13px; margin-top: 2px; }
    .actions a, .actions button { font-size: 13px; margin-left: 8px; }
    .actions form { display: inline; background: none; padding: 0; margin: 0; }
    .stat-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 20px; }
    .stat-card { background:#fff; border-radius:8px; padding:16px 20px; flex:1; min-width:150px; }
    .stat-card .value { font-size: 22px; font-weight:bold; }
    .stat-card .label { font-size: 13px; color:#666; }
  `;
}

const NAV_ITEMS = [
  { href: '/pos', label: 'نقطة البيع', roles: ['admin', 'employee'] },
  { href: '/admin', label: 'المنتجات', roles: ['admin'] },
  { href: '/admin/pending-orders', label: 'طلبيات بانتظار الاستلام', roles: ['admin'] },
  { href: '/admin/customers', label: 'الزبائن', roles: ['admin'] },
  { href: '/admin/expenses', label: 'المصاريف', roles: ['admin'] },
  { href: '/admin/staff', label: 'الموظفين', roles: ['admin'] },
  { href: '/admin/reports', label: 'التقارير', roles: ['admin'] },
];

function renderNav(user, activePath) {
  const links = NAV_ITEMS.filter((item) => item.roles.includes(user.role))
    .map((item) => `<a href="${item.href}" class="${activePath === item.href ? 'active' : ''}">${item.label}</a>`)
    .join('');

  return `
    <header>
      <nav>${links}</nav>
      <div class="who">
        <span>${user.name} — ${user.role === 'admin' ? 'مدير' : 'موظف'}</span>
        <form method="POST" action="/logout"><button type="submit">خروج</button></form>
      </div>
    </header>
  `;
}

function renderPage({ title, user, activePath, body }) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${baseStyles()}</style>
</head>
<body>
${user ? renderNav(user, activePath) : ''}
<main>${body}</main>
</body>
</html>`;
}

module.exports = { renderPage };
