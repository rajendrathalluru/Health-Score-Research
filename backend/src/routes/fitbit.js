import express from 'express';
import fetch from 'node-fetch';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

const SCOPES = [
  'activity',
  'weight',
  'profile',
  'heartrate',
  'sleep'
].join('%20');

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function getCurrentWeekDates() {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    if (date > now) break;
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// ─────────────────────────────────────────
// GET /api/fitbit/auth-url
// Returns Fitbit authorization URL for the authenticated user.
// ─────────────────────────────────────────
router.get('/auth-url', authenticate, (req, res) => {
  const userId = req.user.id;

  const clientId    = process.env.FITBIT_CLIENT_ID;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      success: false,
      message: 'Fitbit OAuth is not configured on the server',
    });
  }

  // Encode userId in state param so we get it back after OAuth
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const authUrl =
    `https://www.fitbit.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&prompt=${encodeURIComponent('login consent')}` +
    `&state=${state}`;

  res.json({ success: true, authUrl });
});

// ─────────────────────────────────────────
// GET /api/fitbit/callback
// Exchanges auth code for token, saves linked to user
// ─────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const FRONTEND_URL = getFrontendUrl();

  if (error || !code || !state) {
    console.error('Fitbit OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/activity?fitbit=error`);
  }

  // Decode userId from state
  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    userId = decoded.userId;
  } catch (e) {
    console.error('Invalid state param:', e);
    return res.redirect(`${FRONTEND_URL}/activity?fitbit=error`);
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
      try {
        await client.query('BEGIN');

        const existingLink = await client.query(
          `SELECT user_id
           FROM fitbit_tokens
           WHERE fitbit_user_id = $1
           LIMIT 1`,
          [fitbit_user_id]
        );

        if (existingLink.rows.length && existingLink.rows[0].user_id !== userId) {
          await client.query('ROLLBACK');
          return res.redirect(`${FRONTEND_URL}/activity?fitbit=already_linked`);
        }

        // Ensure each HealthScore account keeps only one active Fitbit link.
        await client.query(
          `DELETE FROM fitbit_tokens
           WHERE user_id = $1
             AND fitbit_user_id <> $2`,
          [userId, fitbit_user_id]
        );

        await client.query(`
          INSERT INTO fitbit_tokens (fitbit_user_id, user_id, access_token, refresh_token, expires_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fitbit_user_id)
          DO UPDATE SET
            access_token  = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at    = EXCLUDED.expires_at,
            updated_at    = NOW()
        `, [fitbit_user_id, userId, access_token, refresh_token, expiresAt]);

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      }
    } finally {
      client.release();
    }

    // Pass fitbit_user_id back to frontend
    res.redirect(`${FRONTEND_URL}/activity?fitbit=connected&fitbit_user_id=${fitbit_user_id}`);

  } catch (err) {
    console.error('Fitbit callback error:', err);
    res.redirect(`${getFrontendUrl()}/activity?fitbit=error`);
  }
});

