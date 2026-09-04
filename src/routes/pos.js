const express = require('express');
const inventory = require('../services/inventory');
const { recordInStoreSale, InsufficientStockError } = require('../services/sales');
const { renderPage } = require('../views/layout');

const router = express.Router();
router.use(express.json());

// Same data source the bot and the product admin page read from
// (inventory.getRawInventory) — the POS is never a second source of truth
// for what's in stock.
function buildCatalogForPOS() {
  return inventory.getRawInventory().map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    variants: p.variants || [],
  }));
}

router.get('/', (req, res) => {
  const catalog = buildCatalogForPOS();
  res.send(
    renderPage({
      title: 'نقطة البيع',
      user: req.session.user,
      activePath: '/pos',
      body: `
        <div id="pos-app"></div>
        <script>window.__CATALOG__ = ${JSON.stringify(catalog)};<\/script>
        <script>${clientScript()}<\/script>
      `,
    })
  );
});

router.post('/checkout', (req, res) => {
  const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
  if (cart.length === 0) {
    return res.status(400).json({ success: false, reason: 'السلة فاضية' });
  }

  try {
    const orderId = recordInStoreSale(req.session.user.id, cart, null);
    return res.json({ success: true, orderId });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return res.status(409).json({ success: false, reason: 'insufficient_stock', shortItems: err.shortItems });
    }
    console.error('POS checkout error:', err);
    return res.status(500).json({ success: false, reason: 'صار خطأ، جرب مرة ثانية' });
  }
});

