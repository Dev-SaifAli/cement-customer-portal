# AlSafwa Cement Customer Portal

Production-oriented foundation for a B2B customer and internal sales portal. This milestone contains infrastructure and reusable UI primitives only; no commerce, logistics, finance, notification, AI, or Oracle Fusion modules are implemented.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Setup

1. Copy `.env.example` to `.env` and replace all `change-me` / `replace-with` values locally. Never commit `.env`.
2. Create an empty PostgreSQL database named `cement_portal` (or change `DATABASE_URL`).
3. Install dependencies with `npm install` from the repository root.
4. Apply infrastructure migrations with `npm run migrate:up`.
5. Start both applications with `npm run dev`.

Frontend: `http://localhost:5173`  
API: `http://localhost:3000/api/v1`  
Health: `http://localhost:3000/api/v1/health`

Run a single application with `npm run dev -w frontend` or `npm run dev -w backend`.

## Authentication UI and CAPTCHA

The Customer Portal authentication screens use a simple server-side security challenge for now. The browser requests a challenge from the backend, displays the prompt, and submits the challenge id plus the user's answer with login or forgot-password requests. The answer is verified on the server only.

Configured endpoints:

- `GET /api/v1/auth/captcha`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`

Login and forgot-password require `captchaChallengeId` and `captchaAnswer`. Challenges expire after `CAPTCHA_TTL_MS`, are one-time use, and store only salted answer hashes server-side. Login currently verifies CAPTCHA and request shape, then returns `AUTH_NOT_CONFIGURED` until the real credential/user store is implemented. Forgot password returns the required generic response after CAPTCHA verification and does not reveal whether an email exists.

The CAPTCHA logic sits behind a provider interface in `backend/src/modules/auth/captcha.service.ts`, so Cloudflare Turnstile can later replace the server challenge without changing the auth controller contract.

## Login Carousel Images

Place approved AlSafwa Cement images in `frontend/src/assets/login/`.

Supported formats are `.webp`, `.avif`, `.png`, `.jpg`, and `.jpeg`. The carousel imports that folder automatically and sorts images by filename, so use names such as `01-plant.webp`, `02-delivery.webp`, and `03-project.webp`. No component changes are needed when images are added, removed, or replaced.

## Environment variables

| Variable                  | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`        | Backend runtime mode and port                                              |
| `APP_URL`                 | Allowed browser origin for CORS                                            |
| `API_URL`, `VITE_API_URL` | Server and browser API base URLs                                           |
| `DATABASE_URL`            | Preferred PostgreSQL connection URI                                        |
| `PG_*`                    | Individual connection settings when no URI is supplied                     |
| `JWT_*`, `SESSION_*`      | Reserved authentication configuration; secrets are required in production  |
| `CAPTCHA_TTL_MS`          | Server-generated CAPTCHA expiry window in milliseconds                     |
| `AUTH_*_RATE_LIMIT_*`     | Rate limit window and attempt caps for authentication endpoints            |
| `FILE_STORAGE_*`          | Local/S3-compatible storage configuration reserved for later file features |

Only `VITE_*` values are exposed to browser code. See `.env.example` for the complete list.

## Commands

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Run frontend and backend in watch mode  |
| `npm run build`        | Type-check and create production builds |
| `npm test`             | Run backend and frontend unit tests     |
| `npm run lint`         | Run ESLint across the workspace         |
| `npm run format:check` | Check Prettier formatting               |
| `npm run migrate:up`   | Apply pending PostgreSQL migrations     |
| `npm run migrate:down` | Roll back the most recent migration     |

Migration commands read `DATABASE_URL`. The first migration creates only the `pgcrypto` infrastructure extension and migration bookkeeping; domain schema is intentionally deferred.

## Architecture

```text
cement-customer-portal/
├── backend/                 Express API
│   └── src/
│       ├── config/          validated environment and logging
│       ├── database/        PostgreSQL pool / database layer
│       ├── errors/          typed application errors
│       ├── middleware/      HTTP concerns and error boundary
│       ├── modules/         route → controller → service feature slices
│       └── routes/          versioned API composition
├── database/                node-pg-migrate configuration and migrations
├── frontend/                React + Vite application
│   └── src/
│       ├── components/ui/   reusable UI primitives
│       ├── styles/          semantic design tokens and global styles
│       └── test/            browser test setup
├── .env.example
└── root quality/tooling configuration
```

HTTP handlers remain thin: routes map endpoints, controllers translate HTTP concerns, services own application behavior, and database modules own persistence. Errors flow to one JSON error middleware. New APIs belong below `/api/v1`.

## Design system status

The linked Figma file remains the visual source of truth. Figma's Starter-plan MCP limit prevented token extraction during this milestone, so `frontend/src/styles/tokens.css` contains isolated, explicitly provisional semantic values. Confirm exact colors, typography, radii, shadows, and spacing from a node-specific Figma link or restored MCP access before visual sign-off.
