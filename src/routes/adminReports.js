const express = require('express');
const reports = require('../services/reports');
const { renderPage } = require('../views/layout');

const router = express.Router();

router.get('/', (req, res) => {
  const summary = reports.getSummary({});
  const bestSellers = reports.getBestSellers({ limit: 10 });
  const daily = reports.getDailySales(30);

  const dailyRows = daily
    .map((d) => `<tr><td>${d.day}</td><td>${d.channel === 'in_store' ? 'المحل' : 'أونلاين'}</td><td>${d.revenue} د.ل</td><td>${d.order_count}</td></tr>`)
    .join('');

  const bestSellerRows = bestSellers
    .map((b) => `<tr><td>${b.name}</td><td>${b.total_sold}</td></tr>`)
    .join('');

  res.send(
    renderPage({
      title: 'التقارير',
      user: req.session.user,
      activePath: '/admin/reports',
      body: `
        <h1>التقارير</h1>

        <div class="stat-row">
          <div class="stat-card"><div class="value">${summary.inStoreRevenue} د.ل</div><div class="label">مبيعات المحل</div></div>
          <div class="stat-card"><div class="value">${summary.onlineRevenue} د.ل</div><div class="label">مبيعات أونلاين</div></div>
          <div class="stat-card"><div class="value">${summary.totalExpenses} د.ل</div><div class="label">إجمالي المصاريف</div></div>
          <div class="stat-card"><div class="value">${summary.netProfit} د.ل</div><div class="label">صافي الربح (الكل − المصاريف)</div></div>
          <div class="stat-card"><div class="value">${summary.expectedCash} د.ل</div><div class="label">الكاش المفروض موجود بالمحل</div></div>
        </div>
        <p class="hint">"الكاش المفروض موجود بالمحل" = مبيعات المحل ناقص المصاريف. ما فيهاش مبيعات أونلاين (درب السبيل ياخذها بره الكاشير).</p>

        <h2>أكثر المنتجات مبيعاً</h2>
        <table>
          <tr><th>المنتج</th><th>الكمية المباعة</th></tr>
          ${bestSellerRows || '<tr><td colspan="2">ما فيش مبيعات مسجلة بعد</td></tr>'}
        </table>

        <h2>المبيعات اليومية (آخر 30 يوم)</h2>
        <table>
          <tr><th>اليوم</th><th>القناة</th><th>الإجمالي</th><th>عدد الطلبيات</th></tr>
          ${dailyRows || '<tr><td colspan="4">ما فيش مبيعات مسجلة بعد</td></tr>'}
        </table>
      `,
    })
  );
});

module.exports = router;
