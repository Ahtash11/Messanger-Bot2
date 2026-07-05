// Fake catalog used only when MOCK_CATALOG=true. Edit these freely to test
// with products that resemble what you actually sell — names, prices, and
// image URLs are all made up / placeholders. Swap MOCK_CATALOG=false once
// you're ready to connect your real WooCommerce store.

const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'قميص أبيض قطن',
    price: '45',
    in_stock: true,
    image_url: 'https://placehold.co/600x600/e8e8e8/333?text=White+Shirt',
    variants: [{ name: 'Size', options: ['S', 'M', 'L', 'XL'] }],
    short_description: 'قميص قطن أبيض، مقاسات متوفرة',
  },
  {
    id: 2,
    name: 'بنطلون جينز أزرق',
    price: '60',
    in_stock: true,
    image_url: 'https://placehold.co/600x600/2c3e50/fff?text=Blue+Jeans',
    variants: [{ name: 'Size', options: ['30', '32', '34', '36'] }],
    short_description: 'جينز أزرق كلاسيك',
  },
  {
    id: 3,
    name: 'حذاء رياضي أسود',
    price: '85',
    in_stock: true,
    image_url: 'https://placehold.co/600x600/111/fff?text=Black+Sneakers',
    variants: [{ name: 'Size', options: ['40', '41', '42', '43', '44'] }],
    short_description: 'حذاء رياضي مريح للاستخدام اليومي',
  },
  {
    id: 4,
    name: 'جاكيت جلد بني',
    price: '150',
    in_stock: false,
    image_url: 'https://placehold.co/600x600/6b4423/fff?text=Leather+Jacket',
    variants: [{ name: 'Size', options: ['M', 'L'] }],
    short_description: 'جاكيت جلد طبيعي، حالياً غير متوفر',
  },
];

function searchMock(query) {
  const tokens = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1); // drop stray single letters/punctuation

  if (tokens.length === 0) return MOCK_PRODUCTS;

  // Match if ANY word from the query appears in the product's name or
  // description. This is deliberately loose — Arabic plurals/singulars
  // (e.g. قميص vs قمصان) don't share enough letters for substring matching
  // on the full phrase to work, so we match word-by-word instead and let
  // Claude use judgement about which result is actually relevant.
  return MOCK_PRODUCTS.filter((p) => {
    const haystack = `${p.name} ${p.short_description}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
}

function getMockById(id) {
  return MOCK_PRODUCTS.find((p) => p.id === Number(id)) || null;
}

module.exports = { searchMock, getMockById };
