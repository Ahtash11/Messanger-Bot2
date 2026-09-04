const express = require('express');
const customers = require('../services/customers');
const orders = require('../services/orders');
const { renderPage } = require('../views/layout');

const router = express.Router();

function redirectWithMsg(res, msg, ok) {
  res.redirect(`/admin/customers?msg=${encodeURIComponent(msg)}&ok=${ok ? '1' : '0'}`);
}

router.get('/', (req, res) => {
  const list = customers.listCustomers(req.query.q);

  const rows = list
    .map(
      (c) => `<tr>
        <td>${c.name || '—'}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.notes || ''}</td>
        <td class="actions">
          <a href="/admin/customers/${c.id}">التفاصيل</a>
          <form method="POST" action="/admin/customers/${c.id}/delete" onsubmit="return confirm('متأكد؟');">
            <button type="submit" class="danger">حذف</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  const msg = req.query.msg ? `<div class="msg ${req.query.ok === '1' ? 'success' : 'error'}">${req.query.msg}</div>` : '';

  res.send(
    renderPage({
      title: 'الزبائن',
      user: req.session.user,
      activePath: '/admin/customers',
      body: `
        <h1>الزبائن</h1>
        ${msg}
        <form method="GET" action="/admin/customers" class="card">
          <label>دور بالاسم أو الرقم</label>
          <input name="q" value="${req.query.q || ''}" />
          <button type="submit">دور</button>
        </form>

        <form method="POST" action="/admin/customers" class="card">
          <label>الاسم</label>
          <input name="name" />
          <label>رقم الهاتف</label>
          <input name="phone" />
          <label>ملاحظات</label>
          <input name="notes" />
          <button type="submit">إضافة زبون</button>
        </form>

        <table>
          <tr><th>الاسم</th><th>الهاتف</th><th>ملاحظات</th><th></th></tr>
          ${rows}
        </table>
      `,
    })
  );
});

router.get('/:id', (req, res) => {
  const customer = customers.getCustomer(req.params.id);
  if (!customer) return redirectWithMsg(res, 'ما لقيتش هذا الزبون', false);

  const history = orders.listOrdersForCustomer(customer.id);
  const historyRows = history
    .map(
      (o) => `<tr>
        <td>${o.created_at}</td>
        <td>${o.total} د.ل</td>
        <td>${o.items.map((i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`).join('، ')}</td>
      </tr>`
    )
    .join('');

  res.send(
    renderPage({
      title: customer.name || 'زبون',
      user: req.session.user,
      activePath: '/admin/customers',
      body: `
        <a href="/admin/customers">&larr; رجوع للقائمة</a>
        <h1>${customer.name || '—'} — ${customer.phone || '—'}</h1>
        <p>${customer.notes || ''}</p>
        <h2>سجل المشتريات</h2>
        <table>
          <tr><th>التاريخ</th><th>الإجمالي</th><th>المنتجات</th></tr>
          ${historyRows || '<tr><td colspan="3">ما فيش مشتريات مسجلة لهذا الزبون بعد</td></tr>'}
        </table>
      `,
    })
  );
});

router.post('/', express.urlencoded({ extended: true }), (req, res) => {
  const { name, phone, notes } = req.body;
  if (!name && !phone) {
    return redirectWithMsg(res, 'دخل الاسم أو رقم الهاتف على الأقل', false);
  }
  customers.addCustomer({ name, phone, notes });
  redirectWithMsg(res, 'تمت إضافة الزبون', true);
});

router.post('/:id/delete', (req, res) => {
  customers.deleteCustomer(req.params.id);
  redirectWithMsg(res, 'تم الحذف', true);
});

module.exports = router;
