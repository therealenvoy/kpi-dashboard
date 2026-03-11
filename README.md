# KPI Dashboard

Instagram Reels analytics dashboard backed by Google Sheets. The repo is split into:

- `server/` for the Express API and production static hosting
- `client/` for the React, Vite, Tailwind, and Recharts dashboard

## Local development

1. Install root dependencies with `npm install`
2. Install client dependencies with `cd client && npm install`
3. Start both apps with `npm run dev`

The Vite dev server proxies `/api` requests to `http://localhost:3000`.

## Production

- Build the client with `npm run build`
- Start the app with `npm start`
- In production, Express serves `client/dist`

## Required environment variables

- `GOOGLE_API_KEY`
- `SPREADSHEET_ID`
- `DATABASE_URL` optional for Postgres-backed monetization storage
- `ONLYFANS_API_KEY` for OnlyFans daily sync
- `ONLYFANS_ACCOUNT_ID` optional if the API key has more than one connected account
- `ADMIN_VIEW_CODE` optional unlock code for admin money view
- `CORS_ORIGINS` comma-separated allowlist for production browser origins
- `PORT`

Use `.env.example` as the template. The real `.env` is gitignored.

In production, the server now fails fast on startup if `GOOGLE_API_KEY`, `SPREADSHEET_ID`, `ADMIN_VIEW_CODE`, or `CORS_ORIGINS` are missing. If `DATABASE_URL` is absent, monetization falls back to file storage.

## Monetization MVP

The repo now includes a first-pass monetization layer:

- `POST /api/monetization/sync` to sync daily OnlyFans metrics into Postgres
- `GET /api/monetization/status` for setup and sync status
- `GET /api/monetization/daily` for daily visits, subs, and earnings
- `GET /api/monetization/day/:date` for a single-day drill-down with likely reel drivers

The SQL schema is in `server/sql/001_monetization.sql`.
