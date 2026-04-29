-- Add draft content column for Liveblocks webhook auto-saves
ALTER TABLE docs ADD COLUMN content_draft TEXT;
ALTER TABLE posts ADD COLUMN content_draft TEXT;
ALTER TABLE events ADD COLUMN content_draft TEXT;

-- Create unified history snapshot table
CREATE TABLE document_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_history_room ON document_history(room_id);
