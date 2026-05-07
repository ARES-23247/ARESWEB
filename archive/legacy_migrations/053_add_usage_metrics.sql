CREATE TABLE usage_metrics (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  user_id TEXT,
  cf_ray TEXT,
  cf_ip TEXT
);

CREATE INDEX idx_usage_metrics_timestamp ON usage_metrics(timestamp);
CREATE INDEX idx_usage_metrics_endpoint ON usage_metrics(endpoint);
