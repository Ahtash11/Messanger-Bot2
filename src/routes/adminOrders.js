const express = require('express');
const orders = require('../services/orders');
const { renderPage } = require('../views/layout');

const router = express.Router();

router.get('/', (req, res) => {
  const pending = orders.listPendingOrders();

  const cards = pending
    .map((o) => {
      const items = o.items
        .map((i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`)
        .join('، ');
      return `
        <div class="card">
          <div><strong>${o.customer_name || 'بدون اسم'}</strong> — ${o.customer_phone || '—'}</div>
          <div class="hint">${o.customer_address || ''}</div>
          <div style="margin-top:10px;">${items}</div>
          <div class="hint" style="margin-top:6px;">طلب من: ${o.created_at} — الإجمالي: ${o.total} د.ل</div>
          <form method="POST" action="/admin/pending-orders/${o.id}/fulfill">
            <button type="submit">تم الاستلام من طرف درب السبيل</button>
          </form>
        </div>
      `;
    })
    .join('');

  const msg = req.query.msg ? `<div class="msg ${req.query.ok === '1' ? 'success' : 'error'}">${req.query.msg}</div>` : '';

  res.send(
    renderPage({
      title: 'طلبيات بانتظار الاستلام',
      user: req.session.user,
      activePath: '/admin/pending-orders',
      body: `
        <h1>طلبيات بانتظار الاستلام (${pending.length})</h1>
        <p class="hint">هذي المنتجات مباعة أونلاين بس لسه موجودة فعلياً بالمحل، بانتظار درب السبيل ياخذها. لا تبيعها لزبون بالمحل — الكمية عندها متحسوبة كمخصصة أصلاً.</p>
        ${msg}
        ${pending.length === 0 ? '<p>ما فيش طلبيات بانتظار الاستلام توا.</p>' : cards}
      `,
    })
  );
});

router.post('/:id/fulfill', (req, res) => {
  const result = orders.markFulfilled(req.params.id);
  res.redirect(`/admin/pending-orders?msg=${encodeURIComponent(result.success ? 'تم تسجيل الاستلام' : result.reason)}&ok=${result.success ? '1' : '0'}`);
});

module.exports = router;
