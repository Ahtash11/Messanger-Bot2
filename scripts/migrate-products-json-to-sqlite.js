// One-time import: reads the old products.json (whichever file
// INVENTORY_FILE_PATH points at, or the bundled seed if unset) and inserts
// every product/variant into the new SQLite database — same ids, labels,
// and quantities, so current live stock isn't lost or reset.
//
// Safe to re-run: skips any product id that already exists in the database
// rather than erroring or duplicating it.
//
// Usage: node scripts/migrate-products-json-to-sqlite.js

const fs = require('fs');
const path = require('path');
const { config } = require('../src/config');
const db = require('../src/db');

const SEED_FILE = path.join(__dirname, '..', 'src', 'data', 'products.json');
const SOURCE_FILE = config.inventoryFilePath || SEED_FILE;

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`No products file found at ${SOURCE_FILE} — nothing to migrate.`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, price, image_url, description, keywords_json, images_json)
    VALUES (@id, @name, @price, @image_url, @description, @keywords_json, @images_json)
  `);
  const insertVariant = db.prepare(`
    INSERT INTO variants (product_id, label, quantity) VALUES (?, ?, ?)
  `);
  const productExists = db.prepare('SELECT 1 FROM products WHERE id = ?');

  const importAll = db.transaction((items) => {
    let imported = 0;
    let skipped = 0;

    for (const p of items) {
      if (productExists.get(p.id)) {
        skipped++;
        continue;
      }

      insertProduct.run({
        id: p.id,
        name: p.name,
        price: String(p.price),
        image_url: p.image_url || null,
        description: p.description || '',
        keywords_json: JSON.stringify(p.keywords || []),
        images_json: JSON.stringify(p.images || {}),
      });

      for (const v of p.variants || []) {
        insertVariant.run(p.id, v.label, v.quantity || 0);
      }

      imported++;
    }

    return { imported, skipped };
  });

  const { imported, skipped } = importAll(products);
  console.log(`Migration complete: ${imported} product(s) imported, ${skipped} already present (skipped).`);
  console.log(`Source: ${SOURCE_FILE}`);
}

main();
