import express from 'express';
import fetch from 'node-fetch';
import pool from '../config/database.js';

const router = express.Router();

const SCOPES = [
  'activity',
  'weight',
  'profile',
  'heartrate',
  'sleep'
].join('%20');

// ─────────────────────────────────────────
// GET /api/fitbit/auth-url?userId=123
// Returns Fitbit authorization URL with userId in state
// ─────────────────────────────────────────
router.get('/auth-url', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const clientId    = process.env.FITBIT_CLIENT_ID;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;

  // Encode userId in state param so we get it back after OAuth
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const authUrl =
    `https://www.fitbit.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  res.json({ success: true, authUrl });
});

// ─────────────────────────────────────────
// GET /api/fitbit/callback
// Exchanges auth code for token, saves linked to user
// ─────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL;

  if (error || !code || !state) {
    console.error('Fitbit OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/dashboard?fitbit=error`);
  }

  // Decode userId from state
  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    userId = decoded.userId;
  } catch (e) {
    console.error('Invalid state param:', e);
    return res.redirect(`${FRONTEND_URL}/dashboard?fitbit=error`);
  }

  try {
    const clientId     = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri  = process.env.FITBIT_REDIRECT_URI;
    const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        grant_type:   'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(`${FRONTEND_URL}/dashboard?fitbit=error`);
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      user_id: fitbit_user_id
    } = tokenData;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save token linked to app user_id
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO fitbit_tokens (fitbit_user_id, user_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (fitbit_user_id)
        DO UPDATE SET
          user_id       = EXCLUDED.user_id,
          access_token  = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at    = EXCLUDED.expires_at,
          updated_at    = NOW()
      `, [fitbit_user_id, userId, access_token, refresh_token, expiresAt]);
    } finally {
      client.release();
    }

    // Pass fitbit_user_id back to frontend
    res.redirect(`${FRONTEND_URL}/dashboard?fitbit=connected&fitbit_user_id=${fitbit_user_id}`);

  } catch (err) {
    console.error('Fitbit callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?fitbit=error`);
  }
});

