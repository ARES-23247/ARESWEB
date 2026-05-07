-- Migration: Update simulations table to use UUIDs and multi-file JSON storage

DROP TABLE IF EXISTS simulations;

CREATE TABLE simulations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  files TEXT NOT NULL, -- JSON string mapping filename to code
  author_id TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_simulations_author ON simulations(author_id);
CREATE INDEX idx_simulations_public ON simulations(is_public);
