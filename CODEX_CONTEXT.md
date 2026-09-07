# CODEX Context — AlSafwa Cement Customer Portal

This file is a handoff document for another developer or AI coding agent. It summarizes the current architecture, implemented functionality, technical decisions, known constraints, and remaining roadmap so future work can continue without relying on prior chat history.

## 1. Project Overview

### Project name

AlSafwa Cement Customer Portal

### Purpose

The application is a B2B portal for AlSafwa Cement that connects customer self-service, Sales review, pricing administration, Hader delivery operations, and portal administration in one web application.

It supports the lifecycle from customer registration and onboarding through quotations, contracts, direct/contract orders, logistics execution, proof of delivery, ship-to variance approval, user administration, notifications, and the interim Customer Ticket / Service Request workflow.

### Business problem solved

The system replaces fragmented manual communication between customers, Sales, pricing, logistics, and administration teams with a controlled portal workflow:

- Customers can register, maintain account data, request quotations, place orders, manage locations/fleet, track shipments, and raise service requests.
- Sales can review customer applications, quotations, contracts, orders, shipments, and service requests.
- Pricing/Admin users can manage products, product pricing, delivery pricing, tax configuration, and user/role administration areas.
- Hader Manager can coordinate delivery requests, shipment preparation, loading, dispatch, delivery team progress, POD, and ship-to variance handling.
- Commercial Director can approve/reject ship-to variance extra charge requests.
- Portal Administrator owns user management, roles/permissions viewing, and global notification administration where implemented.

### Main user groups

#### Customer Portal

