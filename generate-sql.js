const fs = require('fs');
let content = fs.readFileSync('original_schema.sql', 'utf8');

// remove comments
content = content.replace(/\/\*[\s\S]*?\*\//g, '');
content = content.replace(/CREATE TABLE/g, 'CREATE TABLE IF NOT EXISTS');
content = content.replace(/CREATE INDEX/g, 'CREATE INDEX IF NOT EXISTS');
content = content.replace(/--> statement-breakpoint/g, '');

const tables = [...content.matchAll(/CREATE TABLE IF NOT EXISTS `([^`]+)`/g)].map(m => m[1]);
const drops = tables.map(t => `DROP TABLE IF EXISTS \`${t}\`;`).join('\n');

const finalContent = `DROP TABLE IF EXISTS \`d1_migrations\`;\n${drops}\n\n${content}`;
fs.writeFileSync('scripts/setup-preview-db.sql', finalContent);
