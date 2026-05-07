const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');

const table = sqliteTable('t', {
  id: text('id').primaryKey(),
  ca: text('created_at').default(sql`(datetime('now'))`)
});

const db = drizzle(new Database(':memory:'));
console.log(db.insert(table).values({ id: '1' }).toSQL());
