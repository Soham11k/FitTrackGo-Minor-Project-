-- Phase 7: unified wearable_daily_metrics across providers.
-- Relax the provider check and extend the columns. Older rows stay valid.

ALTER TABLE wearable_connections
  DROP CONSTRAINT IF EXISTS wearable_connections_provider_check;
ALTER TABLE wearable_connections
  ADD CONSTRAINT wearable_connections_provider_check
  CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin'));

ALTER TABLE wearable_daily_metrics
  DROP CONSTRAINT IF EXISTS wearable_daily_metrics_provider_check;
ALTER TABLE wearable_daily_metrics
  ADD CONSTRAINT wearable_daily_metrics_provider_check
  CHECK (provider IN ('fitbit', 'google_fit', 'apple_health', 'garmin'));

ALTER TABLE wearable_daily_metrics
  ADD COLUMN IF NOT EXISTS steps INTEGER,
  ADD COLUMN IF NOT EXISTS avg_hr INTEGER,
  ADD COLUMN IF NOT EXISTS sleep_min INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ;