// ─────────────────────────────────────────
// POST /api/fitbit/sync
// Fetches current week's Fitbit activity data using user_id
// ─────────────────────────────────────────
router.post('/sync', authenticate, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const weekDates = getCurrentWeekDates();

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

    // Fetch current-week activity plus today's body/profile data.
    const activityResponses = await Promise.all(
      weekDates.map((date) =>
        fetch(`https://api.fitbit.com/1/user/-/activities/date/${date}.json`, {
          headers: { Authorization: `Bearer ${access_token}` }
        })
      )
    );
    const [weightRes, profileRes] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/body/log/weight/date/${today}.json`, {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      fetch(`https://api.fitbit.com/1/user/-/profile.json`, {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    ]);

    const activityPayloads = await Promise.all(activityResponses.map((response) => response.json()));
    const [weightData, profileData] = await Promise.all([
      weightRes.json(),
      profileRes.json()
    ]);

    const weeklyActivityData = weekDates.map((date, index) => ({
      date,
      summary: activityPayloads[index]?.summary ?? {},
    }));

    console.log('📊 Weekly Activity Summary:', JSON.stringify(weeklyActivityData, null, 2));
    console.log('⚖️  Weight Log:', JSON.stringify(weightData, null, 2));
    console.log('👤 Profile:', JSON.stringify({
      height:     profileData?.user?.height,
      heightUnit: profileData?.user?.heightUnit,
      weight:     profileData?.user?.weight,
      weightUnit: profileData?.user?.weightUnit,
      strideLengthWalking: profileData?.user?.strideLengthWalking,
    }, null, 2));

    // ── Current week activity ─────────────────────────────
    const manualWeekResult = await client.query(
      `SELECT date::text AS date, mvpa_minutes, steps, weight_kg, bmi, waist_cm
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')`,
      [userId, weekDates[0]]
    );
    const manualByDate = new Map(manualWeekResult.rows.map((row) => [row.date, row]));

    let weeklySteps = 0;
    let weeklyActiveMinutes = 0;
    let weeklyCaloriesBurned = 0;

    for (const day of weeklyActivityData) {
      const fitbitSteps = Number(day.summary?.steps ?? 0);
      const fitbitActiveMinutes =
        Number(day.summary?.fairlyActiveMinutes ?? 0) +
        Number(day.summary?.veryActiveMinutes ?? 0);
      const fitbitCalories = Number(day.summary?.caloriesOut ?? 0);
      const manual = manualByDate.get(day.date);

      const finalSteps = fitbitSteps > 0 ? fitbitSteps : Number(manual?.steps ?? 0);
      const finalActiveMinutes = fitbitActiveMinutes > 0 ? fitbitActiveMinutes : Number(manual?.mvpa_minutes ?? 0);

      weeklySteps += finalSteps;
      weeklyActiveMinutes += finalActiveMinutes;
      weeklyCaloriesBurned += fitbitCalories;

      await client.query(
        `INSERT INTO daily_measurements
         (user_id, date, weight_kg, bmi, waist_cm, mvpa_minutes, steps)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, date)
         DO UPDATE SET
           weight_kg    = COALESCE(daily_measurements.weight_kg, EXCLUDED.weight_kg),
           bmi          = COALESCE(daily_measurements.bmi, EXCLUDED.bmi),
           waist_cm     = COALESCE(daily_measurements.waist_cm, EXCLUDED.waist_cm),
           mvpa_minutes = COALESCE(EXCLUDED.mvpa_minutes, daily_measurements.mvpa_minutes),
           steps        = COALESCE(EXCLUDED.steps, daily_measurements.steps)`,
        [
          userId,
          day.date,
          manual?.weight_kg ?? null,
          manual?.bmi ?? null,
          manual?.waist_cm ?? null,
          finalActiveMinutes,
          finalSteps,
        ]
      );
    }

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

    const todayMeasurement = manualByDate.get(today) ?? null;

    // Final values with fallback chain
    const finalWeightKg   = weightKg ?? todayMeasurement?.weight_kg ?? null;
    const finalHeightCm   = heightCm ?? null;
    const finalBmi        = bmi ?? (todayMeasurement?.bmi ? parseFloat(todayMeasurement.bmi) : null);
    const finalWaist      = todayMeasurement?.waist_cm ?? null;

    // Persist today's weight/BMI into daily_measurements without overwriting
    // the already-synced weekly activity values.
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
      [
        userId,
        today,
        finalWeightKg,
        finalBmi,
        finalWaist,
        weeklyActivityData.find((day) => day.date === today)
          ? (
              Number(weeklyActivityData.find((day) => day.date === today)?.summary?.fairlyActiveMinutes ?? 0) +
              Number(weeklyActivityData.find((day) => day.date === today)?.summary?.veryActiveMinutes ?? 0)
            ) || Number(todayMeasurement?.mvpa_minutes ?? 0)
          : Number(todayMeasurement?.mvpa_minutes ?? 0),
        weeklyActivityData.find((day) => day.date === today)
          ? Number(weeklyActivityData.find((day) => day.date === today)?.summary?.steps ?? 0) || Number(todayMeasurement?.steps ?? 0)
          : Number(todayMeasurement?.steps ?? 0),
      ]
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
      weekDates,
      steps: weeklySteps,
      activeMinutes: weeklyActiveMinutes,
      weightKg: finalWeightKg, heightCm: finalHeightCm,
      bmi: finalBmi, waist: finalWaist,
      weightSource
    });

    res.json({
      success: true,
      data: {
        date:            today,
        weekStart:       weekDates[0],
        datesSynced:     weekDates,
        steps:           weeklySteps,
        activeMinutes:   weeklyActiveMinutes,
        caloriesBurned:  weeklyCaloriesBurned,
        weightKg:        finalWeightKg,
        heightCm:        finalHeightCm,
        bmi:             finalBmi,
        waistCm:         finalWaist,
        // Source info for transparency
        sources: {
          weight:   weightSource,
          activity: 'fitbit_with_manual_fallback',
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
// GET /api/fitbit/status
// Check whether the authenticated user has Fitbit connected.
// ─────────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  const userId = req.user.id;
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

router.delete('/disconnect', authenticate, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM fitbit_tokens WHERE user_id = $1 RETURNING fitbit_user_id',
      [userId]
    );

    res.json({
      success: true,
      disconnected: result.rowCount > 0,
      message: result.rowCount > 0 ? 'Fitbit disconnected' : 'No Fitbit connection found',
    });
  } catch (err) {
    console.error('Fitbit disconnect error:', err);
    res.status(500).json({ success: false, message: 'Failed to disconnect Fitbit', error: err.message });
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
