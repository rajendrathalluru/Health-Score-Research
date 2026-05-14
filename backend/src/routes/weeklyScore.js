import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

const QUESTION_ORDER = ['q29', 'q30', 'q31', 'q32', 'q33', 'q34', 'q35', 'q36', 'q37'];

async function ensureWeeklyQuestionnaireTable() {
  try {
    await pool.query(`
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
      )
    `);

    // Ensure compatibility with UUID-style user ids from auth token.
    await pool.query(`
      ALTER TABLE weekly_questionnaire_scores
      ALTER COLUMN user_id TYPE TEXT USING user_id::text
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_questionnaire_scores_user_week
      ON weekly_questionnaire_scores (user_id, week_start_date DESC)
    `);
  } catch (createErr) {
    // Some Supabase roles cannot CREATE objects. If the table already exists, continue.
    const existsResult = await pool.query(
      `SELECT to_regclass('public.weekly_questionnaire_scores') AS regclass_name`
    );
    const exists = Boolean(existsResult.rows[0]?.regclass_name);
    if (!exists) {
      const msg = 'weekly_questionnaire_scores table is missing. Run backend/sql/weekly_questionnaire_scores.sql in Supabase SQL editor.';
      const err = new Error(msg);
      err.cause = createErr;
      throw err;
    }
  }
}

function normalizeAnswers(raw = {}) {
  const answers = {};
  for (const key of QUESTION_ORDER) {
    const val = raw[key];
    answers[key] = typeof val === 'string' && val.trim() ? val.trim() : null;
  }
  return answers;
}

function average(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number);
  if (!valid.length) return null;
  return +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2);
}

function scoreFruitVeg(answer) {
  if (!answer) return null;
  if (answer === '5_plus_day') return 1;
  if (answer === '4_day' || answer === '2_3_day') return 0.5;
  return 0; // 1/day, <1/day, none
}

function scorePulses(answer) {
  if (!answer) return null;
  if (answer === '4_plus_week' || answer === '3_week') return 1;
  if (answer === '2_week' || answer === '1_week') return 0.5;
  return 0; // <1/week, none
}

function scoreWholegrains(answer) {
  if (!answer) return null;
  if (answer === 'multi_day') return 1;
  if (answer === 'daily') return 0.5;
  return 0; // <1/day
}

function timesPerWeek(answer) {
  const map = {
    '4_plus_week': 4,
    '3_week': 3,
    '2_week': 2,
    '1_week': 1,
    'lt_1_week': 0.5,
    'none': 0,
  };
  return Object.prototype.hasOwnProperty.call(map, answer) ? map[answer] : null;
}

function scoreWeightFromMeasures(bmi) {
  if (bmi === null || bmi === undefined || Number.isNaN(Number(bmi))) {
    return 0;
  }

  const b = Number(bmi);
  if (b >= 18.5 && b <= 24.9) return 1;
  if (b >= 25 && b <= 29.9) return 0.5;
  return 0;
}

function scoreActivityFromMvpa(totalMvpa) {
  const v = Number(totalMvpa || 0);
  if (v >= 150) return 1;
  if (v >= 75) return 0.5;
  return 0;
}

