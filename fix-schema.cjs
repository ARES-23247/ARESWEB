const fs = require('fs');
const path = require('path');
const p = path.resolve('src/db/schema.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/sql\`\(datetime\('now'\)\)\`/g, "sql`CURRENT_TIMESTAMP`");
fs.writeFileSync(p, content);
console.log("Replaced instances in schema.ts");
