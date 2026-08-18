# Deployment Guide

Recommended production setup:

- Frontend: Vercel
- Backend API: Render
- Database: Neon PostgreSQL

Do not commit real `.env` values. Add production secrets directly in the hosting dashboards.

## 1. Pre-deployment checks

From the repository root:

```powershell
npm install
npm run test
npm run build
npm run lint
npm run format:check
```

## 2. Database: Neon PostgreSQL

Use your Neon pooled PostgreSQL connection string as `DATABASE_URL`.

Before deploying the backend, run migrations against the production database:

```powershell
$env:DATABASE_URL="your-neon-production-connection-string"
npm run migrate:up
```

Use `sslmode=verify-full` for Neon if available.

## 3. Backend: Render

Create a new Render Web Service from the GitHub repository.

Use these settings:

- Root directory: repository root
- Build command: `npm ci && npm run build -w backend`
- Start command: `npm run start -w backend`
- Health check path: `/api/v1/health`
- Node version: 20 or newer

Set these Render environment variables:

```text
NODE_ENV=production
APP_URL=https://your-frontend-domain.vercel.app
API_URL=https://your-render-backend-domain.onrender.com/api/v1
DATABASE_URL=your-neon-production-connection-string
JWT_SECRET=generate-a-long-random-secret
SESSION_SECRET=generate-a-different-long-random-secret
CAPTCHA_TTL_MS=120000
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_LOGIN_RATE_LIMIT_MAX=10
AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX=5
FILE_STORAGE_DRIVER=local
```

Render provides `PORT` automatically. Do not hardcode it unless your Render service explicitly requires a custom port.

After deployment, verify:

```text
https://your-render-backend-domain.onrender.com/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "message": "API is running"
}
```

## 4. Frontend: Vercel

Create a new Vercel project from the same GitHub repository.

Use these settings:

- Root directory: repository root
- Build command: `npm run build -w frontend`
- Output directory: `frontend/dist`
- Install command: `npm ci`

Set this Vercel environment variable:

```text
VITE_API_URL=https://your-render-backend-domain.onrender.com/api/v1
```

`vercel.json` is included so React Router routes such as `/login`, `/register`, and `/register/review` work on refresh.

## 5. Production verification

After both deployments are live:

1. Open the frontend Vercel URL.
2. Go to `/login`.
3. Click `Register your organization`.
4. Complete the registration flow.
5. Click `Save Draft` and confirm the backend receives the registration draft.
6. Click `Submit Application`.
7. Confirm `/register/submitted` shows the application reference.

## 6. Common deployment issues

### CORS error

Set backend `APP_URL` exactly to the deployed frontend origin, for example:

```text
APP_URL=https://cement-customer-portal.vercel.app
```

Do not include a trailing slash.

### Frontend says unable to connect

Check Vercel `VITE_API_URL`. It must include `/api/v1`.

### Backend fails to start in production

Production requires:

- `JWT_SECRET`
- `SESSION_SECRET`
- `DATABASE_URL`

### Registration submit fails

Run migrations against the same Neon database used by the deployed backend.
