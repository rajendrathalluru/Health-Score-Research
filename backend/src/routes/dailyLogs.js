import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Monday of whatever week the given date falls in (YYYY-MM-DD) */
function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

// ─── POST /api/daily-logs  (save or update a day's entry) ────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      log_date,
      fruits_veg_grams,
      fiber_grams,
      total_calories,
      ultraprocessed_cals,
      red_meat_grams,
      processed_meat_grams,
      ssb_ml,
      alcohol_ml,
      alcohol_abv,
      bmi,
      waist_cm,
      notes,
    } = req.body;

    if (!log_date) {
      return res.status(400).json({ success: false, message: 'log_date is required' });
    }

    const week_start_date = getMondayOf(log_date);

    const result = await pool.query(
      `INSERT INTO daily_logs (
        user_id, log_date, week_start_date,
        fruits_veg_grams, fiber_grams,
        total_calories, ultraprocessed_cals,
        red_meat_grams, processed_meat_grams,
        ssb_ml, alcohol_ml, alcohol_abv,
        bmi, waist_cm, notes, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
      )
      ON CONFLICT (user_id, log_date)
      DO UPDATE SET
        fruits_veg_grams    = EXCLUDED.fruits_veg_grams,
        fiber_grams         = EXCLUDED.fiber_grams,
        total_calories      = EXCLUDED.total_calories,
        ultraprocessed_cals = EXCLUDED.ultraprocessed_cals,
        red_meat_grams      = EXCLUDED.red_meat_grams,
        processed_meat_grams= EXCLUDED.processed_meat_grams,
        ssb_ml              = EXCLUDED.ssb_ml,
        alcohol_ml          = EXCLUDED.alcohol_ml,
        alcohol_abv         = EXCLUDED.alcohol_abv,
        bmi                 = EXCLUDED.bmi,
        waist_cm            = EXCLUDED.waist_cm,
        notes               = EXCLUDED.notes,
        updated_at          = NOW()
      RETURNING *`,
      [
        userId, log_date, week_start_date,
        fruits_veg_grams   ?? null,
        fiber_grams        ?? null,
        total_calories     ?? null,
        ultraprocessed_cals ?? null,
        red_meat_grams     ?? null,
        processed_meat_grams ?? null,
        ssb_ml             ?? null,
        alcohol_ml         ?? null,
        alcohol_abv        ?? null,
        bmi                ?? null,
        waist_cm           ?? null,
        notes              ?? null,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /daily-logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to save daily log' });
  }
});

// ─── GET /api/daily-logs/week?weekStart=YYYY-MM-DD  (load all 7 days for a week) ─
router.get('/week', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart query param is required (YYYY-MM-DD)' });
    }

    const result = await pool.query(
      `SELECT * FROM daily_logs
       WHERE user_id = $1 AND week_start_date = $2
       ORDER BY log_date ASC`,
      [userId, weekStart]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /daily-logs/week error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly logs' });
  }
});

// ─── GET /api/daily-logs/:date  (load a single day) ──────────────────────────
router.get('/:date', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    const result = await pool.query(
      `SELECT * FROM daily_logs WHERE user_id = $1 AND log_date = $2`,
      [userId, date]
    );

    res.json({ success: true, data: result.rows[0] ?? null });
  } catch (err) {
    console.error('GET /daily-logs/:date error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch daily log' });
  }
});

export default router;