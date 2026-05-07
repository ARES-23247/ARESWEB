-- Migration: Add PartyKit persistence table for document snapshots

CREATE TABLE IF NOT EXISTS document_snapshots (
    room_id TEXT PRIMARY KEY,
    state BLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_snapshots_updated ON document_snapshots(updated_at);
