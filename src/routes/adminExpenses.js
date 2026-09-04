const express = require('express');
const expenses = require('../services/expenses');
const { renderPage } = require('../views/layout');

const router = express.Router();

function redirectWithMsg(res, msg, ok) {
  res.redirect(`/admin/expenses?msg=${encodeURIComponent(msg)}&ok=${ok ? '1' : '0'}`);
}

router.get('/', (req, res) => {
  const list = expenses.listExpenses();
  const total = list.reduce((sum, e) => sum + e.amount, 0);

  const rows = list
    .map(
      (e) => `<tr>
        <td>${e.created_at}</td>
        <td>${e.category || '—'}</td>
        <td>${e.amount} د.ل</td>
        <td>${e.note || ''}</td>
        <td class="actions">
          <form method="POST" action="/admin/expenses/${e.id}/delete" onsubmit="return confirm('متأكد؟');">
            <button type="submit" class="danger">حذف</button>
          </form>
        </td>
      </tr>`
    )
    .join('');

  const msg = req.query.msg ? `<div class="msg ${req.query.ok === '1' ? 'success' : 'error'}">${req.query.msg}</div>` : '';

  res.send(
    renderPage({
      title: 'المصاريف',
      user: req.session.user,
      activePath: '/admin/expenses',
      body: `
        <h1>المصاريف</h1>
        ${msg}
        <div class="stat-row">
          <div class="stat-card"><div class="value">${total} د.ل</div><div class="label">إجمالي المصاريف المسجلة</div></div>
        </div>

        <form method="POST" action="/admin/expenses" class="card">
          <label>المبلغ (د.ل)</label>
          <input name="amount" type="number" step="0.01" required />

          <label>الفئة (اختياري)</label>
          <input name="category" placeholder="مثال: إيجار، توريد بضاعة، فواتير" />

          <label>ملاحظة (اختياري)</label>
          <input name="note" />

          <button type="submit">تسجيل مصروف</button>
        </form>

        <table>
          <tr><th>التاريخ</th><th>الفئة</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr>
          ${rows}
        </table>
      `,
    })
  );
});

router.post('/', express.urlencoded({ extended: true }), (req, res) => {
  const { amount, category, note } = req.body;
  if (!amount || isNaN(Number(amount))) {
    return redirectWithMsg(res, 'دخل مبلغ صحيح', false);
  }
  expenses.addExpense({ amount, category, note, createdByUserId: req.session.user.id });
  redirectWithMsg(res, 'تم تسجيل المصروف', true);
});

router.post('/:id/delete', (req, res) => {
  expenses.deleteExpense(req.params.id);
  redirectWithMsg(res, 'تم الحذف', true);
});

module.exports = router;
