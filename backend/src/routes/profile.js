import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// ─── GET /api/profile  (fetch current user's profile) ────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id, email, name, gender, birth_date, height_cm,
         cancer_type, cancer_stage, diagnosis_date,
         phone, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET /profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err.message });
  }
});

// ─── PUT /api/profile  (update profile) ──────────────────────────────────────
router.put('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      gender,
      birth_date,
      height_cm,
      cancer_type,
      cancer_stage,
      diagnosis_date,
      phone,
    } = req.body;

    // Basic validation
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
    }

    const result = await pool.query(
      `UPDATE users SET
         name             = COALESCE($1, name),
         gender           = COALESCE($2, gender),
         birth_date       = COALESCE($3, birth_date),
         height_cm        = COALESCE($4, height_cm),
         cancer_type      = COALESCE($5, cancer_type),
         cancer_stage     = COALESCE($6, cancer_stage),
         diagnosis_date   = COALESCE($7, diagnosis_date),
         phone            = COALESCE($8, phone),
         updated_at       = NOW()
       WHERE id = $9
       RETURNING
         id, email, name, gender, birth_date, height_cm,
         cancer_type, cancer_stage, diagnosis_date,
         phone, avatar_url, created_at`,
      [
        name?.trim()    ?? null,
        gender          ?? null,
        birth_date      ?? null,
        height_cm       ?? null,
        cancer_type     ?? null,
        cancer_stage    ?? null,
        diagnosis_date  ?? null,
        phone           ?? null,
        req.user.id,
      ]
    );

    // Sync updated name back to localStorage-friendly response
    res.json({ success: true, message: 'Profile updated', data: result.rows[0] });
  } catch (err) {
    console.error('PUT /profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: err.message });
  }
});

export default router;