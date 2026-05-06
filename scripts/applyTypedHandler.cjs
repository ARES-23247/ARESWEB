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
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Remove `as AppRouteHandler<...>`
  content = content.replace(/\)\s*as\s+_?AppRouteHandler<[^>]+>/g, ')');
  content = content.replace(/\}\s*as\s+_?AppRouteHandler<[^>]+>/g, '}');

  // 2. Wrap handlers
  let idx = 0;
  while ((idx = content.indexOf('.openapi(', idx)) !== -1) {
    let startArg1 = idx + '.openapi('.length;
    let endArg1 = content.indexOf(',', startArg1);
    if (endArg1 === -1) { idx += 1; continue; }
    
    let routeName = content.substring(startArg1, endArg1).trim();
    
    let handlerStart = content.indexOf('async', endArg1);
    if (handlerStart === -1 || handlerStart > endArg1 + 50) { idx += 1; continue; }
    
    let preHandler = content.substring(endArg1 + 1, handlerStart);
    if (preHandler.includes('typedHandler')) {
      idx = handlerStart; continue;
    }

    let openParens = 1; 
    let i = startArg1;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    
    while (i < content.length && openParens > 0) {
      const char = content[i];
      const nextChar = content[i+1];
      
      if (!inString && !inTemplate) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '`') {
          inTemplate = true;
        } else if (char === '/' && nextChar === '/') {
          while (i < content.length && content[i] !== '\n') i++;
        } else if (char === '/' && nextChar === '*') {
          i += 2;
          while (i < content.length && !(content[i] === '*' && content[i+1] === '/')) i++;
          i++;
        } else if (char === '(') {
          openParens++;
        } else if (char === ')') {
          openParens--;
        }
      } else if (inString) {
        if (char === '\\') i++;
        else if (char === stringChar) inString = false;
      } else if (inTemplate) {
        if (char === '\\') i++;
        else if (char === '`') inTemplate = false;
      }
      i++;
    }
    
    let isWrapped = preHandler.includes('(');
    
    if (isWrapped) {
      let prefixEnd = content.lastIndexOf('(', handlerStart);
      content = content.substring(0, prefixEnd) + `typedHandler<typeof ${routeName}>(` + content.substring(prefixEnd + 1);
    } else {
      content = content.substring(0, handlerStart) + `typedHandler<typeof ${routeName}>(` + content.substring(handlerStart, i - 1) + ')' + content.substring(i - 1);
    }
    
    // Find the injected start offset
    let cAnyIdx = content.indexOf('(c: any)', handlerStart);
    if (cAnyIdx !== -1 && cAnyIdx < handlerStart + 100) {
      content = content.substring(0, cAnyIdx) + '(c)' + content.substring(cAnyIdx + 8);
    }
    
    idx = i + 20; 
  }
  
  if (content !== originalContent) {
    let depth = file.split(path.sep).length - routesDir.split(path.sep).length;
    let relPath = depth === 0 ? '../utils/handler' : '../'.repeat(depth) + '../utils/handler';
    
    if (!originalContent.includes('import { typedHandler }') && !content.includes('import { typedHandler }')) {
      content = `import { typedHandler } from "${relPath}";\n` + content;
    }
    
    content = content.replace(/type\s+_?AppRouteHandler<[^>]+>\s*=\s*RouteHandler<[^>]+>;\n?/g, '');
    
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
  }
});

console.log(`Updated ${changedFiles} files.`);
