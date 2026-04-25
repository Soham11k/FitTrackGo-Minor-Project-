-- Phase 1 / migration 0002: wearables baseline (Fitbit tokens + daily metrics).

CREATE TABLE IF NOT EXISTS wearable_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'fitbit'),
  external_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL DEFAULT '',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_wearable_connections_user_id ON wearable_connections(user_id);

CREATE TABLE IF NOT EXISTS wearable_daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'fitbit'),
  metric_date DATE NOT NULL,
  resting_heart_rate INTEGER,
  spo2_avg_pct NUMERIC(6, 2),
  spo2_min_pct NUMERIC(6, 2),
  spo2_max_pct NUMERIC(6, 2),
  extra JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_wearable_daily_metrics_user_date
  ON wearable_daily_metrics(user_id, provider, metric_date DESC);

ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_daily_metrics ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY for wearable_* means clients cannot access directly; only
-- the service-role server routes can read/write. This is intentional (tokens
-- must never be exposed to the browser).

CREATE OR REPLACE FUNCTION update_wearable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wearable_connections_updated_at ON wearable_connections;
CREATE TRIGGER update_wearable_connections_updated_at
  BEFORE UPDATE ON wearable_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_wearable_updated_at();

DROP TRIGGER IF EXISTS update_wearable_daily_metrics_updated_at ON wearable_daily_metrics;
CREATE TRIGGER update_wearable_daily_metrics_updated_at
  BEFORE UPDATE ON wearable_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_wearable_updated_at();
