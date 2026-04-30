import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Path to the sqlite database
const dbPath = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'b50f39d2832143fa7eaf6a5820bc2ecd2a7a0bfa314804344cf78d3ff9b5f198.sqlite');

console.log('Connecting to database:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found!');
  process.exit(1);
}

const db = new Database(dbPath);

console.log('Reading remote_docs_utf8.json...');
const jsonString = fs.readFileSync('remote_docs_utf8.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(jsonString);
const docs = data[0].results;

console.log(`Found ${docs.length} documents. Inserting into database...`);

const insertDoc = db.prepare(`
  INSERT OR REPLACE INTO docs (
    slug, title, category, sort_order, description, content, 
    updated_at, cf_email, is_deleted, is_portfolio, 
    is_executive_summary, status, revision_of, content_draft
  ) VALUES (
    @slug, @title, @category, @sort_order, @description, @content, 
    @updated_at, @cf_email, @is_deleted, @is_portfolio, 
    @is_executive_summary, @status, @revision_of, @content_draft
  )
`);

const insertMany = db.transaction((docs) => {
  for (const doc of docs) {
    insertDoc.run(doc);
  }
});

insertMany(docs);

console.log('Docs restored successfully!');
db.close();