// ─────────────────────────────────────────
// POST /api/fitbit/sync
// Fetches today's Fitbit data using user_id
// ─────────────────────────────────────────
router.post('/sync', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }
  const today = new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    // Look up token by app user_id (not fitbit_user_id)
    const tokenResult = await client.query(
      'SELECT fitbit_user_id, access_token, refresh_token, expires_at FROM fitbit_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fitbit not connected' });
    }

    let { fitbit_user_id, access_token, refresh_token, expires_at } = tokenResult.rows[0];

    // Refresh token if expired
    if (new Date() >= new Date(expires_at)) {
      access_token = await refreshAccessToken(fitbit_user_id, refresh_token, client);
    }

    // Fetch data in parallel
    const [activityRes, weightRes, profileRes] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      fetch(`https://api.fitbit.com/1/user/-/body/log/weight/date/${today}.json`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      fetch(`https://api.fitbit.com/1/user/-/profile.json`, {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    ]);

    const [activityData, weightData, profileData] = await Promise.all([
      activityRes.json(),
      weightRes.json(),
      profileRes.json()
    ]);

    // Debug: see exact raw values from Fitbit
    console.log('📊 Activity Summary:', JSON.stringify(activityData?.summary, null, 2));
    console.log('⚖️  Weight Log:', JSON.stringify(weightData, null, 2));
    console.log('👤 Profile:', JSON.stringify({
      height:     profileData?.user?.height,
      heightUnit: profileData?.user?.heightUnit,
      weight:     profileData?.user?.weight,
      weightUnit: profileData?.user?.weightUnit,
      strideLengthWalking: profileData?.user?.strideLengthWalking,
    }, null, 2));

    // ── Activity ──────────────────────────────────────────
    const steps          = activityData?.summary?.steps ?? 0;
    const activeMinutes  = (activityData?.summary?.fairlyActiveMinutes ?? 0)
                         + (activityData?.summary?.veryActiveMinutes ?? 0);
    const caloriesBurned = activityData?.summary?.caloriesOut ?? 0;

    const profile = profileData?.user ?? {};

    // ── Weight ────────────────────────────────────────────
    // Fitbit weight log always returns in kg regardless of account settings
    const weightLogRaw  = weightData?.weight?.[0]?.weight ?? null;
    const weightProfRaw = profile?.weight ?? null;
    const weightRaw     = weightLogRaw ?? weightProfRaw;
    const weightSource  = weightLogRaw ? 'fitbit_log' : weightProfRaw ? 'fitbit_profile' : null;

    // No conversion needed — Fitbit API always returns weight in kg
    const weightKg = weightRaw !== null ? parseFloat(weightRaw.toFixed(1)) : null;

    // ── BMI ───────────────────────────────────────────────
    const bmiFromLog = weightData?.weight?.[0]?.bmi ?? null;

    // ── Height ────────────────────────────────────────────
    // Fitbit profile always returns height in cm regardless of account settings
    const heightRaw = profile?.height ?? null;
    const heightCm  = heightRaw !== null ? parseFloat(heightRaw.toFixed(1)) : null;

    // ── Calculate BMI manually if not in log ──────────────
    let bmi = bmiFromLog;
    if (!bmi && weightKg && heightCm) {
      const heightM = heightCm / 100;
      bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));
    }

    // Fallback to existing daily_measurements for today if Fitbit misses some fields
    const manualResult = await client.query(
      `SELECT bmi, waist_cm, mvpa_minutes, steps, weight_kg
       FROM daily_measurements
       WHERE user_id = $1 AND date = $2
       LIMIT 1`,
      [userId, today]
    );
    const manual = manualResult.rows[0] ?? null;

    // Final values with fallback chain
    const finalWeightKg   = weightKg ?? manual?.weight_kg ?? null;
    const finalHeightCm   = heightCm ?? null;
    const finalBmi        = bmi ?? (manual?.bmi ? parseFloat(manual.bmi) : null);
    const finalWaist      = manual?.waist_cm ?? null;
    const finalActiveMins = activeMinutes > 0 ? activeMinutes : (manual?.mvpa_minutes ?? 0);
    const finalSteps      = steps > 0 ? steps : (manual?.steps ?? 0);

    // Persist Fitbit/manual merged values into daily_measurements for scoring engine.
    await client.query(
      `INSERT INTO daily_measurements
       (user_id, date, weight_kg, bmi, waist_cm, mvpa_minutes, steps)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         weight_kg    = COALESCE(EXCLUDED.weight_kg, daily_measurements.weight_kg),
         bmi          = COALESCE(EXCLUDED.bmi, daily_measurements.bmi),
         waist_cm     = COALESCE(EXCLUDED.waist_cm, daily_measurements.waist_cm),
         mvpa_minutes = COALESCE(EXCLUDED.mvpa_minutes, daily_measurements.mvpa_minutes),
         steps        = COALESCE(EXCLUDED.steps, daily_measurements.steps)`,
      [userId, today, finalWeightKg, finalBmi, finalWaist, finalActiveMins, finalSteps]
    );

    // If user height is not set, seed it from Fitbit profile.
    if (finalHeightCm !== null) {
      await client.query(
        `UPDATE users
         SET height_cm = COALESCE(height_cm, $1)
         WHERE id = $2`,
        [finalHeightCm, userId]
      );
    }

    console.log('✅ Sync result:', {
      steps: finalSteps, activeMinutes: finalActiveMins,
      weightKg: finalWeightKg, heightCm: finalHeightCm,
      bmi: finalBmi, waist: finalWaist,
      weightSource
    });

    res.json({
      success: true,
      data: {
        date:            today,
        steps:           finalSteps,
        activeMinutes:   finalActiveMins,
        caloriesBurned,
        weightKg:        finalWeightKg,
        heightCm:        finalHeightCm,
        bmi:             finalBmi,
        waistCm:         finalWaist,
        // Source info for transparency
        sources: {
          weight:   weightSource,
          activity: activeMinutes > 0 ? 'fitbit' : 'manual',
          bmi:      bmiFromLog ? 'fitbit_log' : (bmi ? 'calculated' : 'manual')
        }
      }
    });

  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ success: false, message: 'Sync failed', error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /api/fitbit/status?userId=123
// Check if a user has Fitbit connected
// ─────────────────────────────────────────
router.get('/status', async (req, res) => {
  const { userId } = req.query;
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT fitbit_user_id FROM fitbit_tokens WHERE user_id = $1',
      [userId]
    );
    res.json({
      success: true,
      connected: result.rows.length > 0,
      fitbit_user_id: result.rows[0]?.fitbit_user_id ?? null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// Helper: Refresh access token
// ─────────────────────────────────────────
async function refreshAccessToken(fitbit_user_id, refresh_token, client) {
  const clientId     = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Token refresh failed: ' + JSON.stringify(data));

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await client.query(`
    UPDATE fitbit_tokens
    SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
    WHERE fitbit_user_id = $4
  `, [data.access_token, data.refresh_token, expiresAt, fitbit_user_id]);

  return data.access_token;
}

export default router;
