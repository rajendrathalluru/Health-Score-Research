-- Google Health OAuth tokens storage (Supabase/Postgres)
-- Replaces legacy fitbit_tokens after the Fitbit Web API -> Google Health API migration.
CREATE TABLE IF NOT EXISTS google_health_tokens (
  google_user_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_health_tokens_user_id
ON google_health_tokens (user_id);
