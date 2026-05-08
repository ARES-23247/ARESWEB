import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ROUTES_DIR = join(ROOT, 'functions/api/routes');

function findRouteFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const routeFiles = findRouteFiles(ROUTES_DIR);
console.log(`Processing ${routeFiles.length} route files...`);

let totalFixes = 0;

for (const filePath of routeFiles) {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Pattern: router.openapi(routeName, typedHandler<typeof routeName>(async (c) => {
  // Fix to: router.openapi(routeName, typedHandler<typeof routeName>(async (c) => { ... }) as any)

  // Fix: Replace the closing }) with }); as any) at the end of typedHandler routes
  // This pattern looks for .openapi(routeName, typedHandler<typeof ...>(async (c) => { ... })
  // and adds as any at the end

  content = content.replace(
    /(\.openapi\([^,]+,\s*typedHandler<typeof[^>]+>\(async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\})(\s*\);)/g,
    '$1 as any$2'
  );

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8');
    const fixes = (content.match(/as any\);/g) || []).length;
    totalFixes += fixes;
    console.log(`  ✓ ${filePath.replace(ROOT + '/', '')}: ${fixes} fixes`);
  }
}

console.log(`\nDone! Applied ${totalFixes} typedHandler registration casts.`);
