# HealthScore Tracker

Monorepo for the HealthScore Tracker application.

## Structure

- `backend/` - Express API, Postgres integration, OAuth, Fitbit sync, scoring logic
- `frontend/` - React + Vite web app
- `backend/sql/` - SQL needed for database setup and migrations

## Local development

Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Start the backend:

```bash
npm run dev:backend
```

Start the frontend:

```bash
npm run dev:frontend
```

Frontend default URL: `http://localhost:5173`

Backend default URL: `http://localhost:3001`

## Environment setup

Use these templates:

- `backend/.env.example`
- `frontend/.env.example`

For deployment, do not commit real `.env` files. Supply environment variables through your hosting platform.

## Database

The backend supports either:

- `DATABASE_URL`
- or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

For Supabase/Postgres, `DATABASE_URL` is the simplest option.

Run any required SQL from `backend/sql/` in Supabase SQL Editor before deployment.

## Build

Build the frontend:

```bash
npm run build:frontend
```

Start backend in production mode:

```bash
npm run start:backend
```

## Deployment notes

- Set `FRONTEND_URL` in backend env to your deployed frontend URL.
- Set `VITE_API_URL` in frontend env to your deployed backend URL.
- Update Google/Fitbit OAuth redirect URIs to match deployed URLs.
- The backend now uses env-based DB config; no secrets are hardcoded in source.
