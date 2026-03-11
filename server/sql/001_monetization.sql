CREATE TABLE IF NOT EXISTS of_accounts (
  account_id TEXT PRIMARY KEY,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS of_daily_metrics (
  account_id TEXT NOT NULL REFERENCES of_accounts(account_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  profile_visits_total INTEGER NOT NULL DEFAULT 0,
  profile_visits_users INTEGER NOT NULL DEFAULT 0,
  profile_visits_guests INTEGER NOT NULL DEFAULT 0,
  new_subs INTEGER NOT NULL DEFAULT 0,
  renewed_subs INTEGER DEFAULT 0,
  paid_subs INTEGER DEFAULT 0,
  free_subs INTEGER DEFAULT 0,
  earnings_total NUMERIC(12, 2) DEFAULT 0,
  earnings_subscribes NUMERIC(12, 2) DEFAULT 0,
  earnings_messages NUMERIC(12, 2) DEFAULT 0,
  earnings_tips NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, date)
);

ALTER TABLE of_daily_metrics ADD COLUMN IF NOT EXISTS earnings_messages NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE of_daily_metrics ADD COLUMN IF NOT EXISTS earnings_tips NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE of_daily_metrics ALTER COLUMN renewed_subs DROP NOT NULL;
ALTER TABLE of_daily_metrics ALTER COLUMN paid_subs DROP NOT NULL;
ALTER TABLE of_daily_metrics ALTER COLUMN free_subs DROP NOT NULL;
ALTER TABLE of_daily_metrics ALTER COLUMN earnings_total DROP NOT NULL;
ALTER TABLE of_daily_metrics ALTER COLUMN earnings_subscribes DROP NOT NULL;

CREATE TABLE IF NOT EXISTS of_daily_country_visits (
  account_id TEXT NOT NULL REFERENCES of_accounts(account_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  country_code TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, date, country_code)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_of_daily_metrics_date ON of_daily_metrics (date DESC);
