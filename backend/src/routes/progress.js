import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Get score history for a date range
router.get('/scores/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        date,
        total_score,
        weight_score,
        activity_score,
        plant_score,
        processed_food_score,
        meat_score,
        drinks_score,
        alcohol_score
       FROM daily_scores
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - $2::integer
       ORDER BY date ASC`,
      [userId, days]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get score history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get score history',
      error: error.message
    });
  }
});

// Get weight history
router.get('/weight/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT date, weight_kg, bmi
       FROM daily_measurements
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - $2::integer
       AND weight_kg IS NOT NULL
       ORDER BY date ASC`,
      [userId, days]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get weight history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weight history',
      error: error.message
    });
  }
});

// Get activity history
router.get('/activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT date, mvpa_minutes, steps
       FROM daily_measurements
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - $2::integer
       AND (mvpa_minutes IS NOT NULL OR steps IS NOT NULL)
       ORDER BY date ASC`,
      [userId, days]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity history',
      error: error.message
    });
  }
});

// Get nutrition summary
router.get('/nutrition/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT 
        date,
        SUM(calories) as total_calories,
        SUM(protein_g) as total_protein,
        SUM(carbs_g) as total_carbs,
        SUM(fat_g) as total_fat,
        SUM(fiber_g) as total_fiber
       FROM food_entries
       WHERE user_id = $1 
       AND date >= CURRENT_DATE - $2::integer
       GROUP BY date
       ORDER BY date ASC`,
      [userId, days]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get nutrition history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get nutrition history',
      error: error.message
    });
  }
});

export default router;