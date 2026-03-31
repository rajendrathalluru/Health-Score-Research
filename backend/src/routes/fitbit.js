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

function formatLocalDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    dates.push(formatLocalDateOnly(date));
  }
  return dates;
}

function formatDateOnly(date) {
  return formatLocalDateOnly(date);
}

function parseAnchorDate(value) {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getDatesForPeriod(period = 'week', anchorDateValue = null) {
  const anchor = parseAnchorDate(anchorDateValue) ?? new Date();
  anchor.setHours(0, 0, 0, 0);

  let start = new Date(anchor);
  let end = new Date(anchor);

  if (period === 'month') {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  } else if (period === 'day') {
    start = new Date(anchor);
    end = new Date(anchor);
  } else {
    const diff = (anchor.getDay() + 6) % 7;
    start.setDate(anchor.getDate() - diff);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    dates,
    start: formatDateOnly(start),
    end: formatDateOnly(end),
  };
}

function getElapsedDateCount(dates) {
  const today = formatLocalDateOnly(new Date());
  const elapsed = dates.filter((date) => date <= today).length;
  return elapsed > 0 ? elapsed : dates.length;
}

async function getCurrentWeekSummary(client, userId) {
  const weekDates = getCurrentWeekDates();
  const weekStart = weekDates[0];
  const latestDate = weekDates[weekDates.length - 1];

  if (!weekStart) {
    return null;
  }

  const [aggregateResult, latestMeasurementResult, userResult] = await Promise.all([
    client.query(
      `SELECT
         COALESCE(SUM(COALESCE(mvpa_minutes, 0)), 0) AS active_minutes,
         COALESCE(SUM(COALESCE(steps, 0)), 0) AS steps
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')`,
      [userId, weekStart]
    ),
    client.query(
      `SELECT date::text AS date, weight_kg, bmi, waist_cm
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')
       ORDER BY date DESC
       LIMIT 1`,
      [userId, weekStart]
    ),
    client.query(
      `SELECT height_cm
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    )
  ]);

  const aggregate = aggregateResult.rows[0] ?? {};
  const latestMeasurement = latestMeasurementResult.rows[0] ?? null;
  const user = userResult.rows[0] ?? null;

  return {
    date: latestDate,
    weekStart,
    datesSynced: weekDates,
    steps: Number(aggregate.steps ?? 0),
    activeMinutes: Number(aggregate.active_minutes ?? 0),
    caloriesBurned: 0,
    weightKg: latestMeasurement?.weight_kg ?? null,
    heightCm: user?.height_cm ?? null,
    bmi: latestMeasurement?.bmi ?? null,
    waistCm: latestMeasurement?.waist_cm ?? null,
    sources: {
      weight: latestMeasurement?.weight_kg !== null && latestMeasurement?.weight_kg !== undefined ? 'stored_metric' : null,
      activity: 'fitbit_or_manual_from_current_week',
      bmi: latestMeasurement?.bmi !== null && latestMeasurement?.bmi !== undefined ? 'stored_metric' : 'unavailable'
    }
  };
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

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
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

        // Ensure each ThriveScore account keeps only one active Fitbit link.
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
  const today = formatLocalDateOnly(new Date());
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
    const connected = result.rows.length > 0;
    const summary = connected ? await getCurrentWeekSummary(client, userId) : null;

    res.json({
      success: true,
      connected,
      fitbit_user_id: result.rows[0]?.fitbit_user_id ?? null,
      data: summary
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /api/fitbit/week-zones
// Returns current-week Fitbit Active Zone Minutes for visuals only.
// This does not affect activity scoring.
// ─────────────────────────────────────────
router.get('/week-zones', authenticate, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    const tokenResult = await client.query(
      'SELECT fitbit_user_id, access_token, refresh_token, expires_at FROM fitbit_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fitbit not connected' });
    }

    let { fitbit_user_id, access_token, refresh_token, expires_at } = tokenResult.rows[0];
    if (new Date() >= new Date(expires_at)) {
      access_token = await refreshAccessToken(fitbit_user_id, refresh_token, client);
    }

    const weekDates = getCurrentWeekDates();
    const zoneResponses = await Promise.all(
      weekDates.map((date) =>
        fetch(`https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${date}/${date}.json`, {
          headers: { Authorization: `Bearer ${access_token}` }
        })
      )
    );

    const forbiddenResponse = zoneResponses.find((response) => response.status === 401 || response.status === 403);
    if (forbiddenResponse) {
      return res.json({
        success: true,
        available: false,
        message: 'Active Zone Minutes are not available for this Fitbit app configuration.',
      });
    }

    const payloads = await Promise.all(zoneResponses.map((response) => response.json()));

    const days = weekDates.map((date, index) => {
      const row =
        payloads[index]?.['activities-active-zone-minutes']?.[0] ??
        payloads[index]?.activitiesActiveZoneMinutes?.[0] ??
        payloads[index]?.['activitiesActiveZoneMinutes']?.[0] ??
        null;

      const fatBurn = Number(
        row?.fatBurnActiveZoneMinutes ??
        row?.value?.fatBurnActiveZoneMinutes ??
        0
      );
      const cardio = Number(
        row?.cardioActiveZoneMinutes ??
        row?.value?.cardioActiveZoneMinutes ??
        0
      );
      const peak = Number(
        row?.peakActiveZoneMinutes ??
        row?.value?.peakActiveZoneMinutes ??
        0
      );
      const activeZoneMinutes = Number(
        row?.activeZoneMinutes ??
        row?.value?.activeZoneMinutes ??
        (fatBurn + cardio + peak)
      );

      return {
        date,
        fatBurn,
        cardio,
        peak,
        zoneMinutes: activeZoneMinutes,
      };
    });

    const totals = days.reduce((acc, day) => ({
      fatBurn: acc.fatBurn + day.fatBurn,
      cardio: acc.cardio + day.cardio,
      peak: acc.peak + day.peak,
      zoneMinutes: acc.zoneMinutes + day.zoneMinutes,
    }), {
      fatBurn: 0,
      cardio: 0,
      peak: 0,
      zoneMinutes: 0,
    });

    res.json({
      success: true,
      available: true,
      data: {
        weekStart: weekDates[0],
        days,
        totals,
      }
    });
  } catch (err) {
    console.error('Fitbit week zones error:', err);
    res.status(500).json({ success: false, message: 'Failed to load Fitbit heart-rate zone minutes', error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /api/fitbit/timeseries
// Visual-only time series for steps, active minutes, and active zone minutes.
// Does not change sync or scoring logic.
// ─────────────────────────────────────────
router.get('/timeseries', authenticate, async (req, res) => {
  const userId = req.user.id;
  const metric = String(req.query.metric || 'steps');
  const period = String(req.query.period || 'week');
  const anchorDate = req.query.anchorDate ? String(req.query.anchorDate) : null;
  const allowedMetrics = new Set(['steps', 'active', 'azm']);
  const allowedPeriods = new Set(['day', 'week', 'month']);

  if (!allowedMetrics.has(metric)) {
    return res.status(400).json({ success: false, message: 'Invalid metric' });
  }
  if (!allowedPeriods.has(period)) {
    return res.status(400).json({ success: false, message: 'Invalid period' });
  }

  const client = await pool.connect();
  try {
    const { dates, start, end } = getDatesForPeriod(period, anchorDate);

    if (metric === 'steps' || metric === 'active') {
      const result = await client.query(
        `SELECT date::text AS date, COALESCE(steps, 0) AS steps, COALESCE(mvpa_minutes, 0) AS mvpa_minutes
         FROM daily_measurements
         WHERE user_id = $1
           AND date >= $2::date
           AND date <= $3::date
         ORDER BY date ASC`,
        [userId, start, end]
      );

      const byDate = new Map(result.rows.map((row) => [row.date, row]));
      const points = dates.map((date) => ({
        date,
        value: Number(
          metric === 'steps'
            ? byDate.get(date)?.steps ?? 0
            : byDate.get(date)?.mvpa_minutes ?? 0
        ),
      }));

      const total = points.reduce((sum, point) => sum + point.value, 0);
      const divisor = getElapsedDateCount(dates);
      const average = divisor ? total / divisor : 0;

      return res.json({
        success: true,
        available: true,
        data: {
          metric,
          period,
          start,
          end,
          points,
          total,
          average,
        },
      });
    }

    const tokenResult = await client.query(
      'SELECT fitbit_user_id, access_token, refresh_token, expires_at FROM fitbit_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.json({
        success: true,
        available: false,
        message: 'Fitbit is not connected.',
      });
    }

    let { fitbit_user_id, access_token, refresh_token, expires_at } = tokenResult.rows[0];
    if (new Date() >= new Date(expires_at)) {
      access_token = await refreshAccessToken(fitbit_user_id, refresh_token, client);
    }

    const responses = await Promise.all(
      dates.map((date) =>
        fetch(`https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${date}/${date}.json`, {
          headers: { Authorization: `Bearer ${access_token}` }
        })
      )
    );

    const blocked = responses.find((response) => response.status === 401 || response.status === 403 || response.status === 404);
    if (blocked) {
      return res.json({
        success: true,
        available: false,
        message: 'Active Zone Minutes are not available for this Fitbit app configuration.',
      });
    }

    const payloads = await Promise.all(responses.map((response) => response.json()));
    const points = dates.map((date, index) => {
      const row =
        payloads[index]?.['activities-active-zone-minutes']?.[0] ??
        payloads[index]?.activitiesActiveZoneMinutes?.[0] ??
        payloads[index]?.['activitiesActiveZoneMinutes']?.[0] ??
        null;

      const fatBurn = Number(
        row?.fatBurnActiveZoneMinutes ??
        row?.value?.fatBurnActiveZoneMinutes ??
        0
      );
      const cardio = Number(
        row?.cardioActiveZoneMinutes ??
        row?.value?.cardioActiveZoneMinutes ??
        0
      );
      const peak = Number(
        row?.peakActiveZoneMinutes ??
        row?.value?.peakActiveZoneMinutes ??
        0
      );
      const value = Number(
        row?.activeZoneMinutes ??
        row?.value?.activeZoneMinutes ??
        (fatBurn + cardio + peak)
      );

      return { date, value, fatBurn, cardio, peak };
    });

    const total = points.reduce((sum, point) => sum + point.value, 0);
    const divisor = getElapsedDateCount(dates);
    const average = divisor ? total / divisor : 0;

    res.json({
      success: true,
      available: true,
      data: {
        metric,
        period,
        start,
        end,
        points,
        total,
        average,
      },
    });
  } catch (err) {
    console.error('Fitbit timeseries error:', err);
    res.status(500).json({ success: false, message: 'Failed to load Fitbit time series', error: err.message });
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
