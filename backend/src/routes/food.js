import express from 'express';
import fetch from 'node-fetch';
import pool from '../config/database.js';

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const apiKey = process.env.USDA_API_KEY;
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${apiKey}`;

    console.log('Searching USDA for:', query);
    const response = await fetch(url);
    const data = await response.json();

    if (!data.foods) {
      return res.json({
        success: true,
        data: []
      });
    }

    const foods = data.foods.map(food => {
      const nutrients = food.foodNutrients || [];
      
      const getNutrient = (name) => {
        const nutrient = nutrients.find(n => n.nutrientName.toLowerCase().includes(name.toLowerCase()));
        return nutrient ? parseFloat(nutrient.value) || 0 : 0;
      };

      return {
        fdcId: food.fdcId,
        description: food.description,
        brandOwner: food.brandOwner || null,
        calories: getNutrient('energy'),
        protein: getNutrient('protein'),
        carbs: getNutrient('carbohydrate'),
        fat: getNutrient('total lipid'),
        fiber: getNutrient('fiber'),
        servingSize: food.servingSize || 100,
        servingSizeUnit: food.servingSizeUnit || 'g'
      };
    });

    console.log('Found', foods.length, 'foods');
    res.json({
      success: true,
      data: foods
    });
  } catch (error) {
    console.error('Food search error:', error);
    res.status(500).json({
      success: false,
      message: 'Food search failed',
      error: error.message
    });
  }
});

router.post('/log', async (req, res) => {
  try {
    const { userId, date, mealType, foodName, servingSize, calories, protein, carbs, fat, fiber } = req.body;

    console.log('Logging food:', { userId, foodName, mealType });

    const result = await pool.query(
      `INSERT INTO food_entries 
       (user_id, date, meal_type, food_name, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, date, mealType, foodName, servingSize, calories, protein, carbs, fat, fiber]
    );

    console.log('Food logged successfully');
    res.status(201).json({
      success: true,
      message: 'Food logged successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Food logging error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log food',
      error: error.message
    });
  }
});

router.get('/daily/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;

    const result = await pool.query(
      'SELECT * FROM food_entries WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC',
      [userId, date]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get daily entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get entries',
      error: error.message
    });
  }
});

export default router;
