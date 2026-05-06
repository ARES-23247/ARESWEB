const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../functions/api/routes');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(routesDir);
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('typedHandler') && !content.includes('import { typedHandler }')) {
    let depth = file.split(path.sep).length - routesDir.split(path.sep).length;
    let relPath = '../'.repeat(depth) + 'utils/handler';
    
    let lastImportIdx = content.lastIndexOf('import ');
    if (lastImportIdx !== -1) {
      let eol = content.indexOf('\n', lastImportIdx);
      content = content.substring(0, eol + 1) + `import { typedHandler } from "${relPath}";\n` + content.substring(eol + 1);
    } else {
      content = `import { typedHandler } from "${relPath}";\n` + content;
    }
    
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
});
console.log(`Added imports to ${changed} files.`);
