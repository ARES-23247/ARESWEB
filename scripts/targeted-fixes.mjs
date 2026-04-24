import fs from 'fs';

// 1. comments.ts
let cStr = fs.readFileSync('functions/api/routes/comments.ts', 'utf8');
cStr = cStr.replace(/"c\.updated_at as updated_at"/g, '"c.updated_at"');
cStr = cStr.replace(/updated_at:\s*new\s*Date\(\)\.toISOString\(\)\s*as\s*any/g, ''); // remove it from set
cStr = cStr.replace(/content,\s*updated_at:\s*new\s*Date\(\)\.toISOString\(\)/g, 'content'); // remove it from set
cStr = cStr.replace(/set\(\{ content, \}\)/g, 'set({ content })');
cStr = cStr.replace(/set\(\{ content \}\)/g, 'set({ content })');
fs.writeFileSync('functions/api/routes/comments.ts', cStr);

// 2. events/handlers.ts
let eStr = fs.readFileSync('functions/api/routes/events/handlers.ts', 'utf8');
eStr = eStr.replace(/\.join\("user as u"/g, '.innerJoin("user as u"');
fs.writeFileSync('functions/api/routes/events/handlers.ts', eStr);

// 3. github.ts
let gStr = fs.readFileSync('functions/api/routes/github.ts', 'utf8');
gStr = gStr.replace(/boardResults\.map\(/g, '(boardResults as any[]).map(');
fs.writeFileSync('functions/api/routes/github.ts', gStr);

// 4. judges.ts
let jStr = fs.readFileSync('functions/api/routes/judges.ts', 'utf8');
jStr = jStr.replace(/label:\s*label\s*\|\|\s*"Judge Access"\s*as\s*any,/g, '');
jStr = jStr.replace(/expires_at:\s*expiresAt\s*\|\|\s*null\s*as\s*any/g, '');
fs.writeFileSync('functions/api/routes/judges.ts', jStr);

// 5. logistics.ts
let lStr = fs.readFileSync('functions/api/routes/logistics.ts', 'utf8');
if (!lStr.includes('import { AppEnv')) {
  lStr = 'import { AppEnv, ensureAdmin } from "../middleware";\nimport { Kysely } from "kysely";\nimport { DB } from "../../../src/schemas/database";\n' + lStr;
}
fs.writeFileSync('functions/api/routes/logistics.ts', lStr);

// 6. notifications.ts
let nStr = fs.readFileSync('functions/api/routes/notifications.ts', 'utf8');
if (!nStr.includes('import { AppEnv')) {
  nStr = 'import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware } from "../middleware";\nimport { Kysely } from "kysely";\nimport { DB } from "../../../src/schemas/database";\n' + nStr;
}
fs.writeFileSync('functions/api/routes/notifications.ts', nStr);

// 7. tba.ts
let tStr = fs.readFileSync('functions/api/routes/tba.ts', 'utf8');
if (!tStr.includes('import { Kysely')) {
  tStr = 'import { Kysely } from "kysely";\nimport { DB } from "../../../src/schemas/database";\n' + tStr;
}
fs.writeFileSync('functions/api/routes/tba.ts', tStr);

console.log("Applied surgical import and syntax fixes.");