async function loadMeasurementForWeek(userId, weekStart) {
  const activityResult = await pool.query(
    `SELECT COALESCE(SUM(mvpa_minutes), 0)::int AS total_mvpa
     FROM daily_measurements
     WHERE user_id = $1
       AND date >= $2::date
       AND date < ($2::date + interval '7 days')`,
    [userId, weekStart]
  );

  const userResult = await pool.query(
    `SELECT height_cm
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const heightCm = userResult.rows[0]?.height_cm ?? null;

  let bodyResult = await pool.query(
    `SELECT bmi, weight_kg
     FROM daily_measurements
     WHERE user_id = $1
       AND date >= $2::date
       AND date < ($2::date + interval '7 days')
       AND (bmi IS NOT NULL OR weight_kg IS NOT NULL)
     ORDER BY date DESC
     LIMIT 1`,
    [userId, weekStart]
  );

  if (!bodyResult.rows.length) {
    bodyResult = await pool.query(
      `SELECT bmi, weight_kg
       FROM daily_measurements
       WHERE user_id = $1
         AND date < $2::date
         AND (bmi IS NOT NULL OR weight_kg IS NOT NULL)
       ORDER BY date DESC
       LIMIT 1`,
      [userId, weekStart]
    );
  }

  const storedBmi = bodyResult.rows[0]?.bmi ?? null;
  const weightKg = bodyResult.rows[0]?.weight_kg ?? null;
  const derivedBmi =
    storedBmi !== null && storedBmi !== undefined
      ? storedBmi
      : heightCm && weightKg
        ? +(Number(weightKg) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1)
        : null;

  return {
    mvpa_minutes: activityResult.rows[0]?.total_mvpa ?? 0,
    bmi: derivedBmi,
    weight_kg: weightKg,
    height_cm: heightCm,
  };
}

function scoreAnswers(answers, gender = 'male', measurement = {}) {
  const fruitVeg = scoreFruitVeg(answers.q29);
  const pulses = scorePulses(answers.q30);
  const wholegrains = scoreWholegrains(answers.q31);
  const plantBasedScore = average([fruitVeg, pulses, wholegrains]);

  const fast = timesPerWeek(answers.q32);
  const sweets = timesPerWeek(answers.q33);
  let fastProcessedScore = null;
  if (fast !== null && sweets !== null) {
    const totalTimes = fast + sweets;
    if (totalTimes <= 1) fastProcessedScore = 1;
    else if (totalTimes <= 3) fastProcessedScore = 0.5;
    else fastProcessedScore = 0;
  }

  const redMeatLeq3 = ['3_week', '1_2_week', 'lt_1_week', 'none'].includes(answers.q34);
  const redMeatGt3 = ['4_5_week', '6_plus_week'].includes(answers.q34);
  const procLt1 = ['lt_1_week', 'none'].includes(answers.q35);
  const procEq1 = answers.q35 === '1_week';
  const procGe2 = ['2_week', '3_week', '4_plus_week'].includes(answers.q35);
  let meatScore = null;
  if (answers.q34 && answers.q35) {
    if (redMeatLeq3 && procLt1) meatScore = 1;
    else if (redMeatLeq3 && procEq1) meatScore = 0.5;
    else if (redMeatGt3 || procGe2) meatScore = 0;
  }

  let ssbScore = null;
  if (answers.q36) {
    if (answers.q36 === 'none') ssbScore = 1;
    else if (answers.q36 === '1_plus_day') ssbScore = 0;
    else ssbScore = 0.5; // <1 to 6 drinks/week
  }

  let alcoholScore = null;
  if (answers.q37) {
    if (answers.q37 === 'none') alcoholScore = 1;
    else if (gender === 'female') {
      alcoholScore = answers.q37 === 'gt_1_day' ? 0 : 0.5;
    } else {
      alcoholScore = answers.q37 === 'gt_2_day' ? 0 : 0.5;
    }
  }

  const weightScore = scoreWeightFromMeasures(measurement.bmi);
  const activityScore = scoreActivityFromMvpa(measurement.mvpa_minutes);

  const components = {
    weight_score: weightScore,
    activity_score: activityScore,
    plant_based_score: plantBasedScore,
    fast_processed_score: fastProcessedScore,
    red_processed_meat_score: meatScore,
    sugary_drinks_score: ssbScore,
    alcohol_score: alcoholScore,
  };

  const total = +Object.values(components).reduce((a, b) => a + Number(b || 0), 0).toFixed(2);
  const maxPossible = 7;
  const riskLevel = maxPossible === 0
    ? 'High'
    : total >= maxPossible * 0.75
      ? 'Low'
      : total >= maxPossible * 0.5
        ? 'Moderate'
        : 'High';

  return {
    components,
    details: { fruitVeg, pulses, wholegrains },
    total,
    maxPossible,
    answeredCount: Object.values(components).filter(v => v !== null).length,
    riskLevel,
  };
}

function toApiPayload(row) {
  if (!row) return null;

  const components = row.components_json ?? {};
  const answers = row.answers_json ?? {};
  const answeredCount = QUESTION_ORDER.filter(q => answers[q] !== null && answers[q] !== undefined).length;

  return {
    week_start_date: row.week_start_date,
    total_score: row.total_score,
    max_possible_score: row.max_possible_score,
    risk_level: row.risk_level,
    calculated_at: row.calculated_at,
    answers,
    components,
    days_answered: answeredCount,
    days_logged: answeredCount,
    weight_score: components.weight_score ?? 0,
    activity_score: components.activity_score ?? 0,
    plant_score: components.plant_based_score ?? null,
    upf_score: components.fast_processed_score ?? null,
    meat_score: components.red_processed_meat_score ?? null,
    ssb_score: components.sugary_drinks_score ?? null,
    alcohol_score: components.alcohol_score ?? null,
  };
}

// ─── POST /api/weekly-score  (compute + persist weekly questionnaire score) ───
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureWeeklyQuestionnaireTable();

    const userId = req.user.id;
    const { weekStart, answers: rawAnswers } = req.body;

    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart is required (YYYY-MM-DD)' });
    }

    const userResult = await pool.query('SELECT gender FROM users WHERE id = $1', [userId]);
    const gender = (userResult.rows[0]?.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';

    let answers = null;
    if (rawAnswers && typeof rawAnswers === 'object') {
      answers = normalizeAnswers(rawAnswers);
    } else {
      const existing = await pool.query(
        `SELECT answers_json
         FROM weekly_questionnaire_scores
         WHERE user_id = $1 AND week_start_date = $2::date`,
        [userId, weekStart]
      );
      if (!existing.rows.length) {
        return res.status(400).json({
          success: false,
          message: 'No questionnaire answers found for this week. Please complete the weekly questionnaire first.',
        });
      }
      answers = normalizeAnswers(existing.rows[0].answers_json);
    }

    const measurement = await loadMeasurementForWeek(userId, weekStart);
    const scored = scoreAnswers(answers, gender, measurement);

    const saved = await pool.query(
      `INSERT INTO weekly_questionnaire_scores (
        user_id, week_start_date, answers_json, components_json,
        total_score, max_possible_score, risk_level, calculated_at, updated_at
      ) VALUES ($1, $2::date, $3::jsonb, $4::jsonb, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (user_id, week_start_date)
      DO UPDATE SET
        answers_json       = EXCLUDED.answers_json,
        components_json    = EXCLUDED.components_json,
        total_score        = EXCLUDED.total_score,
        max_possible_score = EXCLUDED.max_possible_score,
        risk_level         = EXCLUDED.risk_level,
        calculated_at      = NOW(),
        updated_at         = NOW()
      RETURNING *`,
      [
        userId,
        weekStart,
        JSON.stringify(answers),
        JSON.stringify(scored.components),
        scored.total,
        scored.maxPossible,
        scored.riskLevel,
      ]
    );

    res.json({ success: true, data: toApiPayload(saved.rows[0]) });
  } catch (err) {
    console.error('POST /weekly-score error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute weekly score' });
  }
});

// ─── GET /api/weekly-score?weekStart=YYYY-MM-DD  (fetch saved score) ─────────
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureWeeklyQuestionnaireTable();

    const userId = req.user.id;
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart query param is required' });
    }

    let result = await pool.query(
      `SELECT *
       FROM weekly_questionnaire_scores
       WHERE user_id = $1 AND week_start_date = $2::date`,
      [userId, weekStart]
    );
    let row = result.rows[0] ?? null;

    // Recompute from latest measurements on every read so manual/Fitbit
    // activity and body metrics are always reflected in the dashboard.
    if (row) {
      const answers = normalizeAnswers(row.answers_json ?? {});
      const userResult = await pool.query('SELECT gender FROM users WHERE id = $1', [userId]);
      const gender = (userResult.rows[0]?.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
      const measurement = await loadMeasurementForWeek(userId, weekStart);
      const scored = scoreAnswers(answers, gender, measurement);

      const updated = await pool.query(
        `UPDATE weekly_questionnaire_scores
         SET
           components_json = $3::jsonb,
           total_score = $4,
           max_possible_score = $5,
           risk_level = $6,
           updated_at = NOW(),
           calculated_at = NOW()
         WHERE user_id = $1 AND week_start_date = $2::date
         RETURNING *`,
        [
          userId,
          weekStart,
          JSON.stringify(scored.components),
          scored.total,
          scored.maxPossible,
          scored.riskLevel,
        ]
      );
      row = updated.rows[0] ?? row;
    }

    res.json({ success: true, data: toApiPayload(row) });
  } catch (err) {
    console.error('GET /weekly-score error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly score' });
  }
});

// ─── GET /api/weekly-score/history?limit=26  (fetch saved week list) ──────────
router.get('/history', authenticate, async (req, res) => {
  try {
    await ensureWeeklyQuestionnaireTable();

    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 26, 1), 104);

    const result = await pool.query(
      `SELECT
         week_start_date,
         total_score,
         max_possible_score,
         risk_level,
         calculated_at,
         (
           SELECT COUNT(*)
           FROM jsonb_each(components_json)
         )::int AS component_count
       FROM weekly_questionnaire_scores
       WHERE user_id = $1
       ORDER BY week_start_date DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /weekly-score/history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly score history' });
  }
});

export default router;
