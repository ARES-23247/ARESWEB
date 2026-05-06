const fs = require('fs');
let c = fs.readFileSync('functions/api/routes/docs.ts', 'utf8');
let targetStr = 'return c.json({ error: "Purge failed" }, 500);';
let idx = c.lastIndexOf(targetStr);
if (idx !== -1) {
  c = c.substring(0, idx + targetStr.length) + '\n  }\n}));\n\nexport default docsRouter;\n';
  fs.writeFileSync('functions/api/routes/docs.ts', c);
  console.log('Fixed docs.ts');
} else {
  console.log('Target string not found');
}
