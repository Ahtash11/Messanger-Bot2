const express = require('express');
const { config } = require('../config');
const inventory = require('../services/inventory');

const router = express.Router();

function checkKey(req, res) {
  if (config.debugKey && req.query.key !== config.debugKey) {
    res.status(403).send('Forbidden — add ?key=your_secret to the URL');
    return false;
  }
  return true;
}

function keyParam(req) {
  return config.debugKey ? `key=${encodeURIComponent(req.query.key || '')}` : '';
}

function withKey(path, req) {
  const kp = keyParam(req);
  return kp ? `${path}${path.includes('?') ? '&' : '?'}${kp}` : path;
}

function page(body) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>إدارة المنتجات</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 30px auto; padding: 0 15px; background:#f7f7f7; }
  h1 { font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; background:#fff; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 14px; }
  th { background: #2c3e50; color: white; }
  form { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  label { display: block; margin-top: 12px; font-weight: bold; font-size: 14px; }
  input, textarea { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; font-size: 14px; }
  textarea { height: 140px; font-family: monospace; direction: ltr; text-align: left; }
  button { margin-top: 16px; padding: 10px 20px; background: #2c3e50; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer; }
  button.danger { background: #c0392b; }
  .msg { padding: 10px; border-radius: 4px; margin-bottom: 15px; }
  .success { background: #d4edda; color: #155724; }
  .error { background: #f8d7da; color: #721c24; }
  .hint { color: #666; font-size: 13px; margin-top: 2px; }
  .actions a, .actions button { font-size: 13px; margin-left: 8px; }
  .actions form { display: inline; background: none; padding: 0; }
  a.back { display:inline-block; margin-bottom: 15px; }
</style>
</head>
<body>${body}</body>
</html>`;
}

function variantsToText(variants) {
  return (variants || []).map((v) => `${v.label}: ${v.quantity}`).join('\n');
}

function parseVariantsText(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.lastIndexOf(':');
      if (idx === -1) return null;
      const label = line.slice(0, idx).trim();
      const quantity = parseInt(line.slice(idx + 1).trim(), 10);
      return label && !isNaN(quantity) ? { label, quantity } : null;
    })
    .filter(Boolean);
}

// Format: "<color> = <url>" per line. Using "=" (not ":") as the separator
// deliberately — image URLs contain "https://" which has a colon in it, so
// splitting on ":" would break the URL. "=" never appears in a color name
// or a URL, so it's a safe delimiter here.
//
// Multiple photos per color (e.g. front + back) are supported by just
// repeating the same color on more than one line:
//   أسود = https://front.jpg
//   أسود = https://back.jpg
function colorImagesToText(images) {
  const lines = [];
  Object.entries(images || {}).forEach(([color, urls]) => {
    const list = Array.isArray(urls) ? urls : [urls]; // tolerate legacy single-string data
    list.forEach((url) => lines.push(`${color} = ${url}`));
  });
  return lines.join('\n');
}

function parseColorImagesText(text) {
  const images = {};
  (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const color = line.slice(0, idx).trim();
      const url = line.slice(idx + 1).trim();
      if (!color || !url) return;
      if (!images[color]) images[color] = [];
      images[color].push(url);
    });
  return images;
}

function redirectWithMsg(res, req, path, msg, ok) {
  const sep = path.includes('?') ? '&' : '?';
  res.redirect(`${withKey(path, req)}${sep}msg=${encodeURIComponent(msg)}&ok=${ok ? '1' : '0'}`);
}

// ── Product list + add-product form ──
router.get('/', (req, res) => {
  if (!checkKey(req, res)) return;

  const products = inventory.getRawInventory();

  const rows = products
    .map((p) => {
      const totalQty = (p.variants || []).reduce((s, v) => s + (v.quantity || 0), 0);
      const editUrl = withKey(`/admin/edit/${encodeURIComponent(p.id)}`, req);
      const deleteUrl = withKey(`/admin/delete/${encodeURIComponent(p.id)}`, req);
      return `<tr>
        <td>${p.id}</td><td>${p.name}</td><td>${p.price}</td>
        <td>${p.variants?.length || 0}</td><td>${totalQty}</td>
        <td class="actions">
          <a href="${editUrl}">تعديل</a>
          <form method="POST" action="${deleteUrl}" onsubmit="return confirm('متأكد تبي تمسح ${p.name}؟');">
            <button type="submit" class="danger">حذف</button>
          </form>
        </td>
      </tr>`;
    })
    .join('');

  const msg = req.query.msg
    ? `<div class="msg ${req.query.ok === '1' ? 'success' : 'error'}">${req.query.msg}</div>`
    : '';

  res.send(
    page(`
      <h1>المنتجات الحالية (${products.length})</h1>
      ${msg}
      <table>
        <tr><th>ID</th><th>الاسم</th><th>السعر</th><th>متغيرات</th><th>الكمية الكلية</th><th>إجراءات</th></tr>
        ${rows}
      </table>

      <h1>إضافة منتج جديد</h1>
      <form method="POST" action="${withKey('/admin/add-product', req)}">
        <label>Product ID (بالإنجليزي، بدون فراغات، مثال: red-hoodie)</label>
        <input name="id" required pattern="[a-z0-9\\-]+" />

        <label>اسم المنتج (بالعربي)</label>
        <input name="name" required />

        <label>السعر (د.ل)</label>
        <input name="price" required type="number" />

        <label>رابط الصورة الافتراضي (لو المنتج مالوش صور حسب اللون تحت)</label>
        <input name="image_url" />

        <label>صور حسب اللون (اختياري) — سطر واحد لكل صورة. لو تبي أكثر من صورة لنفس اللون (قدام وورا)، كرر نفس اللون بسطر ثاني:</label>
        <div class="hint">أسود = https://i.imgur.com/front.jpg</div>
        <div class="hint">أسود = https://i.imgur.com/back.jpg</div>
        <div class="hint">أزرق فاتح = https://i.imgur.com/yyyyy.jpg</div>
        <textarea name="color_images" placeholder="أسود = https://i.imgur.com/xxxxx.jpg&#10;أزرق فاتح = https://i.imgur.com/yyyyy.jpg"></textarea>

        <label>وصف المنتج (الخامة، القصة، ليه زين — يساعد البوت يبيع أحسن ويتعرف على الصور)</label>
        <input name="description" placeholder="مثال: قماش قطن ناعم، قصة كاجوال واسعة، مناسب للصيف" />

        <label>كلمات مفتاحية إضافية (افصل بفاصلة ,)</label>
        <input name="keywords" placeholder="مثال: هودي, سويتشيرت" />

        <label>المتغيرات (لون/مقاس + الكمية) — سطر واحد لكل متغير:</label>
        <div class="hint">أسود - M: 5</div>
        <div class="hint">أزرق - L: 3</div>
        <textarea name="variants" required placeholder="أسود - M: 5&#10;أزرق - L: 3"></textarea>

        <button type="submit">إضافة المنتج</button>
      </form>
    `)
  );
});

router.post('/add-product', express.urlencoded({ extended: true }), async (req, res) => {
  if (!checkKey(req, res)) return;

  const { id, name, price, image_url, description, keywords } = req.body;
  const variants = parseVariantsText(req.body.variants);
  const images = parseColorImagesText(req.body.color_images);

  if (!id || !name || !price || variants.length === 0) {
    return redirectWithMsg(res, req, '/admin', 'تأكد إنك عبيت كل الحقول المطلوبة والمتغيرات بالشكل الصحيح', false);
  }

  const result = await inventory.addProduct({
    id,
    name,
    price: String(price),
    image_url: image_url || null,
    images,
    description: description || '',
    keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
    variants,
  });

  redirectWithMsg(res, req, '/admin', result.success ? 'تمت إضافة المنتج بنجاح' : result.reason || 'صار خطأ', result.success);
});

// ── Edit an existing product ──
router.get('/edit/:id', async (req, res) => {
  if (!checkKey(req, res)) return;

  const product = await inventory.getProduct(req.params.id);
  if (!product) {
    return redirectWithMsg(res, req, '/admin', 'ما لقيتش هذا المنتج', false);
  }

  // getProduct's toBotShape drops "keywords" — pull the raw version too so
  // we can pre-fill it in the edit form.
  const raw = inventory.getRawInventory().find((p) => String(p.id) === String(req.params.id));

  res.send(
    page(`
      <a class="back" href="${withKey('/admin', req)}">&larr; رجوع للقائمة</a>
      <h1>تعديل: ${product.name}</h1>
      <form method="POST" action="${withKey(`/admin/edit/${encodeURIComponent(product.id)}`, req)}">
        <label>اسم المنتج</label>
        <input name="name" required value="${product.name}" />

        <label>السعر (د.ل)</label>
        <input name="price" required type="number" value="${product.price}" />

        <label>رابط الصورة الافتراضي (لو مافيش صورة للون المطلوب تحت)</label>
        <input name="image_url" value="${product.image_url || ''}" />

        <label>صور حسب اللون — سطر واحد لكل صورة (كرر نفس اللون لصورة قدام/ورا):</label>
        <div class="hint">أسود = https://i.imgur.com/front.jpg</div>
        <div class="hint">أسود = https://i.imgur.com/back.jpg</div>
        <textarea name="color_images">${colorImagesToText(product.images)}</textarea>

        <label>وصف المنتج (الخامة، القصة، ليه زين — يساعد البوت يبيع أحسن ويتعرف على الصور)</label>
        <input name="description" value="${product.short_description || ''}" placeholder="مثال: قماش قطن ناعم، قصة كاجوال واسعة، مناسب للصيف" />

        <label>كلمات مفتاحية إضافية (افصل بفاصلة ,)</label>
        <input name="keywords" value="${(raw?.keywords || []).join(', ')}" />

        <label>المتغيرات — عدّل أي رقم كمية عشان تضيف/تنقص قطع، أو زيد سطر جديد لمقاس/لون جديد، أو احذف سطر عشان توقف هذا المتغير:</label>
        <textarea name="variants" required>${variantsToText(product.variants)}</textarea>

        <button type="submit">حفظ التعديلات</button>
      </form>
    `)
  );
});

router.post('/edit/:id', express.urlencoded({ extended: true }), async (req, res) => {
  if (!checkKey(req, res)) return;

  const { name, price, image_url, description, keywords } = req.body;
  const variants = parseVariantsText(req.body.variants);
  const images = parseColorImagesText(req.body.color_images);

  if (!name || !price || variants.length === 0) {
    return redirectWithMsg(res, req, `/admin/edit/${encodeURIComponent(req.params.id)}`, 'تأكد إنك عبيت كل الحقول والمتغيرات بالشكل الصحيح', false);
  }

  const result = await inventory.updateProduct(req.params.id, {
    name,
    price: String(price),
    image_url: image_url || null,
    images,
    description: description || '',
    keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
    variants,
  });

  redirectWithMsg(res, req, '/admin', result.success ? 'تم حفظ التعديلات' : result.reason || 'صار خطأ', result.success);
});

// ── Delete a product ──
router.post('/delete/:id', async (req, res) => {
  if (!checkKey(req, res)) return;

  const result = await inventory.deleteProduct(req.params.id);
  redirectWithMsg(res, req, '/admin', result.success ? 'تم حذف المنتج' : result.reason || 'صار خطأ', result.success);
});

module.exports = router;
