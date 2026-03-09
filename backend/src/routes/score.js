
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Calculate WCRF/AICR score for a specific date
router.post('/calculate', async (req, res) => {
  try {
    const { userId, date } = req.body;

    // Get daily measurements (weight, activity)
    const measurements = await pool.query(
      'SELECT * FROM daily_measurements WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    // Get food entries for the day
    const foodEntries = await pool.query(
      'SELECT * FROM food_entries WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    // Get user info for BMI calculation
    const userInfo = await pool.query(
      'SELECT height_cm FROM users WHERE id = $1',
      [userId]
    );

    const measurement = measurements.rows[0];
    const foods = foodEntries.rows;
    const user = userInfo.rows[0];

    // Calculate component scores
    const scores = {
      weight: calculateWeightScore(measurement, user),
      activity: calculateActivityScore(measurement),
      plantFoods: calculatePlantFoodScore(foods),
      processedFoods: calculateProcessedFoodScore(foods),
      meat: calculateMeatScore(foods),
      drinks: calculateDrinksScore(foods),
      alcohol: calculateAlcoholScore(foods)
    };

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

    // Save score to database
    await pool.query(
      `INSERT INTO daily_scores 
       (user_id, date, total_score, weight_score, activity_score, plant_score, 
        processed_food_score, meat_score, drinks_score, alcohol_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET 
         total_score = $3,
         weight_score = $4,
         activity_score = $5,
         plant_score = $6,
         processed_food_score = $7,
         meat_score = $8,
         drinks_score = $9,
         alcohol_score = $10`,
      [userId, date, totalScore, scores.weight, scores.activity, scores.plantFoods,
       scores.processedFoods, scores.meat, scores.drinks, scores.alcohol]
    );

    res.json({
      success: true,
      data: {
        totalScore,
        components: scores,
        maxScore: 7
      }
    });
  } catch (error) {
    console.error('Score calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate score',
      error: error.message
    });
  }
});

// Get score for a specific date
router.get('/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;

    const result = await pool.query(
      'SELECT * FROM daily_scores WHERE user_id = $1 AND date = $2',
      [userId, date]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get score error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get score',
      error: error.message
    });
  }
});

// Score calculation functions
function calculateWeightScore(measurement, user) {
  if (!measurement || !measurement.weight_kg || !user || !user.height_cm) {
    return 0;
  }

  const bmi = measurement.bmi || (measurement.weight_kg / Math.pow(user.height_cm / 100, 2));
  const waistCm = measurement.waist_cm;

  let bmiScore = 0;
  if (bmi >= 18.5 && bmi <= 24.9) bmiScore = 0.5;
  else if (bmi >= 25 && bmi <= 29.9) bmiScore = 0.25;

  let waistScore = 0;
  if (waistCm) {
    // Assuming male, adjust based on actual gender
    if (waistCm < 94) waistScore = 0.5;
    else if (waistCm >= 94 && waistCm < 102) waistScore = 0.25;
  }

  return bmiScore + waistScore;
}

function calculateActivityScore(measurement) {
  if (!measurement || !measurement.mvpa_minutes) {
    return 0;
  }

  const mvpa = measurement.mvpa_minutes;
  if (mvpa >= 150) return 1;
  if (mvpa >= 75) return 0.5;
  return 0;
}

function calculatePlantFoodScore(foods) {
  const totalFiber = foods.reduce((sum, food) => sum + (food.fiber_g || 0), 0);
  
  let fiberScore = 0;
  if (totalFiber >= 30) fiberScore = 0.5;
  else if (totalFiber >= 15) fiberScore = 0.25;

  // Fruits and vegetables calculation would need weight data
  // For now, using fiber as proxy
  let fvScore = 0;
  if (totalFiber >= 20) fvScore = 0.5;
  else if (totalFiber >= 10) fvScore = 0.25;

  return fiberScore + fvScore;
}

function calculateProcessedFoodScore(foods) {
  const processedFoods = foods.filter(f => f.is_processed);
  const totalCalories = foods.reduce((sum, f) => sum + (f.calories || 0), 0);
  const processedCalories = processedFoods.reduce((sum, f) => sum + (f.calories || 0), 0);
  
  if (totalCalories === 0) return 1;
  
  const processedPercent = (processedCalories / totalCalories) * 100;
  
  if (processedPercent < 20) return 1;
  if (processedPercent < 40) return 0.5;
  return 0;
}

function calculateMeatScore(foods) {
  const redMeat = foods.filter(f => f.is_red_meat);
  const totalRedMeat = redMeat.reduce((sum, f) => sum + 100, 0); // Estimate 100g per entry
  
  if (totalRedMeat <= 70) return 1; // 500g per week = ~70g per day
  if (totalRedMeat <= 100) return 0.5;
  return 0;
}

function calculateDrinksScore(foods) {
  const sugarDrinks = foods.filter(f => f.is_sugar_drink);
  
  if (sugarDrinks.length === 0) return 1;
  if (sugarDrinks.length <= 1) return 0.5;
  return 0;
}

function calculateAlcoholScore(foods) {
  const totalAlcohol = foods.reduce((sum, f) => sum + (f.alcohol_g || 0), 0);
  
  if (totalAlcohol === 0) return 1;
  if (totalAlcohol <= 14) return 0.5; // Assuming female limit
  return 0;
}

export default router;
