const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'قميص أبيض قطن',
    price: '45',
    in_stock: true,
    image_url: 'https://picsum.photos/id/26/600/600',
    variants: [{ name: 'Size', options: ['S', 'M', 'L', 'XL'] }],
    short_description: 'قميص قطن أبيض، مقاسات متوفرة',
  },
  {
    id: 2,
    name: 'بنطلون جينز أزرق',
    price: '60',
    in_stock: true,
    image_url: 'https://picsum.photos/id/48/600/600',
    variants: [{ name: 'Size', options: ['30', '32', '34', '36'] }],
    short_description: 'جينز أزرق كلاسيك',
  },
  {
    id: 3,
    name: 'حذاء رياضي أسود',
    price: '85',
    in_stock: true,
    image_url: 'https://picsum.photos/id/103/600/600',
    variants: [{ name: 'Size', options: ['40', '41', '42', '43', '44'] }],
    short_description: 'حذاء رياضي مريح للاستخدام اليومي',
  },
  {
    id: 4,
    name: 'جاكيت جلد بني',
    price: '150',
    in_stock: false,
    image_url: ' https://picsum.photos/id/21/600/600',
    variants: [{ name: 'Size', options: ['M', 'L'] }],
    short_description: 'جاكيت جلد طبيعي، حالياً غير متوفر',
  },
];

function searchMock(query) {
  const tokens = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (tokens.length === 0) return MOCK_PRODUCTS;

  return MOCK_PRODUCTS.filter((p) => {
    const haystack = `${p.name} ${p.short_description}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
}

function getMockById(id) {
  return MOCK_PRODUCTS.find((p) => p.id === Number(id)) || null;
}

module.exports = { searchMock, getMockById };
