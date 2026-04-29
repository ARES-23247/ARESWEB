-- Create unified contributor tracking table
CREATE TABLE document_contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  last_contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_document_contributors_room ON document_contributors(room_id);
