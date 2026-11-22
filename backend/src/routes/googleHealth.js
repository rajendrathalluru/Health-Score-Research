import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

const GOOGLE_HEALTH_API_BASE = 'https://health.googleapis.com/v4/users/me/dataTypes';
const SCOPE_ACTIVITY_READ = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
const SCOPE_METRICS_READ = 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';
const REQUIRED_SCOPES = [
  'openid',
  'email',
  SCOPE_ACTIVITY_READ,
  SCOPE_METRICS_READ,
];

function getJwtSecret() {
  return process.env.JWT_SECRET || 'default-secret-key';
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function getGoogleHealthOAuthConfig() {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_HEALTH_REDIRECT_URI ||
    'http://localhost:3001/api/google-health/callback';

  return { clientId, clientSecret, redirectUri };
}

function createOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getGoogleHealthOAuthConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function parseGrantedScopes(scopeString) {
  const scopes = new Set(String(scopeString || '').split(/\s+/).filter(Boolean));
  return {
    activity: scopes.has(SCOPE_ACTIVITY_READ),
    bodyMetrics: scopes.has(SCOPE_METRICS_READ),
  };
}

function formatLocalDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toCivilDateObject(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function addDaysToDateStr(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDateOnly(date);
}

function extractCivilDateStr(item) {
  const dateObj =
    item?.civilTimeInterval?.startDate ??
    item?.start?.date ??
    item?.startDate ??
    null;

  if (dateObj?.year && dateObj?.month && dateObj?.day) {
    const year = String(dateObj.year);
    const month = String(dateObj.month).padStart(2, '0');
    const day = String(dateObj.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const iso = item?.interval?.startTime ?? item?.startTime ?? item?.sampleTime ?? null;
  if (typeof iso === 'string' && iso.length >= 10) {
    return iso.slice(0, 10);
  }
  return null;
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
    dates.push(formatLocalDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    dates,
    start: formatLocalDateOnly(start),
    end: formatLocalDateOnly(end),
  };
}

function getElapsedDateCount(dates) {
  const today = formatLocalDateOnly(new Date());
  const elapsed = dates.filter((date) => date <= today).length;
  return elapsed > 0 ? elapsed : dates.length;
}

let tableEnsured = false;
async function ensureGoogleHealthTokensTable() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google_health_tokens (
        google_user_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        google_email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        scope TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_google_health_tokens_user_id
      ON google_health_tokens (user_id)
    `);
    tableEnsured = true;
  } catch (createErr) {
    const existsResult = await pool.query(
      `SELECT to_regclass('public.google_health_tokens') AS regclass_name`
    );
    if (!existsResult.rows[0]?.regclass_name) {
      const err = new Error(
        'google_health_tokens table is missing. Run backend/sql/google_health_tokens.sql in your database.'
      );
      err.cause = createErr;
      throw err;
    }
    tableEnsured = true;
  }
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
      `SELECT date::text AS date, weight_kg, bmi
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')
         AND (weight_kg IS NOT NULL OR bmi IS NOT NULL)
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
    ),
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
    weightKg: latestMeasurement?.weight_kg !== null && latestMeasurement?.weight_kg !== undefined
      ? Number(latestMeasurement.weight_kg)
      : null,
    heightCm: user?.height_cm !== null && user?.height_cm !== undefined
      ? Number(user.height_cm)
      : null,
    bmi: latestMeasurement?.bmi !== null && latestMeasurement?.bmi !== undefined
      ? Number(latestMeasurement.bmi)
      : null,
    sources: {
      weight: latestMeasurement?.weight_kg !== null && latestMeasurement?.weight_kg !== undefined ? 'stored_metric' : null,
      activity: 'google_health_or_manual_from_current_week',
      bmi: latestMeasurement?.bmi !== null && latestMeasurement?.bmi !== undefined ? 'stored_metric' : 'unavailable',
    },
  };
}

async function getValidAccessToken(tokenRow, client) {
  const expiresAtMs = new Date(tokenRow.expires_at).getTime();
  // Refresh if token expires within the next 60 seconds
  if (Date.now() + 60_000 < expiresAtMs) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new Error('Google Health session expired. Please reconnect Google Health.');
  }

  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    throw new Error('Google Health OAuth is not configured on the server');
  }

  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials?.access_token) {
    throw new Error('Failed to refresh Google Health access token. Please reconnect.');
  }

  const nextExpiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000);
  const nextRefreshToken = credentials.refresh_token || tokenRow.refresh_token;
  const nextScope = credentials.scope || tokenRow.scope;

  await client.query(
    `UPDATE google_health_tokens
     SET access_token = $1,
         refresh_token = $2,
         scope = $3,
         expires_at = $4,
         updated_at = NOW()
     WHERE google_user_id = $5`,
    [
      credentials.access_token,
      nextRefreshToken,
      nextScope,
      nextExpiresAt,
      tokenRow.google_user_id,
    ]
  );

  return credentials.access_token;
}

