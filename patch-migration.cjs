const fs = require('fs');

const sqlFile = 'drizzle/0002_pretty_forgotten_one.sql';
let sql = fs.readFileSync(sqlFile, 'utf8');

// 1. Add IF NOT EXISTS for chat_sessions
const chatSessionsRegex = /CREATE TABLE `__new_chat_sessions` \([\s\S]*?\);\n--> statement-breakpoint/g;
const chatSessionsMatch = chatSessionsRegex.exec(sql);
if (chatSessionsMatch) {
  const dummyTable = `CREATE TABLE IF NOT EXISTS \`chat_sessions\` (
	\`id\` text PRIMARY KEY,
	\`user_id\` text NOT NULL,
	\`history\` text NOT NULL,
	\`created_at\` text DEFAULT (datetime('now')),
	\`updated_at\` text DEFAULT (datetime('now')),
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint\n`;
  sql = sql.replace(chatSessionsMatch[0], dummyTable + chatSessionsMatch[0]);
}

// 2. Add IF NOT EXISTS for external_knowledge_sources
const eksRegex = /CREATE TABLE `__new_external_knowledge_sources` \([\s\S]*?\);\n--> statement-breakpoint/g;
const eksMatch = eksRegex.exec(sql);
if (eksMatch) {
  const dummyTable = `CREATE TABLE IF NOT EXISTS \`external_knowledge_sources\` (
	\`id\` text PRIMARY KEY,
	\`type\` text NOT NULL,
	\`url\` text NOT NULL,
	\`branch\` text,
	\`status\` text DEFAULT 'pending',
	\`last_indexed_sha\` text,
	\`last_indexed_at\` text,
	\`created_at\` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint\n`;
  sql = sql.replace(eksMatch[0], dummyTable + eksMatch[0]);
}

// 3. Fix missing tables that need dummy tables before their __new_ block
const tablesToCreate = ['points_ledger', 'scouting_analyses', 'social_queue'];

tablesToCreate.forEach(t => {
  const regex = new RegExp('CREATE TABLE `__new_' + t + '` \\([\\s\\S]*?\\);\\n--> statement-breakpoint', 'g');
  const match = regex.exec(sql);
  
  if (match) {
    const createStmt = match[0].replace('`__new_' + t + '`', 'IF NOT EXISTS `' + t + '`');
    sql = sql.replace(match[0], createStmt + '\n' + match[0]);
  }
});

// 4. Add created_at to __new_posts
const postsRegex = /(`season_id` integer,\n)([\s\S]*?`updated_at` text DEFAULT CURRENT_TIMESTAMP,)/;
sql = sql.replace(postsRegex, '$1\t`created_at` text DEFAULT CURRENT_TIMESTAMP,\n$2');

fs.writeFileSync(sqlFile, sql);
console.log('Patched ' + sqlFile);
