const fs = require('fs');
const path = require('path');
const glob = require('fs').readdirSync('functions/api/routes', {recursive:true});
let count = 0;
glob.forEach(f => {
  if (f.endsWith('.ts')) {
    let p = 'functions/api/routes/' + f;
    let c = fs.readFileSync(p, 'utf8');
    
    // Fix any incorrect import depths
    let normalizedPath = f.replace(/\\/g, '/');
    let depth = normalizedPath.split('/').length - 1;
    let relPath = depth === 0 ? '../utils/handler' : '../'.repeat(depth+1) + 'utils/handler';
    
    // Replace all incorrect imports of typedHandler
    let fixed = c.replace(/import\s+\{\s*typedHandler\s*\}\s+from\s+['"][^'"]+['"];?/g, `import { typedHandler } from "${relPath}";`);
    
    // Add import if missing
    if (fixed.includes('typedHandler') && !fixed.includes('import { typedHandler }')) {
      fixed = `import { typedHandler } from "${relPath}";\n` + fixed;
    }

    if (c !== fixed) {
      fs.writeFileSync(p, fixed);
      count++;
    }
  }
});
console.log(`Fixed paths in ${count} files.`);
