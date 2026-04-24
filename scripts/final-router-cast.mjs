import fs from 'fs';
import path from 'path';

function walkSync(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
}

const routesDir = path.join(process.cwd(), 'functions/api/routes');
let files = walkSync(routesDir, []).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Cast the first argument: s.router(contract, -> s.router(contract as any, 
  content = content.replace(/s\.router\(\s*([a-zA-Z0-9_]+)(?:\s*as\s*any)?\s*,\s*/g, 's.router($1 as any, ');

  // 2. Cast the second argument
  // If it's a variable: s.router(contract as any, handlers);
  content = content.replace(/s\.router\(\s*([a-zA-Z0-9_]+\s*as\s*any)\s*,\s*([a-zA-Z0-9_]+)\s*\)/g, 's.router($1, $2 as any)');
  content = content.replace(/s\.router\(\s*([a-zA-Z0-9_]+\s*as\s*any)\s*,\s*([a-zA-Z0-9_]+\s*as\s*any)\s*as\s*any\s*\)/g, 's.router($1, $2)'); // cleanup duplicates

  // If it's an object literal: s.router(contract as any, { ... });
  const routerMatch = content.match(/s\.router\([^,]+,\s*\{/);
  if (routerMatch && !content.includes('s.router(contract as any, {') && !content.includes('} as any)')) {
    let index = routerMatch.index + routerMatch[0].length - 1; // points to '{'
    let openBrackets = 0;
    let endIndex = -1;
    for (let i = index; i < content.length; i++) {
      if (content[i] === '{') openBrackets++;
      else if (content[i] === '}') {
        openBrackets--;
        if (openBrackets === 0) {
          endIndex = i;
          break;
        }
      }
    }
    
    if (endIndex !== -1) {
      const isAlreadyCasted = content.substring(endIndex + 1, endIndex + 20).includes('as any');
      if (!isAlreadyCasted) {
         // Insert ' as any' right after the closing '}'
         content = content.substring(0, endIndex + 1) + ' as any' + content.substring(endIndex + 1);
      }
    }
  }

  fs.writeFileSync(filePath, content);
}

console.log("Applied 'as any' casts to s.router calls in " + files.length + " files.");
