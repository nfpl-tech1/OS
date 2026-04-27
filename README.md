# OS Deployment/Env Configuration

The OS codebase now uses environment variables for runtime URLs and network settings, with localhost-safe defaults for development.

## Frontend (`apps/os-frontend`)

1. Copy `.env.example` to `.env.local` (or `.env`).
2. Set:
   - `OS_BACKEND_URL` (default local: `http://localhost:3001`)
   - Optional `NEXT_PUBLIC_OS_BACKEND_URL` fallback (same value as `OS_BACKEND_URL`)

`next.config.ts` uses `OS_BACKEND_URL` for `/api/*` rewrites.

## Backend (`apps/os-backend`)

1. Copy `.env.example` to `.env`.
2. Configure:
   - Runtime: `PORT`, `HOST`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`
   - Database: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - Auth/SSO: `OS_SESSION_SECRET`, `OS_SESSION_EXPIRES_IN`, `INTERNAL_API_KEY`, `WEBHOOK_SECRET`, `OS_JWT_PRIVATE_KEY`, `OS_JWT_PUBLIC_KEY`

The backend now reads CORS/listen settings from env while preserving localhost defaults for local development.

## Seed/Data Scripts

The backend seed script now supports env overrides for app URLs and admin credentials:

- `APP_SUPERFREIGHT_*`, `APP_TEZ_*`, `APP_TRAININGS_*`, `APP_SHAKTI_*`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`
- `SYNC_TRAININGS_URL`, `SYNC_OS_DASHBOARD_URL` for `sync_ips.js`

If these are not set, local defaults are used.
