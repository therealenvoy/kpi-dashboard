CREATE TABLE IF NOT EXISTS reel_tags (
  reel_id TEXT PRIMARY KEY,
  reel_type TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