async function fetchDailyRollUp(accessToken, dataType, startDateStr, endDateInclusiveStr) {
  const exclusiveEndStr = addDaysToDateStr(endDateInclusiveStr, 1);
  const allPoints = [];
  let pageToken = null;

  do {
    const body = {
      range: {
        start: { date: toCivilDateObject(startDateStr) },
        end: { date: toCivilDateObject(exclusiveEndStr) },
      },
      ...(pageToken ? { pageToken } : {}),
    };

    const res = await fetch(`${GOOGLE_HEALTH_API_BASE}/${dataType}/dataPoints:dailyRollUp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, points: [] };
    }

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: payload?.error?.message || `Google Health API error (${res.status})`,
        points: [],
      };
    }

    if (Array.isArray(payload.rollupDataPoints)) {
      allPoints.push(...payload.rollupDataPoints);
    }
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return { ok: true, status: 200, points: allPoints };
}

async function fetchLatestReconciledSample(accessToken, dataType) {
  const url = `${GOOGLE_HEALTH_API_BASE}/${dataType}/dataPoints:reconcile?pageSize=20`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, sample: null };
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: payload?.error?.message || `Google Health API error (${res.status})`,
      sample: null,
    };
  }

  const points = payload.dataPoints || payload.reconciledDataPoints || [];
  if (!Array.isArray(points) || points.length === 0) {
    return { ok: true, status: 200, sample: null };
  }

  // Pick the most recent sample by timestamp
  const sorted = [...points].sort((a, b) => {
    const tA = new Date(a.sampleTime || a.interval?.endTime || a.interval?.startTime || 0).getTime();
    const tB = new Date(b.sampleTime || b.interval?.endTime || b.interval?.startTime || 0).getTime();
    return tB - tA;
  });

  return { ok: true, status: 200, sample: sorted[0] };
}

function parseStepsByDate(points) {
  const map = new Map();
  for (const item of points) {
    const date = extractCivilDateStr(item);
    if (!date) continue;
    const count = Number(item?.steps?.countSum ?? item?.steps?.count ?? 0);
    if (!Number.isNaN(count)) {
      map.set(date, (map.get(date) || 0) + count);
    }
  }
  return map;
}

function parseActiveMinutesByDate(points) {
  const map = new Map();
  for (const item of points) {
    const date = extractCivilDateStr(item);
    if (!date) continue;

    const am = item?.activeMinutes;
    if (!am) continue;

    // Handle array breakdown (activeMinutesByActivityLevel) or single-level rollup
    if (Array.isArray(am.activeMinutesByActivityLevel)) {
      let mvpa = 0;
      for (const entry of am.activeMinutesByActivityLevel) {
        const level = String(entry?.activityLevel || '').toUpperCase();
        if (level === 'MODERATE' || level === 'VIGOROUS') {
          mvpa += Number(entry?.activeMinutes ?? entry?.activeMinutesSum ?? 0);
        }
      }
      map.set(date, (map.get(date) || 0) + mvpa);
    } else {
      const level = String(am.activityLevel || '').toUpperCase();
      if (!level || level === 'MODERATE' || level === 'VIGOROUS') {
        const mins = Number(am.activeMinutesSum ?? am.activeMinutes ?? 0);
        if (!Number.isNaN(mins)) {
          map.set(date, (map.get(date) || 0) + mins);
        }
      }
    }
  }
  return map;
}

function parseAzmByDate(points) {
  const map = new Map();
  for (const item of points) {
    const date = extractCivilDateStr(item);
    if (!date) continue;

    const azm = item?.activeZoneMinutes;
    if (!azm) continue;

    let fatBurn = 0;
    let cardio = 0;
    let peak = 0;

    if (Array.isArray(azm.activeZoneMinutesByHeartRateZone)) {
      for (const zone of azm.activeZoneMinutesByHeartRateZone) {
        const name = String(zone?.heartRateZone || '').toUpperCase();
        const mins = Number(zone?.minutes ?? 0);
        if (name === 'FAT_BURN') fatBurn += mins;
        else if (name === 'CARDIO') cardio += mins;
        else if (name === 'PEAK') peak += mins;
      }
    }

    const total = Number(
      azm.totalMinutes?.value ??
      azm.totalMinutes ??
      azm.activeZoneMinutesSum ??
      (fatBurn + cardio + peak)
    );

    const prev = map.get(date) || { value: 0, fatBurn: 0, cardio: 0, peak: 0 };
    map.set(date, {
      value: prev.value + (Number.isNaN(total) ? 0 : total),
      fatBurn: prev.fatBurn + fatBurn,
      cardio: prev.cardio + cardio,
      peak: prev.peak + peak,
    });
  }
  return map;
}

function extractWeightKg(sample) {
  const w = sample?.weight;
  if (!w) return null;
  if (w.weightGrams !== undefined && w.weightGrams !== null) {
    const grams = Number(w.weightGrams);
    return Number.isNaN(grams) || grams <= 0 ? null : parseFloat((grams / 1000).toFixed(1));
  }
  if (w.weightKilograms !== undefined && w.weightKilograms !== null) {
    const kg = Number(w.weightKilograms);
    return Number.isNaN(kg) || kg <= 0 ? null : parseFloat(kg.toFixed(1));
  }
  return null;
}

function extractHeightCm(sample) {
  const h = sample?.height;
  if (!h) return null;
  if (h.heightMillimeters !== undefined && h.heightMillimeters !== null) {
    const mm = Number(h.heightMillimeters);
    return Number.isNaN(mm) || mm <= 0 ? null : parseFloat((mm / 10).toFixed(1));
  }
  if (h.heightCentimeters !== undefined && h.heightCentimeters !== null) {
    const cm = Number(h.heightCentimeters);
    return Number.isNaN(cm) || cm <= 0 ? null : parseFloat(cm.toFixed(1));
  }
  return null;
}

// ─────────────────────────────────────────
// GET /api/google-health/auth-url
// Returns Google OAuth URL requesting Google Health API scopes.
// ─────────────────────────────────────────
router.get('/auth-url', authenticate, (req, res) => {
  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    return res.status(500).json({
      success: false,
      message: 'Google Health OAuth is not configured on the server',
    });
  }

  const state = jwt.sign(
    { userId: req.user.id, purpose: 'google_health_oauth' },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: REQUIRED_SCOPES,
    prompt: 'consent select_account',
    include_granted_scopes: true,
    state,
  });

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  res.json({ success: true, authUrl });
});

// ─────────────────────────────────────────
// GET /api/google-health/callback
// Exchanges auth code for Google Health tokens and links to the ThriveScore user.
// ─────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const FRONTEND_URL = getFrontendUrl();

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/activity?google_health=error`);
  }

  let userId;
  try {
    const decoded = jwt.verify(String(state), getJwtSecret());
    if (decoded.purpose !== 'google_health_oauth' || !decoded.userId) {
      throw new Error('Invalid OAuth state payload');
    }
    userId = decoded.userId;
  } catch (stateErr) {
    console.error('Invalid Google Health OAuth state:', stateErr.message);
    return res.redirect(`${FRONTEND_URL}/activity?google_health=error`);
  }

  const oauth2Client = createOAuthClient();
  if (!oauth2Client) {
    return res.redirect(`${FRONTEND_URL}/activity?google_health=error`);
  }

  try {
    await ensureGoogleHealthTokensTable();

    const { tokens } = await oauth2Client.getToken(String(code));
    oauth2Client.setCredentials(tokens);

    const granted = parseGrantedScopes(tokens.scope);
    if (!granted.activity && !granted.bodyMetrics) {
      return res.redirect(`${FRONTEND_URL}/activity?google_health=no_permissions`);
    }

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();
    const googleUserId = googleUser?.id;
    const googleEmail = googleUser?.email || null;

    if (!googleUserId || !tokens.access_token) {
      return res.redirect(`${FRONTEND_URL}/activity?google_health=error`);
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingLink = await client.query(
        `SELECT user_id
         FROM google_health_tokens
         WHERE google_user_id = $1
         LIMIT 1`,
        [googleUserId]
      );

      if (existingLink.rows.length && existingLink.rows[0].user_id !== userId) {
        await client.query('ROLLBACK');
        return res.redirect(`${FRONTEND_URL}/activity?google_health=already_linked`);
      }

      // Ensure each ThriveScore account keeps only one active Google Health link.
      await client.query(
        `DELETE FROM google_health_tokens
         WHERE user_id = $1
           AND google_user_id <> $2`,
        [userId, googleUserId]
      );

      await client.query(
        `INSERT INTO google_health_tokens
           (google_user_id, user_id, google_email, access_token, refresh_token, scope, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (google_user_id)
         DO UPDATE SET
           google_email  = EXCLUDED.google_email,
           access_token  = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, google_health_tokens.refresh_token),
           scope         = EXCLUDED.scope,
           expires_at    = EXCLUDED.expires_at,
           updated_at    = NOW()`,
        [
          googleUserId,
          userId,
          googleEmail,
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.scope || null,
          expiresAt,
        ]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    const statusParam = granted.activity && granted.bodyMetrics ? 'connected' : 'partial';
    res.redirect(`${FRONTEND_URL}/activity?google_health=${statusParam}`);
  } catch (err) {
    console.error('Google Health callback error:', err);
    res.redirect(`${FRONTEND_URL}/activity?google_health=error`);
  }
});

// ─────────────────────────────────────────
// GET /api/google-health/status
// Returns connection status, granted scopes, and current week summary.
// ─────────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await ensureGoogleHealthTokensTable();

    const result = await client.query(
      `SELECT google_user_id, google_email, scope
       FROM google_health_tokens
       WHERE user_id = $1`,
      [userId]
    );
    const row = result.rows[0] ?? null;
    const connected = Boolean(row);
    const summary = connected ? await getCurrentWeekSummary(client, userId) : null;

    res.json({
      success: true,
      connected,
      google_email: row?.google_email ?? null,
      grantedScopes: row ? parseGrantedScopes(row.scope) : { activity: false, bodyMetrics: false },
      data: summary,
    });
  } catch (err) {
    console.error('Google Health status error:', err);
    res.status(500).json({ success: false, message: 'Failed to load Google Health status' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// POST /api/google-health/sync
// Fetches current week's steps, active minutes, weight, and height from Google Health API v4.
// ─────────────────────────────────────────
router.post('/sync', authenticate, async (req, res) => {
  const userId = req.user.id;
  const today = formatLocalDateOnly(new Date());
  const weekDates = getCurrentWeekDates();

  const client = await pool.connect();
  try {
    await ensureGoogleHealthTokensTable();

    const tokenResult = await client.query(
      `SELECT google_user_id, access_token, refresh_token, scope, expires_at
       FROM google_health_tokens
       WHERE user_id = $1`,
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Google Health is not connected' });
    }

    const tokenRow = tokenResult.rows[0];
    const granted = parseGrantedScopes(tokenRow.scope);
    const accessToken = await getValidAccessToken(tokenRow, client);
    const warnings = [];

    const weekStart = weekDates[0];
    const weekEnd = weekDates[weekDates.length - 1];

    // Fetch activity & body metrics in parallel, respecting granted scopes
    const [stepsRes, activeMinRes, azmRes, weightRes, heightRes] = await Promise.all([
      granted.activity
        ? fetchDailyRollUp(accessToken, 'steps', weekStart, weekEnd)
        : Promise.resolve({ ok: false, skipped: true, points: [] }),
      granted.activity
        ? fetchDailyRollUp(accessToken, 'active-minutes', weekStart, weekEnd)
        : Promise.resolve({ ok: false, skipped: true, points: [] }),
      granted.activity
        ? fetchDailyRollUp(accessToken, 'active-zone-minutes', weekStart, weekEnd)
        : Promise.resolve({ ok: false, skipped: true, points: [] }),
      granted.bodyMetrics
        ? fetchLatestReconciledSample(accessToken, 'weight')
        : Promise.resolve({ ok: false, skipped: true, sample: null }),
      granted.bodyMetrics
        ? fetchLatestReconciledSample(accessToken, 'height')
        : Promise.resolve({ ok: false, skipped: true, sample: null }),
    ]);

    if (!granted.activity) {
      warnings.push('Activity permission was not granted.');
    } else if (!stepsRes.ok && !activeMinRes.ok) {
      if (stepsRes.status === 401 || activeMinRes.status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Google Health authorization expired. Please reconnect Google Health.',
        });
      }
      warnings.push(stepsRes.error || activeMinRes.error || 'Could not fetch activity data from Google Health.');
    }

    if (!granted.bodyMetrics) {
      warnings.push('Body measurements permission was not granted.');
    }

    const stepsByDate = stepsRes.ok ? parseStepsByDate(stepsRes.points) : new Map();
    const activeByDate = activeMinRes.ok ? parseActiveMinutesByDate(activeMinRes.points) : new Map();
    const azmByDate = azmRes.ok ? parseAzmByDate(azmRes.points) : new Map();

    // Load existing manual/stored entries for the current week
    const existingWeekResult = await client.query(
      `SELECT date::text AS date, mvpa_minutes, steps, weight_kg, bmi
       FROM daily_measurements
       WHERE user_id = $1
         AND date >= $2::date
         AND date < ($2::date + interval '7 days')`,
      [userId, weekStart]
    );
    const existingByDate = new Map(existingWeekResult.rows.map((row) => [row.date, row]));

    let weeklySteps = 0;
    let weeklyActiveMinutes = 0;

    for (const date of weekDates) {
      const existing = existingByDate.get(date);
      const googleSteps = Math.round(stepsByDate.get(date) ?? 0);
      const googleActive = Math.round(activeByDate.get(date) ?? azmByDate.get(date)?.value ?? 0);

      const finalSteps = googleSteps > 0 ? googleSteps : Number(existing?.steps ?? 0);
      const finalActiveMinutes = googleActive > 0 ? googleActive : Number(existing?.mvpa_minutes ?? 0);

      weeklySteps += finalSteps;
      weeklyActiveMinutes += finalActiveMinutes;

      await client.query(
        `INSERT INTO daily_measurements
         (user_id, date, weight_kg, bmi, mvpa_minutes, steps)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date)
         DO UPDATE SET
           weight_kg    = COALESCE(daily_measurements.weight_kg, EXCLUDED.weight_kg),
           bmi          = COALESCE(daily_measurements.bmi, EXCLUDED.bmi),
           mvpa_minutes = COALESCE(EXCLUDED.mvpa_minutes, daily_measurements.mvpa_minutes),
           steps        = COALESCE(EXCLUDED.steps, daily_measurements.steps)`,
        [
          userId,
          date,
          existing?.weight_kg ?? null,
          existing?.bmi ?? null,
          finalActiveMinutes,
          finalSteps,
        ]
      );
    }

    // Body metrics: weight & height
    const weightKg = weightRes.ok ? extractWeightKg(weightRes.sample) : null;
    const heightFromGoogle = heightRes.ok ? extractHeightCm(heightRes.sample) : null;

    if (heightFromGoogle !== null) {
      await client.query(
        `UPDATE users
         SET height_cm = COALESCE(height_cm, $1)
         WHERE id = $2`,
        [heightFromGoogle, userId]
      );
    }

    const userResult = await client.query('SELECT height_cm FROM users WHERE id = $1', [userId]);
    const finalHeightCm = userResult.rows[0]?.height_cm
      ? Number(userResult.rows[0].height_cm)
      : heightFromGoogle;

    const todayExisting = existingByDate.get(today) ?? null;
    const finalWeightKg = weightKg ?? (todayExisting?.weight_kg ? Number(todayExisting.weight_kg) : null);

    let finalBmi = todayExisting?.bmi ? Number(todayExisting.bmi) : null;
    if (finalWeightKg && finalHeightCm) {
      const heightM = finalHeightCm / 100;
      finalBmi = parseFloat((finalWeightKg / (heightM * heightM)).toFixed(1));
    }

    if (finalWeightKg !== null || finalBmi !== null) {
      await client.query(
        `INSERT INTO daily_measurements
         (user_id, date, weight_kg, bmi, mvpa_minutes, steps)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, date)
         DO UPDATE SET
           weight_kg    = COALESCE(EXCLUDED.weight_kg, daily_measurements.weight_kg),
           bmi          = COALESCE(EXCLUDED.bmi, daily_measurements.bmi)`,
        [
          userId,
          today,
          finalWeightKg,
          finalBmi,
          Number(existingByDate.get(today)?.mvpa_minutes ?? 0),
          Number(existingByDate.get(today)?.steps ?? 0),
        ]
      );
    }

    res.json({
      success: true,
      data: {
        date: today,
        weekStart,
        datesSynced: weekDates,
        steps: weeklySteps,
        activeMinutes: weeklyActiveMinutes,
        caloriesBurned: 0,
        weightKg: finalWeightKg,
        heightCm: finalHeightCm,
        bmi: finalBmi,
        grantedScopes: granted,
        warnings,
        sources: {
          weight: weightKg !== null ? 'google_health' : (finalWeightKg !== null ? 'manual' : null),
          activity: granted.activity ? 'google_health_with_manual_fallback' : 'manual',
          bmi: finalBmi !== null ? 'calculated' : 'unavailable',
        },
      },
    });
  } catch (err) {
    console.error('Google Health sync error:', err);
    res.status(500).json({ success: false, message: err.message || 'Google Health sync failed' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /api/google-health/timeseries
// Visual-only time series for steps, active minutes, and active zone minutes.
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
        data: { metric, period, start, end, points, total, average },
      });
    }

    await ensureGoogleHealthTokensTable();

    const tokenResult = await client.query(
      `SELECT google_user_id, access_token, refresh_token, scope, expires_at
       FROM google_health_tokens
       WHERE user_id = $1`,
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.json({
        success: true,
        available: false,
        message: 'Google Health is not connected.',
      });
    }

    const tokenRow = tokenResult.rows[0];
    const granted = parseGrantedScopes(tokenRow.scope);
    if (!granted.activity) {
      return res.json({
        success: true,
        available: false,
        message: 'Activity permission was not granted for Google Health.',
      });
    }

    const accessToken = await getValidAccessToken(tokenRow, client);
    const azmRes = await fetchDailyRollUp(accessToken, 'active-zone-minutes', start, end);

    if (!azmRes.ok) {
      return res.json({
        success: true,
        available: false,
        message: azmRes.error || 'Active Zone Minutes are not available for this Google Health connection.',
      });
    }

    const azmByDate = parseAzmByDate(azmRes.points);
    const points = dates.map((date) => {
      const entry = azmByDate.get(date) || { value: 0, fatBurn: 0, cardio: 0, peak: 0 };
      return { date, ...entry };
    });

    const total = points.reduce((sum, point) => sum + point.value, 0);
    const divisor = getElapsedDateCount(dates);
    const average = divisor ? total / divisor : 0;

    res.json({
      success: true,
      available: true,
      data: { metric, period, start, end, points, total, average },
    });
  } catch (err) {
    console.error('Google Health timeseries error:', err);
    res.status(500).json({ success: false, message: 'Failed to load Google Health time series' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// DELETE /api/google-health/disconnect
// Revokes token (best effort) and removes the stored Google Health link.
// ─────────────────────────────────────────
router.delete('/disconnect', authenticate, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await ensureGoogleHealthTokensTable();

    const result = await client.query(
      `DELETE FROM google_health_tokens
       WHERE user_id = $1
       RETURNING access_token, refresh_token`,
      [userId]
    );

    const removed = result.rows[0];
    if (removed) {
      const oauth2Client = createOAuthClient();
      const tokenToRevoke = removed.refresh_token || removed.access_token;
      if (oauth2Client && tokenToRevoke) {
        try {
          await oauth2Client.revokeToken(tokenToRevoke);
        } catch {
          // Best-effort revocation; local disconnect still succeeds.
        }
      }
    }

    res.json({
      success: true,
      disconnected: result.rowCount > 0,
      message: result.rowCount > 0 ? 'Google Health disconnected' : 'No Google Health connection found',
    });
  } catch (err) {
    console.error('Google Health disconnect error:', err);
    res.status(500).json({ success: false, message: 'Failed to disconnect Google Health' });
  } finally {
    client.release();
  }
});

export default router;
