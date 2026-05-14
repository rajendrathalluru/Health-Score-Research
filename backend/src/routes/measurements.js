import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

function serializeMeasurement(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    date: row.date,
    weight_kg: row.weight_kg,
    bmi: row.bmi,
    mvpa_minutes: row.mvpa_minutes,
    steps: row.steps,
  };
}

// ── POST /api/measurements/log ────────────────────────────────────────────────
router.post('/log', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, weightKg, mvpaMinutes, steps } = req.body;

    const userResult = await pool.query(
      'SELECT height_cm FROM users WHERE id = $1',
      [userId]
    );

    const heightCm = userResult.rows[0]?.height_cm;
    let bmi = null;
    if (heightCm && weightKg) {
      bmi = weightKg / Math.pow(heightCm / 100, 2);
    }

    const result = await pool.query(
      `INSERT INTO daily_measurements
       (user_id, date, weight_kg, bmi, mvpa_minutes, steps)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         weight_kg    = COALESCE(EXCLUDED.weight_kg, daily_measurements.weight_kg),
         bmi          = COALESCE(EXCLUDED.bmi, daily_measurements.bmi),
         mvpa_minutes = COALESCE(EXCLUDED.mvpa_minutes, daily_measurements.mvpa_minutes),
         steps        = COALESCE(EXCLUDED.steps, daily_measurements.steps)
       RETURNING *`,
      [userId, date, weightKg, bmi, mvpaMinutes, steps]
    );

    res.status(201).json({
      success: true,
      message: 'Measurement saved successfully',
      data: serializeMeasurement(result.rows[0]),
    });
  } catch (error) {
    console.error('Measurement logging error:', error);
    res.status(500).json({ success: false, message: 'Failed to save measurement', error: error.message });
  }
});

// ── PUT /api/measurements/height ──────────────────────────────────────────────
router.put('/height', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { heightCm } = req.body;

    await pool.query('UPDATE users SET height_cm = $1 WHERE id = $2', [heightCm, userId]);

    res.json({ success: true, message: 'Height updated successfully' });
  } catch (error) {
    console.error('Height update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update height', error: error.message });
  }
});

// ── POST /api/measurements/activity  (manual per-day MVPA entry) ──────────────
// Saves a single day's MVPA for the authenticated user and returns the
// current week's total so weeklyScore.js can sum the full week.
router.post('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mvpa_minutes, date, week_start_date } = req.body;

    if (mvpa_minutes === undefined || mvpa_minutes === null) {
      return res.status(400).json({ success: false, message: 'mvpa_minutes is required' });
    }
    const targetDate = date || week_start_date;
    if (!targetDate) {
      return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
    }

    const result = await pool.query(
      `INSERT INTO daily_measurements (user_id, date, mvpa_minutes)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET mvpa_minutes = $3
       RETURNING user_id, date, mvpa_minutes`,
      [userId, targetDate, mvpa_minutes]
    );

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(mvpa_minutes), 0)::int AS total_mvpa
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')`,
      [userId, week_start_date || targetDate]
    );

    res.json({
      success: true,
      message: 'Activity saved',
      data: {
        entry: result.rows[0],
        total_mvpa: totalResult.rows[0]?.total_mvpa ?? 0,
      },
    });
  } catch (err) {
    console.error('POST /measurements/activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to save activity', error: err.message });
  }
});

// ── GET /api/measurements/activity?weekStart=YYYY-MM-DD ───────────────────────
router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart is required (YYYY-MM-DD)' });
    }

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(mvpa_minutes), 0)::int AS total_mvpa
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2
         AND date < ($2::date + interval '7 days')`,
      [userId, weekStart]
    );

    const dailyResult = await pool.query(
      `SELECT date::text AS date, COALESCE(mvpa_minutes, 0)::int AS mvpa_minutes
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2
         AND date < ($2::date + interval '7 days')
         AND mvpa_minutes IS NOT NULL
       ORDER BY date ASC`,
      [userId, weekStart]
    );

    res.json({
      success: true,
      data: {
        mvpa_minutes: totalResult.rows[0].total_mvpa,
        entries: dailyResult.rows,
      },
    });
  } catch (err) {
    console.error('GET /measurements/activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch activity', error: err.message });
  }
});

// ── GET /api/measurements/:date ───────────────────────────────────────────────
router.get('/:date', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    const result = await pool.query(
      'SELECT * FROM daily_measurements WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    res.json({ success: true, data: serializeMeasurement(result.rows[0] || null) });
  } catch (error) {
    console.error('Get measurement error:', error);
    res.status(500).json({ success: false, message: 'Failed to get measurement', error: error.message });
  }
});

export default router;
