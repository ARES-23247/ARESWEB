const fs = require('fs');
let sql = fs.readFileSync('drizzle/0000_gorgeous_mentor.sql', 'utf8');

// Regex to remove all tables containing 'fts' in the name
const ftsTableRegex = /CREATE TABLE \`[^\`]*fts[^\`]*\` \([\s\S]*?\);(\r?\n--> statement-breakpoint\r?\n)?/g;
sql = sql.replace(ftsTableRegex, '');

// Append correct virtual tables
const ftsAppend = `
CREATE VIRTUAL TABLE docs_fts USING fts5(
    slug UNINDEXED, title, category, description, content,
    status UNINDEXED, is_deleted UNINDEXED
);
--> statement-breakpoint
CREATE VIRTUAL TABLE posts_fts USING fts5(
    slug UNINDEXED, title, snippet, author, ast
);
--> statement-breakpoint
CREATE VIRTUAL TABLE events_fts USING fts5(
    id UNINDEXED, title, description, location,
    status UNINDEXED, is_deleted UNINDEXED
);
--> statement-breakpoint
CREATE VIRTUAL TABLE user_profiles_fts USING fts5(
    user_id UNINDEXED, nickname, first_name, last_name, bio,
    show_on_about UNINDEXED
);
--> statement-breakpoint
CREATE VIRTUAL TABLE outreach_fts USING fts5(
    title,
    location,
    impact_summary,
    content='outreach_logs',
    content_rowid='id'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE awards_fts USING fts5(
    title,
    event_name,
    description,
    content='awards',
    content_rowid='id'
);
`;
sql += '\n--> statement-breakpoint\n' + ftsAppend;

fs.writeFileSync('drizzle/0000_tidy_prima.sql', sql);
