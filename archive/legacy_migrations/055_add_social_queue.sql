-- Social Media Queue for scheduled posts
CREATE TABLE IF NOT EXISTS social_queue (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  media_urls TEXT, -- JSON array of URLs
  scheduled_for TEXT NOT NULL, -- ISO timestamp
  platforms TEXT NOT NULL, -- JSON object: {"twitter": true, "bluesky": false, ...}
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, failed, cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  error_message TEXT,
  created_by TEXT, -- user_id who created the post
  -- Linked content (optional)
  linked_type TEXT, -- 'blog', 'event', 'document', 'asset', null
  linked_id TEXT, -- slug for blog, id for event, etc.
  -- Analytics (populated after sending)
  analytics TEXT, -- JSON object with platform-specific metrics
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for querying scheduled posts
CREATE INDEX IF NOT EXISTS idx_social_queue_scheduled_for ON social_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_queue_status ON social_queue(status);
CREATE INDEX IF NOT EXISTS idx_social_queue_linked ON social_queue(linked_type, linked_id);
