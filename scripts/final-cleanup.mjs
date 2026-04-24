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

  // 1. Fix no-empty-pattern: async ({}, c) -> async (_: any, c)
  content = content.replace(/async\s*\(\{\},\s*([a-zA-Z0-9_]+)/g, 'async (_: any, $1');

  // 2. Fix unused _err variables: catch (_err) { -> catch {
  // Only if the block is empty or doesn't use _err
  // Simpler: just replace catch (_err) with catch
  content = content.replace(/catch\s*\(_err\)/g, 'catch');

  fs.writeFileSync(filePath, content);
}

console.log("Cleaned up no-empty-pattern and unused _err in " + files.length + " files.");
