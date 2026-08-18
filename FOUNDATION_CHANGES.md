# Foundation implementation report

## What changed

- Created npm workspaces separating `frontend`, `backend`, and `database`.
- Added Express 5 with `/api/v1`, security headers, CORS, JSON limits, structured request logging, centralized errors, 404 handling, and graceful shutdown.
- Added the exact `GET /api/v1/health` response through route → controller → service layers.
- Added validated centralized environment configuration and a PostgreSQL connection pool.
- Added `node-pg-migrate` with one reversible infrastructure-only migration; no domain schema or fake production data was created.
- Added React + Vite + TypeScript and reusable Button, Input, Select, Modal, Table, Badge, Card, File Upload, Form Field, Alert, and Loading State components.
- Added semantic CSS tokens for colors, typography, radii, shadows, spacing, forms, buttons, badges, cards, and tables.
- Added ESLint, Prettier, strict TypeScript, unit-test foundations, `.gitignore`, and `.env.example`.
- Added setup, environment, migration, testing, and architecture documentation.

## Registration and onboarding updates

- Integrated the approved registration/onboarding flow into the existing React Router structure.
- Added customer registration routes for start, company, contact, documents, delivery locations, customer admin, review, submitted, and status screens.
- Preserved the existing UI direction and Tailwind-based screen styling instead of replacing the design with a generic dashboard.
- Added Tailwind CSS compilation for the frontend so existing utility classes render correctly.
- Removed ambiguous `Exit` buttons from registration headers while keeping AlSafwa branding and registration titles.
- Added guided Saudi mobile inputs for registration phone fields:
  - fixed `+966` prefix
  - local mobile entry format `5XX XXX XXX`
  - maximum 9 local digits
  - validation for Saudi mobile numbers beginning with `5`
  - normalized backend value format `+9665XXXXXXXX`
- Added validation alignment for:
  - CR number: exactly 10 digits
  - VAT number: exactly 15 digits
  - postal code: exactly 5 digits
  - email format for contact/admin emails
  - password minimum length and confirmation match
  - document file metadata and future expiry date
- Fixed document validation mismatch where the UI could show a document as valid while navigation stayed blocked.
- Added non-disruptive autosave status UI:
  - `Saving...`
  - `Saved just now ✓`
  - `Unable to save changes. Retry.`

## Registration draft persistence

- Added a PostgreSQL-backed `registration_drafts` table via migration `000002_create_registration_drafts.cjs`.
- Added backend registration draft API using the existing Express module pattern:
  - route
  - controller
  - service
  - validation
  - PostgreSQL pool/database layer
- Added frontend registration service layer so React does not query PostgreSQL directly.
- Added backend validation for draft updates and final submission.
- Added bcryptjs password hashing before storing customer administrator passwords.
- Passwords and password hashes are not returned to the frontend.
- Document draft persistence stores file metadata only, not file contents.
- Added frontend registration draft lifecycle:
  - create draft on registration start/load
  - keep a stable registration draft id
  - store only draft id in `localStorage`
  - load existing draft on refresh
  - debounce autosave instead of saving every keystroke
  - wire visible `Save Draft` buttons to the same backend draft-save service
  - avoid replacing an existing draft id on temporary API/load failure
  - resume from the saved current step when starting an existing draft
  - persist current step
  - submit through backend
- Final registration submission now asks the backend to generate and store a unique human-readable application reference.
- Removed fake fallback application references from submitted/status screens so the UI relies on backend-generated references.
- Fixed application status validation to accept the backend-generated `APP-YYYY-000000` reference format.
- Strengthened final backend registration submission validation and made repeated submit calls preserve the existing submitted draft/reference instead of creating duplicate submission details.
- Added structured validation error responses with top-level `message` and `errors` fields.

### Registration draft lifecycle reliability fix

- Fixed the root cause of the registration footer errors: failed initialization previously marked
  the provider as hydrated while leaving the draft id empty, and Continue navigated without waiting
  for persistence.
- Draft initialization is now a single shared request, including under React Strict Mode, so repeated
  clicks and effect re-runs do not create duplicate drafts.
- Start Registration shows `Preparing registration...` until the initial create/load request settles.
- Every registration Continue action now waits for a successful draft save before navigating.
- Autosave, manual Save Draft, Continue, and submission now share a serialized save operation. Newer
  changes are persisted after an in-flight save instead of allowing responses to finish out of order.
- A failed save now returns failure to its caller; submission and Continue no longer proceed after a
  persistence failure.
- Stale local draft ids are cleared only after the API confirms `404` or an invalid id, after which one
  replacement draft is created. Temporary connectivity failures preserve the stored id.
- Replaced generic frontend/server errors with safe messages for draft creation, connectivity, save,
  validation, and unavailable registration service cases.
- Registration API failures now return structured `400`, `404`, or `503` JSON without SQL details,
  database credentials, or stack traces.
- Added backend and frontend tests for invalid/stale ids, unavailable persistence, safe error messages,
  single draft creation, and repeated Start/Continue clicks.

## Application submitted and status flow

- Improved the Application Submitted screen with:
  - application reference
  - pending sales review status
  - review message
  - `View Application Status`
  - `Back to Login`
- Added Application Status page.
- Updated Login page so `Check Application Status` navigates to the status lookup page.
- Added frontend application service layer for status lookup.
- Added backend application status API that verifies both application reference and registered email before returning status.
- Status responses expose only customer-safe fields:
  - reference
  - status
  - status label
  - submitted timestamp
  - customer-safe timeline

## API endpoints added

- `POST /api/v1/registrations`
- `GET /api/v1/registrations/:id`
- `PATCH /api/v1/registrations/:id`
- `POST /api/v1/registrations/:id/submit`
- `POST /api/v1/applications/status`
- `GET /api/v1/applications/:reference/status?email=...`

## Database changes

- Added `registration_drafts` table with:
  - stable UUID id
  - unique application reference
  - status
  - current step
  - company/contact/document metadata/location/admin JSONB sections
  - bcrypt password hash column
  - submitted/created/updated timestamps
- Updated database migration scripts so they load the root `.env` file before running `node-pg-migrate`.
- Added a clearer migration error message when `DATABASE_URL` is missing.
- No fake production data was added.

## Validation and security notes

- Frontend validation gives quick inline feedback.
- Backend validation remains authoritative.
- PostgreSQL access remains backend-only.
- Backend uses parameterized queries.
- Passwords are hashed with bcryptjs before storage.
- Passwords and password hashes are never returned to React.
- Application status lookup requires both reference and registered email.

## Verification performed

- `npm run build -w backend`
- `npm run build -w frontend`
- `npm test -w backend`
- `npm test -w frontend`
- `npm run lint`
- `npm run format:check`

## Explicitly not implemented

Oracle Fusion, quotations, sales orders, deliveries, invoices, payments, GPS, notifications, AI, full authentication/session login, final file-storage upload pipeline, internal sales review workflows, and production data.

## Confirmation required

1. Provide a node-specific Figma URL (a screen/component rather than `node-id=0:1`) or restore Figma MCP capacity so provisional tokens can be replaced with approved values.
2. Confirm whether deployment requires direct PostgreSQL TLS (`PG_SSL=true`) and the intended certificate policy.
3. Confirm the future file-storage provider (`local` or S3-compatible) before file features are built.
4. Confirm JWT versus server-side sessions when authentication work begins; both configuration placeholders exist, but neither mechanism is implemented.
