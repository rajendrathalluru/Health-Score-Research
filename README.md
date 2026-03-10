# HealthScore Tracker

HealthScore Tracker is a survivorship-focused web application for cancer survivors to review weekly health habits using a structured WCRF/AICR-style score model.

The app combines:
- weekly questionnaire-based scoring
- Fitbit or manual activity tracking
- body metrics tracking
- progress history
- profile-based survivorship context

## Product Overview

The current app flow is:

1. Welcome page
2. Account creation or login
3. Weekly questionnaire completion
4. Activity tracking
   - Fitbit sync
   - or manual daily activity logging
5. Body metrics logging
   - weight
   - waist circumference
   - height stored in profile
6. Dashboard and progress review

## Active Scoring Model

The current weekly score is out of `7`.

It includes:

1. Healthy weight
   - BMI
   - waist circumference
2. Physical activity
3. Plant-based foods
4. Fast / processed foods
5. Red / processed meat
6. Sugary drinks
7. Alcohol

Diet scoring is questionnaire-based, not food-entry based.

## Current Pages

- `/` - welcome page
- `/login` - email/password login + Google OAuth
- `/register` - email/password signup + Google OAuth
- `/dashboard` - weekly overview
- `/health-log` - weekly questionnaire
- `/activity` - Fitbit + manual activity logging
- `/body-metrics` - weight and waist tracking
- `/progress` - score, activity, and body metric trends
- `/profile` - personal and survivorship profile details

## Tech Stack

### Frontend

- React 19
- Vite
- TypeScript
- Tailwind CSS
- React Router
- Recharts

### Backend

- Express
- PostgreSQL / Supabase Postgres
- JWT auth
- Google OAuth
- Fitbit OAuth

## Repo Structure

- `frontend/` - React app
- `backend/` - Express API
- `backend/sql/` - SQL for required database objects

## Local Development

From repo root:

Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Run backend:

```bash
npm run dev:backend
```

Run frontend in a second terminal:

```bash
npm run dev:frontend
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Environment Variables

Use:

- [`backend/.env.example`](/Users/rajendrathalluru/Documents/healthscore-tracker/backend/.env.example)
- [`frontend/.env.example`](/Users/rajendrathalluru/Documents/healthscore-tracker/frontend/.env.example)

Important backend envs include:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `FITBIT_REDIRECT_URI`

Important frontend envs include:

- `VITE_API_URL`

## Database

The backend supports either:

- `DATABASE_URL`
- or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

For Supabase Postgres, `DATABASE_URL` is the preferred option.

### Required Active Tables

The current app relies on these main tables:

- `users`
- `daily_measurements`
- `weekly_questionnaire_scores`
- `fitbit_tokens`

### Required SQL

Run SQL from:

- [`backend/sql/weekly_questionnaire_scores.sql`](/Users/rajendrathalluru/Documents/healthscore-tracker/backend/sql/weekly_questionnaire_scores.sql)

in Supabase SQL Editor if that table does not already exist.

## API Summary

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/me`

### Profile

- `GET /api/profile`
- `PUT /api/profile`

### Weekly Score / Questionnaire

- `POST /api/weekly-score`
- `GET /api/weekly-score?weekStart=YYYY-MM-DD`
- `GET /api/weekly-score/history?limit=26`

### Measurements / Activity

- `POST /api/measurements/log`
- `POST /api/measurements/activity`
- `GET /api/measurements/activity?weekStart=YYYY-MM-DD`
- `GET /api/measurements/:date`

### Fitbit

- `GET /api/fitbit/auth-url`
- `GET /api/fitbit/callback`
- `GET /api/fitbit/status`
- `POST /api/fitbit/sync`
- `DELETE /api/fitbit/disconnect`

### Progress

- `GET /api/progress/scores?days=90`
- `GET /api/progress/body-metrics?days=90`
- `GET /api/progress/activity?days=30`

## Important Current Behavior

### Registration

- Email/password signup does not auto-login.
- After signup, the app redirects to login.

### Google OAuth

- Google OAuth signs the user in immediately after callback.

### Fitbit

- Fitbit is linked to the authenticated app user.
- The app now prevents the same Fitbit account from being silently reassigned across different HealthScore users.
- Fitbit sync stores current-week activity per day into `daily_measurements`.

### Measurements

- Height is profile data.
- Weight and waist are tracked separately as body metrics.
- Weekly score uses current-week measurements first and can derive BMI from profile height + saved weight.

## Removed Legacy Surface

The old food logging / daily food-entry scoring flow is no longer part of the active product.

Removed:

- frontend food logging page
- legacy `/api/food` route
- legacy `/api/score` route

Still present but legacy:

- `backend/src/routes/dailyLogs.js`

That route is not part of the current questionnaire-first product flow.

## Build

Build frontend:

```bash
npm run build:frontend
```

Run backend in production:

```bash
npm run start:backend
```

## Deployment Notes

- Set `FRONTEND_URL` in backend env to your deployed frontend URL
- Set `VITE_API_URL` in frontend env to your deployed backend URL
- Update Google OAuth redirect URIs for deployed domains
- Update Fitbit OAuth redirect URIs for deployed domains
- Do not commit real `.env` files

## Current Cleanup Notes

The current product has already been aligned away from the old food-entry score system. The main active flows are now:

- welcome
- auth
- weekly questionnaire
- activity
- body metrics
- dashboard
- progress
- profile
