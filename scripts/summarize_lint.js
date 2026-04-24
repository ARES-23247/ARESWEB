import fs from 'fs';

const data = fs.readFileSync('lint_results.json', 'utf8');
// Strip BOM if present
const content = data.startsWith('\ufeff') ? data.slice(1) : data;
const startIndex = content.indexOf('[');
if (startIndex === -1) {
  console.error("No JSON array found in lint_results.json");
  process.exit(1);
}
const results = JSON.parse(content.substring(startIndex));

const summary = results.filter(r => r.warningCount > 0).map(r => {
  const filePath = r.filePath.replace(/.*functions/, 'functions').replace(/.*src/, 'src');
  const messages = r.messages.map(m => `  L${m.line}:${m.column} - ${m.ruleId}: ${m.message}`).join('\n');
  return `File: ${filePath} (${r.warningCount} warnings)\n${messages}\n`;
}).join('\n---\n\n');

console.log(summary);
