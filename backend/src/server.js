import './config/env.js'; // ← must be absolute first line

import cors from 'cors';
// ... rest of your imports
import dotenv from 'dotenv';
dotenv.config(); // ← MUST be first before any other imports

import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import authRoutes from './routes/auth.js';
import testRoutes from './routes/test.js';
import measurementRoutes from './routes/measurements.js';
import progressRoutes from './routes/progress.js';
import fitbitRoutes from './routes/fitbit.js';
import weeklyscoreRoutes from './routes/weeklyScore.js';  
import profileRoutes from './routes/profile.js';





const app = express();
const PORT = process.env.PORT || 3001;
const frontendDistPath = path.resolve(process.cwd(), 'public');
const hasFrontendBundle = fs.existsSync(path.join(frontendDistPath, 'index.html'));

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
  res.json({ message: 'ThriveScore Tracker API', version: '1.0.0' });
});

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Backend is working!' });
});

app.use('/api/auth', authRoutes);
app.use('/api', testRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/fitbit', fitbitRoutes);
app.use('/api/weekly-score', weeklyscoreRoutes); 
app.use('/api/profile', profileRoutes);

if (hasFrontendBundle) {
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    },
  }));
  app.get(/^(?!\/api(?:\/|$)|\/health$).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

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

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  ThriveScore Tracker API Server       ║
║  Port: ${PORT}                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}                ║
╚════════════════════════════════════════╝
  `);
});

function shutdown(signal) {
  console.log(`[shutdown] Received ${signal}. Closing server gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('[shutdown] Error while closing server:', err);
      process.exit(1);
    }
    console.log('[shutdown] Server closed successfully.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[shutdown] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
