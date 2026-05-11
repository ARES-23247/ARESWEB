import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';

const db = drizzle({} as any);
const t = sqliteTable('t', { id: text('id').primaryKey() });
console.log(db.insert(t).values({ id: '1' }).onConflictDoUpdate({ target: sql`id`, set: { id: '1' } }).toSQL());
