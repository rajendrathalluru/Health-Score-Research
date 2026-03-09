import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import pool from '../config/database.js';

const router = express.Router();

const JWT_SECRET   = process.env.JWT_SECRET   || 'default-secret-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Google OAuth2 client ─────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
);

function makeToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url, gender, birth_date, height_cm,
                 cancer_type, cancer_stage, diagnosis_date`,
      [email.toLowerCase().trim(), hash, name.trim()]
    );

    const user  = result.rows[0];
    const token = makeToken(user.id, user.email);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, token },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT id, email, name, password_hash, avatar_url, gender, birth_date, height_cm,
              cancer_type, cancer_stage, diagnosis_date
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google sign-in. Please continue with Google.',
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const { password_hash, ...safeUser } = user;
    const token = makeToken(user.id, user.email);

    res.json({ success: true, message: 'Login successful', data: { user: safeUser, token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
});

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'consent',
  });
  res.redirect(url);
});

// ─── GET /api/auth/google/callback ───────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    const { id: googleId, email, name, picture } = googleUser;

    // Upsert: create or update user — name is auto-filled from Google
    const result = await pool.query(
      `INSERT INTO users (email, name, google_id, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET
         google_id  = COALESCE(users.google_id, EXCLUDED.google_id),
         avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
         -- Only update name if it was never set by the user manually
         name       = CASE WHEN users.name IS NULL OR users.name = '' THEN EXCLUDED.name ELSE users.name END,
         updated_at = NOW()
       RETURNING id, email, name, avatar_url, gender, birth_date, height_cm,
                 cancer_type, cancer_stage, diagnosis_date`,
      [email.toLowerCase(), name, googleId, picture]
    );

    const user  = result.rows[0];
    const token = makeToken(user.id, user.email);

    // Pass full user object to frontend so profile page can pre-fill
    const encoded = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&user=${encoded}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns full user profile — used on app load to re-hydrate state
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);

    const result = await pool.query(
      `SELECT id, email, name, avatar_url, gender, birth_date, height_cm,
              cancer_type, cancer_stage, diagnosis_date, phone, created_at
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});

export default router;