#!/usr/bin/env node

/**
 * Script to fix test files to use Drizzle ORM API patterns
 * instead of Kysely-style patterns.
 */

const fs = require('fs');
const path = require('path');

// Test files that need to be fixed
const testFiles = [
  'functions/api/routes/users.test.ts',
  'functions/api/routes/githubWebhook.test.ts',
  'functions/api/routes/media.test.ts',
  'functions/api/routes/docs.test.ts',
  'functions/api/routes/profiles.test.ts',
  'functions/api/routes/ai/indexer.test.ts',
  'functions/api/routes/ai/reindex.test.ts',
  'functions/api/routes/points.test.ts',
  'functions/api/routes/logistics.test.ts',
  'functions/api/routes/communications.test.ts',
  'functions/api/routes/github.test.ts',
  'functions/api/routes/sponsors.test.ts',
  'functions/api/routes/seasons.test.ts',
  'functions/api/routes/awards.test.ts',
  'functions/api/routes/zulipWebhook.test.ts',
  'functions/utils/gcalSync.test.ts',
];

const replacements = [
  { from: 'selectFrom', to: 'select' },
  { from: 'insertInto', to: 'insert' },
  { from: 'updateTable', to: 'update' },
  { from: 'deleteFrom', to: 'delete' },
];

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const { from, to } of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
    return true;
  }

  return false;
}

// Fix all test files
let fixedCount = 0;
for (const testFile of testFiles) {
  const fullPath = path.join(process.cwd(), testFile);
  if (fixFile(fullPath)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} test files`);
