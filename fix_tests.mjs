import fs from 'fs';
import path from 'path';

const files = [
  'functions/api/routes/posts.test.ts',
  'functions/api/routes/docs.test.ts',
  'functions/api/routes/comments.test.ts',
  'functions/api/routes/sponsors.test.ts',
  'functions/api/routes/outreach.test.ts',
  'functions/api/routes/settings.test.ts',
  'functions/api/routes/auth.test.ts',
  'functions/api/routes/badges.test.ts',
  'functions/api/routes/profiles.test.ts',
  'functions/api/routes/users.test.ts',
  'functions/api/routes/events/index.test.ts',
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  
  // Add import if missing
  const depth = file.split('/').length - 1;
  const dots = '../'.repeat(depth + 1);
  const importPath = `${dots}src/test/utils`;
  const importStmt = `import { mockExecutionContext } from "${importPath}";`;
  
  if (!content.includes('mockExecutionContext')) {
    // Insert after first line or first import
    const lines = content.split('\n');
    lines.splice(1, 0, importStmt);
    content = lines.join('\n');
  } else if (!content.includes(`from "${importPath}"`)) {
      // If used but not imported (global)
      const lines = content.split('\n');
      lines.splice(1, 0, importStmt);
      content = lines.join('\n');
  }

  // Update request calls
  // Find router name
  const routerMatch = content.match(/import (\w+) from "\.\/(\w+)"/);
  if (routerMatch) {
    const routerName = routerMatch[1];
    const regex = new RegExp(`${routerName}\\.request\\(req, {}, env\\)`, 'g');
    content = content.replace(regex, `${routerName}.request(req, {}, env, mockExecutionContext)`);
  } else {
      // try other patterns if needed
      content = content.replace(/\.request\(req, {}, env\)/g, '.request(req, {}, env, mockExecutionContext)');
  }

  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
});
