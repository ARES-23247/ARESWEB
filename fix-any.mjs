import fs from 'fs';
import path from 'path';

const routesDir = 'functions/api/routes';

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = walkDir(routesDir);
let totalFixed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Pattern: the type alias was inserted INSIDE an import block
  // Detect: import { \n<stuff>type AppRouteHandler...\n<more import stuff>
  // Fix: move the type alias AFTER the import block ends
  
  const brokenPattern = /^(import \{[^}]*)\n(type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;)\n([^}]*\} from [^\n]+;)/m;
  
  const match = content.match(brokenPattern);
  if (match) {
    // Reconstruct: put the import back together, then add the type alias after
    const fixedImport = match[1] + '\n' + match[3];
    const typeAlias = '\n' + match[2];
    content = content.replace(match[0], fixedImport + typeAlias);
    
    fs.writeFileSync(file, content, 'utf8');
    totalFixed++;
    console.log(`Repaired: ${file}`);
  }
}

console.log(`\nTotal files repaired: ${totalFixed}`);
