import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/db-test', async (req, res) => {
  try {
    console.log('Testing database connection...');
    console.log('Connection string:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    const result = await pool.query('SELECT NOW()');
    
    res.json({
      success: true,
      message: 'Database connected',
      time: result.rows[0]
    });
  } catch (error) {
    console.error('Database test error:', error.message);
    console.error('Full error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      details: error.toString()
    });
  }
});

export default router;
