import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const table = sqliteTable('t', {
  id: text('id').primaryKey(),
  ca: text('created_at').default(sql`(datetime('now'))`)
});

const db = drizzle(new Database(':memory:'));
console.log(db.insert(table).values({ id: '1' }).toSQL());
