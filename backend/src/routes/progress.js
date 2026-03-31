import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

function clampDays(value, fallback = 30) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 7), 365);
}

function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(days) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(end.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function getRequestedRange(query, fallbackDays) {
  const start = query.start;
  const end = query.end;

  if (isDateOnly(start) && isDateOnly(end) && start <= end) {
    return { start, end };
  }

  const { start: computedStart, end: computedEnd } = getDateRange(clampDays(query.days, fallbackDays));
  return {
    start: formatDateOnly(computedStart),
    end: formatDateOnly(computedEnd),
  };
}

router.get('/scores', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const range = getRequestedRange(req.query, 30);

    const result = await pool.query(
      `SELECT
         week_start_date,
         total_score,
         max_possible_score,
         risk_level,
         calculated_at
       FROM weekly_questionnaire_scores
       WHERE user_id = $1
         AND week_start_date BETWEEN $2::date AND $3::date
       ORDER BY week_start_date ASC`,
      [userId, range.start, range.end]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    if (error.code === '42P01') {
      return res.json({ success: true, data: [] });
    }

    console.error('Get score history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get score history',
      error: error.message,
    });
  }
});

router.get('/body-metrics', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const range = getRequestedRange(req.query, 30);

    const result = await pool.query(
      `SELECT
         dm.date,
         dm.weight_kg,
         dm.waist_cm,
         dm.bmi,
         u.height_cm
       FROM daily_measurements dm
       LEFT JOIN users u ON u.id = dm.user_id
       WHERE dm.user_id = $1
         AND dm.date BETWEEN $2::date AND $3::date
         AND (dm.weight_kg IS NOT NULL OR dm.waist_cm IS NOT NULL OR dm.bmi IS NOT NULL)
       ORDER BY dm.date ASC`,
      [userId, range.start, range.end]
    );

    const data = result.rows.map((row) => {
      let bmi = row.bmi;
      if ((bmi === null || bmi === undefined) && row.weight_kg && row.height_cm) {
        bmi = +(Number(row.weight_kg) / Math.pow(Number(row.height_cm) / 100, 2)).toFixed(1);
      }

      return {
        date: row.date,
        weight_kg: row.weight_kg,
        waist_cm: row.waist_cm,
        bmi,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get body metrics history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get body metrics history',
      error: error.message,
    });
  }
});

router.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const range = getRequestedRange(req.query, 30);

    const result = await pool.query(
      `SELECT
         date,
         COALESCE(mvpa_minutes, 0)::int AS mvpa_minutes,
         COALESCE(steps, 0)::int AS steps
       FROM daily_measurements
       WHERE user_id = $1
         AND date BETWEEN $2::date AND $3::date
         AND (mvpa_minutes IS NOT NULL OR steps IS NOT NULL)
       ORDER BY date ASC`,
      [userId, range.start, range.end]
    );

    const rowsByDate = new Map(
      result.rows.map((row) => [formatDateOnly(new Date(row.date)), row])
    );

    const data = [];
    const cursor = new Date(`${range.start}T00:00:00`);
    const endDate = new Date(`${range.end}T00:00:00`);
    while (cursor <= endDate) {
      const dateKey = formatDateOnly(cursor);
      const row = rowsByDate.get(dateKey);
      data.push({
        date: dateKey,
        mvpa_minutes: row ? row.mvpa_minutes : 0,
        steps: row ? row.steps : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity history',
      error: error.message,
    });
  }
});

export default router;