Customer-side roles:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`
- `VIEWER`

The Customer Portal is accessed through the customer login/session architecture and is tenant-scoped by customer account.

#### Sales Portal

Internal Sales/authenticated roles include:

- `SALES_REP`
- `PRICE_MANAGER`
- `COMMERCIAL_DIRECTOR`
- `PRICING_ADMIN`
- `HADER_MANAGER`
- `PORTAL_ADMINISTRATOR`

The codebase also contains additional Hader/logistics-oriented role literals in `sales-auth.types.ts`:

- `HADER_OPERATIONS`
- `DISPATCH_USER`
- `LOADING_USER`
- `DELIVERY_TEAM_USER`

Do not assume these extra roles should be exposed in UI or newly seeded unless a task explicitly requires it.

#### Internal/Admin users

Internal users authenticate through the existing Sales authentication system. Portal Administrator is not a separate user table; it is a role in the existing internal `sales_users` architecture.

### Current development stage

Functionally complete and integration-ready for the implemented portal workflows.

Important pending integration/commercial areas remain:

- VAS Cloud Logistics real API integration
- Oracle Fusion / ERP integration
- Financial posting of approved Ship-to Variance charges
- Invoice / receivables / statements, dependent on ERP
- Full CRM API integration
- CRM Excel/CSV response import/export workflow
- WhatsApp provider integration
- Full Reports & Analytics
- System Parameters
- Complete enterprise audit/activity log UI if not already implemented everywhere

---

## 2. Technology Stack

### Frontend

- Framework: React
- Language: TypeScript
- Build tool: Vite
- Routing: React Router
- Styling: Tailwind CSS plus global CSS/theme tokens
- Icons: `lucide-react`
- Maps: Leaflet / React Leaflet
- Searchable dropdowns: Tom Select
- New Ticket UI foundation: actual shadcn/ui-style project-owned components under `frontend/src/components/ui/`
- shadcn/Radix dependencies currently present:
  - `@radix-ui/react-checkbox`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-label`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-slot`
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
- Data table reference implementation: Customer/Sales Tickets using TanStack Table + shadcn table primitives
- Documentation generation: custom documentation generator under `documentation/user-guide/`

### Backend

- Framework: Express
- Language: TypeScript
- Runtime: Node.js 20+
- API style: Versioned REST under `/api/v1`
- Validation: Zod
- Database driver: `pg`
- Password hashing: `bcryptjs`
- Logging: Pino / Pino HTTP
- Security middleware: Helmet, CORS, Express rate limit
- Email: Nodemailer through existing email service
- Error handling: central JSON error middleware using `AppError` and Zod error mapping

### Database

- Database: PostgreSQL
- Migration system: node-pg-migrate-style `.cjs` migrations in `database/migrations/`
- Primary tenant/account model:
  - Customer data is scoped by `customer_account_id`
  - Customer users belong to a customer account
  - Internal users are held in the existing Sales/internal user system
- Important migration files near current state:
  - `000047_create_shipment_pods.cjs`
  - `000048_create_ship_to_variance_approvals.cjs`
  - `000049_add_portal_administrator_role.cjs`
  - `000050_create_global_notification_management.cjs`
  - `000051_create_vas_outbox.cjs`
  - `000052_create_customer_tickets.cjs`
  - `000053_update_customer_ticket_status_lifecycle.cjs`

### Deployment

Documented recommended production setup:

- Frontend: Vercel
- Backend API: Render
- Database: Neon PostgreSQL

The user has also referenced a live frontend/base access URL:

```text
http://20.46.44.59/
```

Runtime/deployment concerns:

- PM2 and Nginx may be used in the user’s hosted environment.
- Environment variables live in `.env` locally and hosting dashboards in production.
- Do not commit real secrets.
- Important environment variables include:
  - `NODE_ENV`
  - `PORT`
  - `APP_URL`
  - `API_URL`
  - `VITE_API_URL`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `SESSION_SECRET`
  - CORS/auth rate limit variables
  - SMTP/email variables
  - Ticket notification variables such as `SALES_TEAM_EMAIL`
  - Future integration toggles such as CRM/WhatsApp enablement flags

---

## 3. Application Architecture

### Frontend architecture

The frontend is organized under `frontend/src/`:

- `App.tsx` and route definitions compose the portal routes.
- `pages/` contains portal/page-level screens.
- `components/` contains shared UI and shell components.
- `components/ui/` contains the newer shadcn/ui-compatible primitives.
- `services/` contains frontend API clients.
- `context/` contains auth/session/theme-like application context.
- `styles/` contains global theme and design token CSS.
- `lib/` and `utils/` contain shared helpers.

The shared AppShell foundation is used across portals. It provides:

- Sidebar container
- Portal-specific navigation
- Minimal top-right global controls
- Notification/profile controls
- Logout/profile menu behavior
- Responsive sidebar/mobile drawer behavior
- Active route styling

Important AppShell decision:

- Do not create a duplicate shell.
- Do not change role-specific navigation unless explicitly requested.
- Keep route guards and backend authorization authoritative.

### Backend architecture

The backend is organized under `backend/src/`:

- `server.ts` starts the HTTP server.
- `app.ts` configures Express, middleware, CORS, routes, and error handling.
- `routes/v1.ts` mounts all versioned API modules under `/api/v1`.
- `modules/` contains feature slices.
- Each module usually follows:
  - `*.routes.ts`
  - `*.controller.ts`
  - `*.service.ts`
  - `*.validation.ts`
  - optional tests/templates/helpers
- `middleware/` contains shared Express middleware.
- `errors/app-error.ts` defines typed application errors.
- `database/pool.ts` owns PostgreSQL connectivity.

Core backend pattern:

```text
Route
→ Controller
→ Validation
→ Service
→ Database
→ JSON response
```

Errors flow through the central error handler and return a consistent JSON envelope.

### API routing

Top-level route file:

```text
backend/src/routes/v1.ts
```

Major API mounts:

- `/api/v1/customer/auth`
- `/api/v1/customer/profile`
- `/api/v1/customer/products`
- `/api/v1/customer/quotations`
- `/api/v1/customer/contracts`
- `/api/v1/customer/orders`
- `/api/v1/customer/shipments`
- `/api/v1/customer/tickets`
- `/api/v1/customer/users`
- `/api/v1/customer/locations`
- `/api/v1/sales/auth`
- `/api/v1/sales/applications`
- `/api/v1/sales/quotations`
- `/api/v1/sales/contracts`
- `/api/v1/sales/orders`
- `/api/v1/sales/shipments`
- `/api/v1/sales/tickets`
- `/api/v1/hader/*`
- `/api/v1/admin/*`
- `/api/v1/portal-admin/notifications`
- `/api/v1/notifications`
- `/api/v1/price-manager/ship-to-variances`
- `/api/v1/commercial-director/ship-to-variance-charges`
- `/api/v1/health`

---

## 4. Authentication and Authorization

### Customer authentication

Customer authentication uses:

- `requireCustomerAuth`
- Customer JWT token verification
- Bearer token or `customer_session` cookie
- Authenticated request property: `request.customerUser`

Customer role guard:

```ts
requireCustomerRole(...roles)
```

Current customer roles:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`
- `VIEWER`

Customer tenant isolation rule:

- The backend must derive `customer_account_id` from the authenticated customer session.
- Never trust `customer_account_id` or `customer_user_id` from frontend requests.

### Sales/internal authentication

Sales/internal authentication uses:

- `requireSalesAuth`
- Sales JWT token verification
- Bearer token or `sales_session` cookie
- Authenticated request property: `request.salesUser`

Sales role guard:

```ts
requireSalesRole(...roles)
```

Primary internal roles currently used in portal work:

- `SALES_REP`
- `PRICE_MANAGER`
- `COMMERCIAL_DIRECTOR`
- `PRICING_ADMIN`
- `HADER_MANAGER`
- `PORTAL_ADMINISTRATOR`

### Login routes

Frontend login entry points implemented/discussed:

- Customer users: Customer login route in the Customer Portal
- Sales/internal users: `/sales/login`
- Portal Administrator dedicated entry point: `/admin/login`

Important decision:

- `/admin/login` reuses the existing Sales/internal authentication infrastructure.
- It does not create a second user table, auth system, or password hashing mechanism.

---

## 5. Implemented Portal Areas

### Customer Registration and Onboarding

Implemented/covered areas include:

- Customer registration flow
- Company information
- Contact details
- Documents where applicable
- Application reference/status flow
- Sales review workflow
- Customer activation

Known UX fixes already handled:

- Region/Province Tom Select styling
- Country field hardcoded to Saudi Arabia where requested
- Light/dark styling inconsistencies in registration screens
- Customer registration notification flow to Sales Team was investigated/fixed previously

### Customer Portal

Implemented customer modules include:

- Dashboard
- Profile
- Delivery Locations
- Users
- Products
- Quotations
- Contracts
- New Direct Order
- Orders
- My Trucks & Drivers
- My Shipments
- Service Requests / Tickets

Role navigation/permission intent:

- `CUSTOMER_ADMIN`: all currently implemented Customer Portal modules
- `PURCHASER`: purchasing/fulfillment modules, no user management
- `FINANCE_USER`: finance/read-related implemented modules only
- `VIEWER`: read-only permitted information, no create/update/admin actions

Important decisions:

- Customer User Management must not show the authenticated user’s own account in the managed users list.
- The authenticated user’s own details belong in Profile.
- Customer users are distinct from `sales_users`.

### Sales Portal

Implemented Sales modules include:

- Applications
- Quotations
- Contracts
- Orders
- Shipments
- Tickets / Service Requests

Important workflows:

- Sales reviews customer registrations/applications.
- Sales manages quotation and contract-related workflows.
- Sales processes orders into Hader operations.
- Sales can view non-draft customer tickets and send submitted tickets to CRM handoff.

### Pricing Administration

Implemented pricing/configuration areas include:

- Products
- Product Prices
- Delivery Pricing
- Tax Configuration
- Product options such as bag sizes

Important caution:

- Product Pricing and Ship-to Variance calculations were repeatedly protected by user instructions. Do not change pricing business logic unless specifically requested.

### Hader Portal

Implemented Hader/logistics areas include:

- Delivery Requests
- Shipments
- Dispatch Board
- Loading Control
- Silos & Bagging Lines
- Delivery Team
- Hader Cities
- Delivery Fleet
- Transporters
- POD

Important shipment workflow decision:

```text
ASSIGNED + LOADED
→ DISPATCHED
→ IN_TRANSIT
→ DELIVERED
→ CLOSED
```

Ownership:

- Hader Manager handles preparation, assignment, loading, and dispatch.
- Delivery Team starts delivery, marks delivered, records POD, and closes shipment according to existing POD rules.

Dispatch must not automatically mark shipments as delivered.

### Ship-to Variance

Implemented flow:

```text
Variance Detected
→ Extra Charge Raised
→ Pending Commercial Director Approval
→ Approved / Rejected
```

Verified example:

```text
Ordered City: Jeddah
Actual City: Abha
Ordered Price: 240 SAR/T
Actual Price: 250 SAR/T
Quantity: 5 TON
Extra Charge: 50 SAR
```

Implemented roles:

- `PRICE_MANAGER`: view variance, dismiss, raise extra charge
- `COMMERCIAL_DIRECTOR`: view pending extra charges, approve, reject

Important pending item:

- Approved variance charge financial posting is not implemented. Do not modify original order price, shipment quantity, or historical pricing snapshots.

### Portal Administration

Implemented/started areas:

- `PORTAL_ADMINISTRATOR` role added to existing internal role architecture
- Dedicated `/admin/login` entry point
- Portal Admin protected area/layout
- User Management ownership moved from `PRICING_ADMIN` to `PORTAL_ADMINISTRATOR`
- Roles & Permissions read/view architecture
- Global Notifications management where implemented

Important decision:

- Portal Administrator uses the existing `sales_users` authentication system.
- Do not create a duplicate admin auth system.

---

## 6. Customer Ticket / Service Request System

### Current status

The Customer Ticket System is implemented on branch:

```text
feature/interim-crm-workflow
```

It is a new module. There was no prior Ticket/Complaint/Service Request system.

### Backend module

Location:

```text
backend/src/modules/customer-tickets/
```

Files include:

- `customer-tickets.routes.ts`
- `customer-tickets.controller.ts`
- `customer-tickets.service.ts`
- `customer-tickets.validation.ts`
- `customer-tickets.test.ts`
- `customer-ticket-events.dispatcher.ts`
- `customer-ticket-email-notifications.ts`
- `templates/customer-ticket-email.templates.ts`

Related modules:

- `backend/src/modules/crm-handoff/`
- `backend/src/modules/ticket-notifications/`

### Database tables

Migration:

```text
database/migrations/000052_create_customer_tickets.cjs
database/migrations/000053_update_customer_ticket_status_lifecycle.cjs
```

Tables:

```text
customer_tickets
customer_ticket_events
```

Ticket fields include:

- `id`
- `ticket_number`
- `customer_account_id`
- `customer_user_id`
- `customer_phone`
- `description`
- `customer_user_role`
- `status`
- `crm_handoff_status`
- `sales_sent_at`
- `sales_user_id`
- `crm_response`
- `crm_resolved_at`
- `crm_response_imported_by_sales_user_id`
- `created_at`
- `updated_at`

Event fields include:

- `id`
- `ticket_id`
- `event_type`
- `previous_status`
- `new_status`
- `changed_by_customer_user_id`
- `changed_by_sales_user_id`
- `event_data`
- `created_at`

### Ticket number format

Generated server-side:

```text
TKT-2026-000001
```

Uses sequence:

```text
ticket_reference_seq
```

### Ticket status model

Final model:

```text
DRAFT
→ SUBMITTED
→ OPEN
→ CLOSED
```

CRM handoff is separate:

```text
NOT_SENT
→ SENT
```

Important decision:

- Customer Submit means submitted to Sales only.
- Customer Submit does not mean sent to CRM.
- `DRAFT → SUBMITTED` keeps `crm_handoff_status = NOT_SENT`.
- Sales Send to CRM performs `SUBMITTED → OPEN` and `NOT_SENT → SENT`.

### Customer ticket permissions

Create/save/submit:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`

Viewer:

- View only
- No create/save/submit/delete

Visibility:

- `CUSTOMER_ADMIN`: all tickets under their own customer account
- `PURCHASER`: only tickets created by themselves
- `FINANCE_USER`: only tickets created by themselves
- `VIEWER`: only tickets created by themselves

Delete:

- Allowed roles: `CUSTOMER_ADMIN`, `PURCHASER`, `FINANCE_USER`
- Status must be `DRAFT` or `CLOSED`
- Draft tickets can only be deleted by the creator
- `SUBMITTED` and `OPEN` cannot be deleted

### Sales ticket permissions

Sales Ticket APIs require:

```text
SALES_REP
```

Sales visibility:

- Sales can see non-draft tickets.
- Sales can send only `SUBMITTED` + `NOT_SENT` tickets to CRM handoff.
- Duplicate send-to-CRM is blocked.
- `DRAFT`, `OPEN`, and `CLOSED` cannot be sent to CRM again.

### Ticket API routes

Customer:

- `GET /api/v1/customer/tickets`
- `POST /api/v1/customer/tickets`
- `GET /api/v1/customer/tickets/:id`
- `PATCH /api/v1/customer/tickets/:id`
- `POST /api/v1/customer/tickets/:id/submit`
- `DELETE /api/v1/customer/tickets/:id`

Sales:

- `GET /api/v1/sales/tickets`
- `GET /api/v1/sales/tickets/:id`
- `POST /api/v1/sales/tickets/:id/send-to-crm`

API documentation file:

```text
documentation/api/customer-ticket-api-documentation.md
```

### Ticket frontend

Customer ticket pages:

- Customer Ticket list
- New Service Request
- Ticket Details

Sales ticket pages:

- Sales Ticket dashboard/list
- Sales Ticket Details

Ticket UI uses actual shadcn/ui primitives and TanStack Table as the reference implementation for future UI modernization.

Important Ticket UI decisions:

- Ticket Number is clickable and opens details.
- No separate View action in Customer table row menu.
- No Edit action for submitted/open/closed tickets.
- Draft tickets are editable in the draft document/form only.
- Customer ticket table supports selection, 3-dot menu, pagination, filters, relative timestamp, and role-based Created By column.
- Customer Administrator sees `Created By` column.
- Other customer roles do not see `Created By` column.
- Sales table has Sales-oriented columns and row actions.

### Ticket filters

Filter builder pattern:

```text
Field → Condition → Value
```

Uses:

- shadcn/ui foundation
- Tom Select for selectable controls
- server-side filtering
- multiple AND conditions

Customer filter fields:

- Ticket Number
- Description
- Status
- CRM Handoff
- Created Date
- Updated Date

Created By filter is hidden from Customer Portal.

Sales filter fields:

- Ticket Number
- Customer
- Description
- Status
- CRM Handoff
- Created Date
- Created By

Created By filter is available in Sales Portal and filters by `customer_user_id`.

### Ticket event architecture

Flow:

```text
Ticket Service
→ Customer Ticket Event Dispatcher
→ Future handlers / current email handler
```

Events:

- `TICKET_CREATED`
- `TICKET_SUBMITTED`
- `TICKET_SENT_TO_CRM`
- `TICKET_OPENED`
- `TICKET_CLOSED`

Event payload includes:

- ticket id
- ticket number
- customer account
- customer user
- actor user
- timestamp
- metadata

### Ticket email notifications

Implemented through dispatcher subscription, not controller/service direct sends.

Events handled:

- `TICKET_SUBMITTED`: sends Sales Team email if `SALES_TEAM_EMAIL` is configured
- `TICKET_CLOSED`: sends customer resolution email if customer email exists

Email failures:

- Logged safely
- Do not roll back ticket workflow

### CRM adapter foundation

Current architecture goal:

```text
Ticket Service
→ CRM Handoff Service
→ CRM Adapter Interface
→ Future CRM API implementation
```

Current adapter is intentionally non-real/no-op/pending. It must not fake success or silently mark tickets as externally sent.

Future CRM API should be replaceable by implementing the adapter only.

### WhatsApp adapter foundation

Current architecture goal:

```text
Ticket Event
→ Notification Service
→ WhatsApp Provider Interface
→ Future WhatsApp API Provider
```

No real WhatsApp provider is configured. Do not add Meta/Twilio/provider-specific fields until the provider is selected.

---

## 7. Integrations

### VAS Cloud Logistics

VAS Cloud Logistics integration is pending.

Important business decision:

- AlSafwa must actively call the VAS Cloud Logistics REST API to send order data.
- VAS should not poll AlSafwa APIs for new orders.

Existing architecture includes VAS-related integration/outbox code:

- `backend/src/integrations/vas/`
- `database/migrations/000051_create_vas_outbox.cjs`

Do not invent VAS endpoints, credentials, payload names, API keys, or fake fields. Use only manager-provided VAS API documentation when implementation begins.

### Oracle Fusion / ERP

Oracle Fusion integration is pending.

Dependent pending areas:

- Invoice/Receivables/Statements
- Financial posting
- Approved Ship-to Variance charge posting

### CRM

Interim CRM workflow branch exists:

```text
feature/interim-crm-workflow
```

Current interim business plan:

```text
Customer creates ticket
→ Sales reviews ticket
→ Sales marks Send to CRM
→ Future export/import or real CRM handoff
→ CRM returns response
→ Ticket becomes CLOSED
→ Customer receives resolution notification
```

The external CRM API is not yet available.

### WhatsApp

WhatsApp integration is only prepared architecturally. There is no:

- WhatsApp Cloud API
- Twilio WhatsApp integration
- Provider token
- Phone Number ID
- Message templates

---

## 8. Documentation System

User Guide/UAT documentation generator exists.

Important folders:

- `documentation/screenshots/`
- `documentation/user-guide/`
- `documentation/generated/`
- `documentation/api/`

Commands:

```bash
npm run docs:generate
```

Generated user guide targets:

- `documentation/generated/AlSafwa_Cement_Portal_User_Guide_and_UAT.md`
- `documentation/generated/AlSafwa_Cement_Portal_User_Guide_and_UAT.html`

The HTML generator was updated to embed screenshots as Base64/data URLs so the generated HTML can be copied to another computer without depending on `documentation/screenshots/`.

Important documentation rule:

- Use only real screenshots from `documentation/screenshots/`.
- Do not create fake screenshots.
- Do not document pending functionality as completed.

---

## 9. Theme and UI Decisions

### Global theme

Approved light palette:

- Canvas/page background: `#F6F5FA`
- Cards/surfaces: `#FFFFFF`
- Borders/dividers: `#E5E2ED`
- Primary text/labels: `#1C1625`
- Brand accent: existing AlSafwa purple

Approved dark palette:

- Canvas/page background: `#0D0B14`
- Cards/elevated surfaces: `#14121E`
- Primary text/data: `#F1EEF7`
- Border: subtle dark purple/charcoal
- Brand accent: existing AlSafwa purple

Design rules:

- Avoid pure black as the main dark background.
- Avoid pure white text everywhere in dark mode.
- Avoid excessive borders and heavy shadows.
- Inputs, dropdowns, tables, modals, and native controls should follow the active theme.

### AppShell decisions

Global AppShell was refined across portals.

Important UX decisions:

- Avoid duplicate page headers where pages already show their own heading.
- Header/top bar should be minimal.
- Notification and profile controls remain globally accessible.
- Profile is accessible through avatar menu.
- Preserve each portal’s existing navigation and permissions.
- Sidebar brand/logo collapse behavior has been adjusted in prior tasks.

### Dropdowns

Tom Select is used for searchable dropdowns across legacy/custom UI areas.

Important styling decisions:

- No duplicated native select UI.
- No unnecessary dropdown arrow when design requires clean searchable field.
- No unnecessary internal scrollbar.
- Dropdown must stay in viewport and avoid page-level overflow.
- Preserve submitted values, validation, and API payloads.

### shadcn/ui

The Ticket System is the first reference implementation for actual shadcn/ui primitives.

Do not migrate the entire app to shadcn/ui unless explicitly requested.

Do not delete legacy UI components yet.

---

## 10. Important Business Logic That Must Be Preserved

Avoid changing these unless a task explicitly asks for that exact area:

### Pricing

- Product pricing calculations
- Delivery pricing calculations
- VAT/tax calculations
- Product Prices APIs and response contract
- Ship-to Variance calculations

### Ship-to Variance

Do not modify Part 1 calculation.

Preserve:

- ordered city price
- actual city price
- difference per ton
- quantity
- extra charge
- pricing snapshot
- approval workflow

### Orders

Do not modify:

- original order price
- direct order pricing
- contract order pricing
- order status workflow
- Sales order processing behavior

### Shipments/POD

Do not modify:

- shipment status machine
- loading control
- dispatch rules
- delivery team ownership
- POD creation/update rules
- shipment close behavior

### Auth/RBAC

Do not create:

- a second authentication system
- a second role system
- a second password hashing system
- duplicate user tables for Portal Administrator

---

## 11. Current API Response Conventions

Success:

```json
{
  "success": true,
  "data": {}
}
```

List responses commonly use:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed"
  }
}
```

Validation errors may include:

```json
{
  "errors": {
    "field": "Message"
  }
}
```

Frontend services should never pass `undefined` into page state where a safe result shape is expected. Previous runtime fixes established this pattern for pages such as Product Prices, Customer Quotations, and Customer Tickets.

---

## 12. Testing and Command Policy

The user often gives strict instructions about what not to run. Always obey the current task instructions.

Common prohibited commands in many tasks:

- tests
- build
- lint
- typecheck
- migrations
- seeders

Only run these when the user explicitly permits or requests them.

Project commands:

```bash
npm run dev
npm run build
npm run build -w frontend
npm run build -w backend
npm test
npm run test -w backend
npm run test -w frontend
npm run migrate:up
npm run migrate:down
npm run docs:generate
```

Migration caution:

- Never run migrations automatically against an unknown database.
- Always identify the database environment first if migration execution is requested.
- The user often requests migration source fixes without executing migrations.

---

## 13. Git / Branch Context

Important branch used for the ticket feature:

```text
feature/interim-crm-workflow
```

The user frequently asks to commit and push after feature work.

Before committing:

- Check `git status`.
- Include only relevant changed files.
- Do not revert or overwrite unrelated user changes.
- Use concise commit messages with a useful body when requested.

---

## 14. External API Documentation Context

A ticket API documentation file was created at:

```text
documentation/api/customer-ticket-api-documentation.md
```

Important finding:

- Existing Ticket APIs support read-only data pull through `GET` endpoints.
- Existing Ticket APIs also support partial workflow actions.
- They are portal workflow APIs, not a dedicated external/B2B API boundary.

Security recommendation:

- Do not expose Sales/Admin portal APIs directly to external companies without a dedicated integration auth/scope/rate-limit/audit layer.

Potential missing external APIs:

- Service-account auth
- Read-only ticket sync
- Delta/cursor sync
- CRM response import
- Ticket close from CRM response
- Webhooks
- API audit/rate limit layer

---

## 15. Known Sensitive Areas and Pitfalls

### Do not weaken coordinate validation

Delivery location latitude/longitude must remain required and valid:

- Latitude: `-90` to `90`
- Longitude: `-180` to `180`

Do not hardcode fake coordinates.

### Do not fake integration behavior

For VAS, CRM, WhatsApp, Oracle, and financial posting:

- Do not invent credentials.
- Do not invent endpoints.
- Do not fake success.
- Do not mark records as externally processed unless the real workflow exists.

### Do not expose sensitive data

Never expose:

- passwords
- password hashes
- JWT/session secrets
- SMTP credentials
- unrelated customer data
- internal admin users through external docs/APIs

### Preserve tenant isolation

Customer APIs must remain account-scoped. The backend should derive ownership from authenticated context.

### Be careful with role naming

Customer roles and Sales/internal roles are different systems. Do not mix:

- `customer_users`
- `sales_users`

---

## 16. Remaining Roadmap

### High priority integration roadmap

1. Complete CRM interim workflow:
   - CSV/Excel export for Sales/CRM handoff
   - CRM response import
   - `OPEN → CLOSED` transition
   - Store CRM response text
   - Trigger customer resolution email/WhatsApp event

2. Replace interim CRM handoff:
   - Implement real CRM adapter when API documentation is available
   - Keep Ticket UI/database/workflow stable

3. VAS Cloud Logistics:
   - Implement active outbound order push
   - Use VAS outbox/retry architecture
   - Preserve order/shipment business logic

4. Financial posting:
   - Determine correct accounting/order/invoice model for approved Ship-to Variance charge
   - Do not modify original order price or shipment quantity

5. Oracle Fusion:
   - Define integration contract
   - Map invoices/receivables/statements
   - Implement only after ERP contract is available

### Product/admin roadmap

- System Parameters
- Global Notifications completion if still partial
- Reports & Analytics
- Audit/Activity Log UI and external reporting
- Full external API documentation/OpenAPI

### UI modernization roadmap

- Reuse the Ticket System as reference for future shadcn/TanStack migrations.
- Do not migrate unrelated screens opportunistically.
- Standardize:
  - buttons
  - inputs
  - Tom Select/search controls
  - tables
  - filters
  - dialogs
  - status badges
  - loading/empty/error states

---

## 17. Recommended First Steps for a New Developer/Codex Agent

1. Read this file completely.
2. Check the current branch:

   ```bash
   git branch --show-current
   ```

3. Check pending changes:

   ```bash
   git status --short
   ```

4. Inspect the specific module for the task before editing.
5. Preserve unrelated user changes.
6. Follow the existing route/controller/service/validation pattern.
7. Do not run tests/build/migrations unless the user permits them.
8. For integration work, build provider boundaries first and avoid fake external success.
9. For Customer work, enforce tenant isolation in backend, not only frontend.
10. For UI work, preserve routes, permissions, API contracts, and business logic unless explicitly requested.