// Plain, dependency-free client-side JS (no build step, matching the rest
// of this project) — a search box, a tap-to-pick-variant product grid, and
// a running cart. Deliberately written with single quotes and no template
// literals so it can be safely embedded inside this file's own template
// literal without escaping conflicts.
function clientScript() {
  return `
(function () {
  var catalog = window.__CATALOG__ || [];
  var cart = [];

  var app = document.getElementById('pos-app');
  app.innerHTML =
    '<div class="pos-layout">' +
      '<div class="pos-catalog">' +
        '<input id="pos-search" type="text" placeholder="دور على منتج..." />' +
        '<div id="pos-grid" class="pos-grid"></div>' +
      '</div>' +
      '<div class="pos-cart">' +
        '<h3>السلة</h3>' +
        '<div id="pos-cart-items"></div>' +
        '<div id="pos-cart-total"></div>' +
        '<button id="pos-checkout-btn">إتمام البيع</button>' +
        '<div id="pos-message"></div>' +
      '</div>' +
    '</div>';

  var style = document.createElement('style');
  style.textContent =
    '.pos-layout { display:flex; gap:16px; flex-wrap:wrap; }' +
    '.pos-catalog { flex:2; min-width:280px; }' +
    '.pos-cart { flex:1; min-width:260px; background:#fff; border-radius:8px; padding:14px; align-self:flex-start; position:sticky; top:10px; }' +
    '#pos-search { width:100%; padding:10px; font-size:16px; margin-bottom:10px; box-sizing:border-box; }' +
    '.pos-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }' +
    '.pos-product { background:#fff; border-radius:8px; padding:10px; cursor:pointer; text-align:center; }' +
    '.pos-product:hover { outline: 2px solid #2c3e50; }' +
    '.pos-product .name { font-weight:bold; font-size:14px; margin-bottom:4px; }' +
    '.pos-product .price { color:#555; font-size:13px; }' +
    '.pos-variant-picker { display:flex; flex-wrap:wrap; gap:6px; margin-top:20px; }' +
    '.pos-variant-btn { padding:8px 10px; border:1px solid #ccc; border-radius:6px; background:#fff; color:#222; cursor:pointer; font-size:13px; }' +
    '.pos-variant-btn:disabled { opacity:0.35; cursor:not-allowed; text-decoration:line-through; }' +
    '.pos-cart-line { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee; font-size:13px; }' +
    '.pos-cart-line button { margin:0; padding:2px 8px; font-size:12px; }' +
    '#pos-cart-total { font-size:18px; font-weight:bold; margin:12px 0; }' +
    '#pos-message.error { color:#c0392b; margin-top:10px; }' +
    '#pos-message.success { color:#155724; margin-top:10px; }';
  document.head.appendChild(style);

  function renderGrid(filter) {
    var grid = document.getElementById('pos-grid');
    var q = (filter || '').trim().toLowerCase();
    var items = !q ? catalog : catalog.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
    grid.innerHTML = items.map(function (p) {
      var totalQty = (p.variants || []).reduce(function (s, v) { return s + v.quantity; }, 0);
      return '<div class="pos-product" data-id="' + p.id + '">' +
        '<div class="name">' + p.name + '</div>' +
        '<div class="price">' + p.price + ' د.ل</div>' +
        '<div class="hint">' + (totalQty > 0 ? totalQty + ' متوفر' : 'خلص') + '</div>' +
      '</div>';
    }).join('');

    Array.prototype.forEach.call(grid.querySelectorAll('.pos-product'), function (el) {
      el.addEventListener('click', function () { openVariantPicker(el.getAttribute('data-id')); });
    });
  }

  function openVariantPicker(productId) {
    var product = catalog.filter(function (p) { return p.id === productId; })[0];
    if (!product) return;

    var existingOverlay = document.getElementById('pos-picker-overlay');
    if (existingOverlay) existingOverlay.remove();

    var overlay = document.createElement('div');
    overlay.id = 'pos-picker-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:50;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff; border-radius:10px; padding:20px; max-width:360px; width:90%;';
    box.innerHTML = '<h3>' + product.name + '</h3><div class="pos-variant-picker" id="pos-variant-list"></div>' +
      '<button id="pos-picker-close" style="background:#7f8c8d;">إغلاق</button>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var list = box.querySelector('#pos-variant-list');
    (product.variants || []).forEach(function (v) {
      var btn = document.createElement('button');
      btn.className = 'pos-variant-btn';
      btn.textContent = v.label + ' (' + v.quantity + ')';
      btn.disabled = v.quantity <= 0;
      btn.addEventListener('click', function () {
        addToCart(product, v);
        overlay.remove();
      });
      list.appendChild(btn);
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    box.querySelector('#pos-picker-close').addEventListener('click', function () { overlay.remove(); });
  }

  function addToCart(product, variant) {
    var existing = cart.filter(function (c) { return c.product_id === product.id && c.variant === variant.label; })[0];
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ product_id: product.id, name: product.name, price: product.price, variant: variant.label, quantity: 1 });
    }
    renderCart();
  }

  function renderCart() {
    var container = document.getElementById('pos-cart-items');
    if (cart.length === 0) {
      container.innerHTML = '<div class="hint">السلة فاضية</div>';
    } else {
      container.innerHTML = cart.map(function (item, i) {
        return '<div class="pos-cart-line">' +
          '<span>' + item.name + (item.variant ? ' (' + item.variant + ')' : '') + ' × ' + item.quantity + '</span>' +
          '<span><button data-i="' + i + '" class="pos-remove-btn">حذف</button></span>' +
        '</div>';
      }).join('');
      Array.prototype.forEach.call(container.querySelectorAll('.pos-remove-btn'), function (btn) {
        btn.addEventListener('click', function () {
          cart.splice(Number(btn.getAttribute('data-i')), 1);
          renderCart();
        });
      });
    }

    var total = cart.reduce(function (sum, item) { return sum + Number(item.price) * item.quantity; }, 0);
    document.getElementById('pos-cart-total').textContent = 'الإجمالي: ' + total + ' د.ل';
  }

  document.getElementById('pos-search').addEventListener('input', function (e) { renderGrid(e.target.value); });

  document.getElementById('pos-checkout-btn').addEventListener('click', function () {
    var messageEl = document.getElementById('pos-message');
    messageEl.className = '';
    messageEl.textContent = '';

    if (cart.length === 0) {
      messageEl.className = 'error';
      messageEl.textContent = 'زيد منتجات للسلة الأول';
      return;
    }

    fetch('/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: cart }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          messageEl.className = 'success';
          messageEl.textContent = 'تم تسجيل البيع بنجاح';
          cart = [];
          renderCart();
          setTimeout(function () { window.location.reload(); }, 1200);
        } else if (result.data.reason === 'insufficient_stock') {
          var names = result.data.shortItems.map(function (i) {
            return i.name + (i.variant ? ' (' + i.variant + ')' : '');
          }).join('، ');
          messageEl.className = 'error';
          messageEl.textContent = 'الكمية مو كافية لـ: ' + names + ' — يمكن انباع توا من الاونلاين أو جهاز ثاني. حدث الصفحة وشوف الكمية الجديدة.';
        } else {
          messageEl.className = 'error';
          messageEl.textContent = result.data.reason || 'صار خطأ، جرب مرة ثانية';
        }
      })
      .catch(function () {
        messageEl.className = 'error';
        messageEl.textContent = 'صار خطأ بالاتصال، جرب مرة ثانية';
      });
  });

  renderGrid('');
  renderCart();
})();
`;
}

module.exports = router;
