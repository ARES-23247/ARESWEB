CREATE TABLE IF NOT EXISTS external_knowledge_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'github' or 'website'
  url TEXT NOT NULL, -- e.g. 'ARES-23247/ARESLIB' or 'https://example.com'
  branch TEXT, -- e.g. 'main', only for github
  status TEXT DEFAULT 'active',
  last_indexed_sha TEXT,
  last_indexed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
