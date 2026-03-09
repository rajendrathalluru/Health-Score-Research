-- Weekly questionnaire scores storage (Supabase/Postgres)
CREATE TABLE IF NOT EXISTS weekly_questionnaire_scores (
  user_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_possible_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'High',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_questionnaire_scores_user_week
ON weekly_questionnaire_scores (user_id, week_start_date DESC);
