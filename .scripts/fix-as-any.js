/**
 * Bulk fix 'as any' patterns in route files
 * Run with: node .scripts/fix-as-any.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ROUTES_DIR = join(ROOT, 'functions/api/routes');

// Find all .ts files (excluding test files)
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
console.log(`Found ${routeFiles.length} route files to process`);

let totalReplacements = 0;

for (const filePath of routeFiles) {
  let content = readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace(ROOT + '/', '');
  let fileReplacements = 0;

  const originalContent = content;

  // 1. Add errorResponses import if not present (before middleware import)
  if (!content.includes('errorResponses') && content.includes('from "../middleware"')) {
    content = content.replace(
      /(import.*from.*["'].\.\.\/middleware["'];)/,
      '$1\nimport { errorResponses } from "../../../shared/errors/api";'
    );
    fileReplacements++;
  }

  // 2. Replace common error response patterns (order matters - more specific first)
  const replacements = [
    // Not found errors
    [/return c\.json\(\{ error: "Post not found" \} as any, 404 as any\)/g, 'return errorResponses.notFound(c, "Post")'],
    [/return c\.json\(\{ error: "Doc not found" \} as any, 404 as any\)/g, 'return errorResponses.notFound(c, "Doc")'],
    [/return c\.json\(\{ error: "Event not found" \} as any, 404 as any\)/g, 'return errorResponses.notFound(c, "Event")'],
    [/return c\.json\(\{ error: "User not found" \} as any, 404 as any\)/g, 'return errorResponses.notFound(c, "User")'],
    [/return c\.json\(\{ error: ".*? not found" \} as any, 404 as any\)/g, 'return errorResponses.notFound(c)'],
    [/return c\.json\(\{ error: ".*? not found" \} as any, 404\)/g, 'return errorResponses.notFound(c)'],
    [/return c\.json\(\{ error: "Not found" \}, 404 as const\)/g, 'return errorResponses.notFound(c)'],
    [/return c\.json\(\{ error: "Not found" \} as any, 404\)/g, 'return errorResponses.notFound(c)'],

    // Unauthorized errors
    [/return c\.json\(\{ error: "Unauthorized" \} as any, 401 as any\)/g, 'return errorResponses.unauthorized(c)'],
    [/return c\.json\(\{ error: "Unauthorized:.*?" \} as any, 401\)/g, 'return errorResponses.unauthorized(c)'],
    [/return c\.json\(\{ error: ".*?unauthorized.*?" \} as any, 401\)/g, 'return errorResponses.unauthorized(c)'],

    // Forbidden errors
    [/return c\.json\(\{ error: "Forbidden" \} as any, 403 as any\)/g, 'return errorResponses.forbidden(c)'],
    [/return c\.json\(\{ error: ".*?forbidden.*?" \} as any, 403\)/g, 'return errorResponses.forbidden(c)'],

    // Bad request errors
    [/return c\.json\(\{ error: ".*?" \} as any, 400 as any\)/g, (match) => {
      const msg = match.match(/error: "(.*?)"/)?.[1] || 'Bad request';
      return `return errorResponses.badRequest(c, "${msg}")`;
    }],
    [/return c\.json\(\{ error: ".*?" \} as any, 400\)/g, 'return errorResponses.badRequest(c)'],

    // Too many requests
    [/return c\.json\(\{ error: "Too many.*?" \} as any, 429 as any\)/g, 'return errorResponses.tooManyRequests(c)'],
    [/return c\.json\(\{ error: "Too many.*?" \}, 429 as const\)/g, 'return errorResponses.tooManyRequests(c)'],

    // Internal server errors (more specific first)
    [/return c\.json\(\{ error: ".*? failed" \} as any, 500 as any\)/g, 'return errorResponses.internalError(c)'],
    [/return c\.json\(\{ error: ".*? failed" \} as any, 500\)/g, 'return errorResponses.internalError(c)'],
    [/return c\.json\(\{ error: "Database error" \} as any, 500\)/g, 'return errorResponses.internalError(c)'],
    [/return c\.json\(\{ error: "Write failed" \} as any, 500\)/g, 'return errorResponses.internalError(c)'],
    [/return c\.json\(\{ error: ".*?" \} as any, 500 as any\)/g, 'return errorResponses.internalError(c)'],
    [/return c\.json\(\{ error: ".*?" \} as any, 500\)/g, 'return errorResponses.internalError(c)'],

    // Remove `as const` from status codes
    [/(\d+) as const/g, '$1'],

    // Remove `) as any` from route definitions
    [/\) as any\);/g, ');'],
    [/ as any,/g, ','],
    [/ as any\)/g, ')'],

    // Replace `(c: any) =>` with `(c) =>`
    [/\(c: any\)/g, '(c)'],
  ];

  for (const [pattern, replacement] of replacements) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      const count = (before.match(pattern) || []).length;
      fileReplacements += count;
    }
  }

  // Only write if changes were made
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ ${relativePath}: ${fileReplacements} replacements`);
    totalReplacements += fileReplacements;
  }
}

console.log(`\nDone! Made ${totalReplacements} total replacements.`);

// Count remaining 'as any'
const { execSync } = await import('child_process');
try {
  const remaining = execSync('grep -r "as any" functions/api/routes --include="*.ts" | wc -l', { cwd: ROOT, encoding: 'utf-8' });
  console.log(`Remaining 'as any' occurrences: ${remaining.trim()}`);
} catch {
  console.log('Could not count remaining occurrences');
}
