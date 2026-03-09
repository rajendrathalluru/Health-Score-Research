import './config/env.js'; // ← must be absolute first line

import cors from 'cors';
// ... rest of your imports
import dotenv from 'dotenv';
dotenv.config(); // ← MUST be first before any other imports

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import testRoutes from './routes/test.js';
import foodRoutes from './routes/food.js';
import scoreRoutes from './routes/score.js';
import measurementRoutes from './routes/measurements.js';
import progressRoutes from './routes/progress.js';
import fitbitRoutes from './routes/fitbit.js';
import dailyLogsRoutes   from './routes/dailyLogs.js';    
import weeklyscoreRoutes from './routes/weeklyScore.js';  
import profileRoutes from './routes/profile.js';





const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({ message: 'HealthScore Tracker API', version: '1.0.0' });
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Backend is working!' });
});

app.use('/api/auth', authRoutes);
app.use('/api', testRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/fitbit', fitbitRoutes);
app.use('/api/daily-logs',   dailyLogsRoutes);    
app.use('/api/weekly-score', weeklyscoreRoutes); 
app.use('/api/profile', profileRoutes);


app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  HealthScore Tracker API Server       ║
║  Port: ${PORT}                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}                ║
╚════════════════════════════════════════╝
  `);
});

export default app;
