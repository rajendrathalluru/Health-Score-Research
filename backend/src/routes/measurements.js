import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// ── POST /api/measurements/log ────────────────────────────────────────────────
router.post('/log', async (req, res) => {
  try {
    const { userId, date, weightKg, waistCm, mvpaMinutes, steps } = req.body;

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
       (user_id, date, weight_kg, waist_cm, bmi, mvpa_minutes, steps)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         weight_kg    = $3,
         waist_cm     = $4,
         bmi          = $5,
         mvpa_minutes = $6,
         steps        = $7
       RETURNING *`,
      [userId, date, weightKg, waistCm, bmi, mvpaMinutes, steps]
    );

    res.status(201).json({
      success: true,
      message: 'Measurement saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Measurement logging error:', error);
    res.status(500).json({ success: false, message: 'Failed to save measurement', error: error.message });
  }
});

// ── GET /api/measurements/:userId/:date ───────────────────────────────────────
router.get('/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;

    const result = await pool.query(
      'SELECT * FROM daily_measurements WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('Get measurement error:', error);
    res.status(500).json({ success: false, message: 'Failed to get measurement', error: error.message });
  }
});

// ── PUT /api/measurements/user/:userId/height ─────────────────────────────────
router.put('/user/:userId/height', async (req, res) => {
  try {
    const { userId }   = req.params;
    const { heightCm } = req.body;

    await pool.query('UPDATE users SET height_cm = $1 WHERE id = $2', [heightCm, userId]);

    res.json({ success: true, message: 'Height updated successfully' });
  } catch (error) {
    console.error('Height update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update height', error: error.message });
  }
});

// ── POST /api/measurements/activity  (manual weekly MVPA entry) ───────────────
// Saves total weekly MVPA on the Monday row so weeklyScore.js picks it up
// when it queries: WHERE date >= weekStart AND date < weekStart + 7 days
router.post('/activity', async (req, res) => {
  try {
    const { userId, mvpa_minutes, week_start_date } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (mvpa_minutes === undefined || mvpa_minutes === null) {
      return res.status(400).json({ success: false, message: 'mvpa_minutes is required' });
    }
    if (!week_start_date) {
      return res.status(400).json({ success: false, message: 'week_start_date is required (YYYY-MM-DD)' });
    }

    await pool.query(
      `INSERT INTO daily_measurements (user_id, date, mvpa_minutes)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date)
       DO UPDATE SET mvpa_minutes = $3`,
      [userId, week_start_date, mvpa_minutes]
    );

    res.json({ success: true, message: 'Activity saved' });
  } catch (err) {
    console.error('POST /measurements/activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to save activity', error: err.message });
  }
});

// ── GET /api/measurements/activity?userId=&weekStart= ─────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const { userId, weekStart } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart is required (YYYY-MM-DD)' });
    }

    const result = await pool.query(
      `SELECT COALESCE(SUM(mvpa_minutes), 0)::int AS total_mvpa
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2
         AND date < ($2::date + interval '7 days')`,
      [userId, weekStart]
    );

    res.json({ success: true, data: { mvpa_minutes: result.rows[0].total_mvpa } });
  } catch (err) {
    console.error('GET /measurements/activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch activity', error: err.message });
  }
});

export default router;