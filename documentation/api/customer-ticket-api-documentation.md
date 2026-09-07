# Customer Ticket API Documentation

## 1. Overview

This document describes the existing Customer Ticket / Service Request APIs in the AlSafwa Cement Portal.

The Ticket System allows customer users to create and manage service request drafts, submit requests to Sales, and allows authorized Sales users to review submitted requests and mark them as sent to CRM processing.

This documentation is based on the current backend implementation only. It does not define new APIs and does not describe future CRM, WhatsApp, CSV, or ERP integrations as already available.

### Base URL

Use the deployed backend host followed by the API version prefix:

```text
https://<backend-host>/api/v1
```

For local development:

```text
http://localhost:3000/api/v1
```

### Data Format

All JSON APIs use:

```http
Content-Type: application/json
Accept: application/json
```

Most responses use the standard envelope:

```json
{
  "success": true,
  "data": {}
}
```

---

## 2. Authentication

The existing Ticket APIs use the same authentication systems as the Customer Portal and Sales Portal.

### Customer API Authentication

Customer endpoints require an authenticated Customer Portal user.

Supported token sources:

- `Authorization: Bearer <CUSTOMER_JWT>`
- `customer_session` cookie

Example:

```http
GET /api/v1/customer/tickets HTTP/1.1
Host: <backend-host>
Authorization: Bearer CUSTOMER_TOKEN
Accept: application/json
```

### Sales API Authentication

Sales endpoints require an authenticated Sales Portal user with the `SALES_REP` role.

Supported token sources:

- `Authorization: Bearer <SALES_JWT>`
- `sales_session` cookie

Example:

```http
GET /api/v1/sales/tickets HTTP/1.1
Host: <backend-host>
Authorization: Bearer SALES_TOKEN
Accept: application/json
```

---

## 3. API Type

The current Ticket APIs support:

### Option A — Read-only Data Pull

Supported through existing `GET` endpoints:

- Customer users can pull tickets they are authorized to view.
- Sales Representatives can pull non-draft tickets.

### Option B — Partial Ticket Workflow API

The APIs also support the implemented portal workflow:

- Customer creates a draft ticket.
- Customer updates their own draft ticket.
- Customer submits their own draft ticket to Sales.
- Sales Representative sends submitted ticket to CRM handoff.
- Authorized customer users delete eligible draft or closed tickets.

The APIs do not currently support the full external CRM lifecycle because the CRM response/import/close endpoint is not implemented yet.

---

## 4. Ticket Data Model

### Ticket Fields

| Field | Type | Description |
|---|---:|---|
| `id` | UUID | Internal ticket ID |
| `ticketNumber` | string | Human-readable ticket number, generated server-side, e.g. `TKT-2026-000001` |
| `customer.accountId` | UUID | Customer account/company ID |
| `customer.companyName` | string/null | Customer company name |
| `customerUser.id` | UUID | Customer user who created the ticket |
| `customerUser.name` | string/null | Creator name |
| `customerUser.email` | string/null | Creator email |
| `customerUser.phone` | string/null | Creator/customer phone captured on ticket |
| `customerUser.role` | string | Creator role at creation time |
| `createdBy` | object | Convenience creator object |
| `description` | string | Service request description |
| `status` | string | Ticket lifecycle status |
| `crmHandoffStatus` | string | CRM handoff status |
| `crmResponse` | string/null | CRM response/resolution text, reserved for future close/import flow |
| `crmResolvedAt` | ISO datetime/null | CRM resolution timestamp, reserved for future close/import flow |
| `sales` | object/null | Sales handoff information when sent to CRM |
| `createdAt` | ISO datetime | Ticket creation timestamp |
| `updatedAt` | ISO datetime | Last ticket update timestamp |
| `events` | array | Included on detail endpoints only |

### Ticket Status Lifecycle

```text
DRAFT → SUBMITTED → OPEN → CLOSED
```

Current implemented transitions:

| Transition | Actor | Current API support |
|---|---|---|
| Create `DRAFT` | Customer Administrator, Purchaser, Finance User | Supported |
| `DRAFT` update | Original ticket creator only | Supported |
| `DRAFT → SUBMITTED` | Original ticket creator only | Supported |
| `SUBMITTED → OPEN` | Sales Representative using Send to CRM | Supported |
| `OPEN → CLOSED` | Future CRM response/import workflow | Not currently available |

### CRM Handoff Status

```text
NOT_SENT → SENT
```

Important behavior:

- Customer submission does not send to CRM.
- Customer submission keeps `crmHandoffStatus = NOT_SENT`.
- Sales Send to CRM changes `crmHandoffStatus = SENT`.

### Ticket Events

The system records ticket lifecycle events in `customer_ticket_events`.

Known event types:

- `TICKET_CREATED`
- `TICKET_SUBMITTED`
- `TICKET_SENT_TO_CRM`
- `TICKET_OPENED`
- `TICKET_CLOSED`

Only real stored events are returned.

---

## 5. Customer Ticket Endpoints

Customer endpoints are mounted under:

```text
/api/v1/customer/tickets
```

All customer endpoints require Customer Portal authentication.

### 5.1 List Customer Tickets

```http
GET /api/v1/customer/tickets
```

Retrieves tickets visible to the authenticated customer user.

#### Permissions

| Role | Access |
|---|---|
| `CUSTOMER_ADMIN` | Can view all tickets belonging to their own customer account |
| `PURCHASER` | Can view only tickets created by themselves |
| `FINANCE_USER` | Can view only tickets created by themselves |
| `VIEWER` | Can view only tickets created by themselves |

The backend derives `customer_account_id` and `customer_user_id` from the authenticated session. The frontend must not supply or override ownership.

#### Query Parameters

| Parameter | Type | Required | Description |
|---|---:|---:|---|
| `page` | number | No | Page number. Default: `1` |
| `filters` | JSON string | No | Array of filter conditions. Maximum 10 filters |

Pagination page size is fixed at 10 records.

#### Supported Filters

`filters` is a JSON-encoded array.

Example:

```text
?filters=[{"field":"status","condition":"equals","value":"DRAFT"}]
```

| Field | Conditions | Values |
|---|---|---|
| `ticketNumber` | `equals`, `contains` | String |
| `description` | `contains` | String |
| `status` | `equals` | `DRAFT`, `SUBMITTED`, `OPEN`, `CLOSED` |
| `crmHandoff` | `equals` | `NOT_SENT`, `SENT` |
| `createdDate` | `before`, `after`, `between` | Date, `YYYY-MM-DD` |
| `updatedDate` | `before`, `after`, `between` | Date, `YYYY-MM-DD` |
| `createdBy` | `equals` | Customer user ID |

Note: Customer Portal UI hides the `Created By` filter, but the current backend validation still accepts it.

#### Example Request

```http
GET /api/v1/customer/tickets?page=1 HTTP/1.1
Host: <backend-host>
Authorization: Bearer CUSTOMER_TOKEN
Accept: application/json
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "ticketNumber": "TKT-2026-000001",
        "customer": {
          "accountId": "22222222-2222-2222-2222-222222222222",
          "companyName": "ABC Company"
        },
        "customerUser": {
          "id": "33333333-3333-3333-3333-333333333333",
          "name": "Ahmed Ali",
          "email": "ahmed@example.com",
          "phone": "+966500000000",
          "role": "PURCHASER"
        },
        "createdBy": {
          "id": "33333333-3333-3333-3333-333333333333",
          "name": "Ahmed Ali",
          "email": "ahmed@example.com",
          "role": "PURCHASER"
        },
        "description": "Need support with an order.",
        "status": "DRAFT",
        "crmHandoffStatus": "NOT_SENT",
        "crmResponse": null,
        "crmResolvedAt": null,
        "sales": null,
        "createdAt": "2026-09-03T10:00:00.000Z",
        "updatedAt": "2026-09-03T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 5.2 Create Customer Ticket Draft

```http
POST /api/v1/customer/tickets
```

Creates a new service request as a draft.

#### Permissions

Allowed:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`

Not allowed:

- `VIEWER`

#### Request Body

```json
{
  "description": "Need support with an order."
}
```

#### Validation

| Field | Rule |
|---|---|
| `description` | Required, trimmed, 1 to 2,000 characters |

The server generates:

- `ticketNumber`
- `customer_account_id`
- `customer_user_id`
- `customer_phone`
- `customer_user_role`
- `status = DRAFT`
- `crm_handoff_status = NOT_SENT`

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "description": "Need support with an order.",
      "status": "DRAFT",
      "crmHandoffStatus": "NOT_SENT",
      "createdAt": "2026-09-03T10:00:00.000Z",
      "updatedAt": "2026-09-03T10:00:00.000Z"
    }
  }
}
```

Response status: `201 Created`

---

### 5.3 Get Customer Ticket Detail

```http
GET /api/v1/customer/tickets/:id
```

Retrieves one ticket and its activity events.

#### Permissions

| Role | Access |
|---|---|
| `CUSTOMER_ADMIN` | Any ticket from their own customer account |
| `PURCHASER` | Own tickets only |
| `FINANCE_USER` | Own tickets only |
| `VIEWER` | Own tickets only |

#### Path Parameters

| Parameter | Type | Required |
|---|---:|---:|
| `id` | UUID | Yes |

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "customer": {
        "accountId": "22222222-2222-2222-2222-222222222222",
        "companyName": "ABC Company"
      },
      "customerUser": {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Ahmed Ali",
        "email": "ahmed@example.com",
        "phone": "+966500000000",
        "role": "PURCHASER"
      },
      "description": "Need support with an order.",
      "status": "DRAFT",
      "crmHandoffStatus": "NOT_SENT",
      "crmResponse": null,
      "crmResolvedAt": null,
      "sales": null,
      "createdAt": "2026-09-03T10:00:00.000Z",
      "updatedAt": "2026-09-03T10:00:00.000Z",
      "events": [
        {
          "id": "44444444-4444-4444-4444-444444444444",
          "type": "TICKET_CREATED",
          "previousStatus": null,
          "newStatus": "DRAFT",
          "actor": {
            "kind": "CUSTOMER",
            "id": "33333333-3333-3333-3333-333333333333",
            "name": "Ahmed Ali",
            "role": "PURCHASER"
          },
          "data": {
            "ticketNumber": "TKT-2026-000001",
            "customerUserRole": "PURCHASER"
          },
          "createdAt": "2026-09-03T10:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### 5.4 Update Customer Draft Ticket

```http
PATCH /api/v1/customer/tickets/:id
```

Updates the description of an existing draft ticket.

#### Permissions

Allowed:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`

Additional backend rules:

- The ticket must belong to the authenticated customer account.
- Only the original ticket creator can update the draft.
- Ticket status must be `DRAFT`.

#### Path Parameters

| Parameter | Type | Required |
|---|---:|---:|
| `id` | UUID | Yes |

#### Request Body

```json
{
  "description": "Updated support request details."
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "description": "Updated support request details.",
      "status": "DRAFT",
      "crmHandoffStatus": "NOT_SENT",
      "updatedAt": "2026-09-03T10:15:00.000Z"
    }
  }
}
```

---

### 5.5 Submit Customer Ticket

```http
POST /api/v1/customer/tickets/:id/submit
```

Submits a draft ticket to the Sales Team.

#### Permissions

Allowed:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`

Additional backend rules:

- The ticket must belong to the authenticated customer account.
- Only the original ticket creator can submit the draft.
- Ticket status must be `DRAFT`.
- CRM handoff status must be `NOT_SENT`.

#### Status Change

```text
DRAFT → SUBMITTED
```

#### CRM Handoff Change

```text
NOT_SENT → NOT_SENT
```

Customer submission does not send the ticket to CRM.

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "description": "Need support with an order.",
      "status": "SUBMITTED",
      "crmHandoffStatus": "NOT_SENT",
      "createdAt": "2026-09-03T10:00:00.000Z",
      "updatedAt": "2026-09-03T10:20:00.000Z"
    }
  }
}
```

#### Event

Creates:

```text
TICKET_SUBMITTED
```

The email notification architecture listens to this event and sends a Sales Team email if `SALES_TEAM_EMAIL` is configured.

---

### 5.6 Delete Customer Ticket

```http
DELETE /api/v1/customer/tickets/:id
```

Deletes an eligible customer ticket.

#### Permissions

Allowed roles:

- `CUSTOMER_ADMIN`
- `PURCHASER`
- `FINANCE_USER`

Not allowed:

- `VIEWER`

#### Backend Rules

- The ticket must belong to the authenticated customer account.
- Ticket status must be either `DRAFT` or `CLOSED`.
- `DRAFT` tickets can only be deleted by the original ticket creator.
- `SUBMITTED` and `OPEN` tickets cannot be deleted.

#### Response

```http
204 No Content
```

---

## 6. Sales Ticket Endpoints

Sales endpoints are mounted under:

```text
/api/v1/sales/tickets
```

All Sales Ticket endpoints require Sales Portal authentication and the `SALES_REP` role.

These endpoints are internal Sales workflow APIs. They should not be exposed to an external company unless AlSafwa intentionally creates a trusted Sales-scoped integration account.

### 6.1 List Sales Tickets

```http
GET /api/v1/sales/tickets
```

Retrieves customer tickets visible to Sales.

Draft tickets are excluded.

#### Permissions

Required:

- Sales authentication
- `SALES_REP`

#### Query Parameters

| Parameter | Type | Required | Description |
|---|---:|---:|---|
| `page` | number | No | Page number. Default: `1` |
| `status` | string | No | `SUBMITTED`, `OPEN`, or `CLOSED` |
| `search` | string | No | Searches ticket number, description, customer company, and customer user |
| `filters` | JSON string | No | Array of filter conditions. Maximum 10 filters |

Pagination page size is fixed at 10 records.

#### Supported Filters

| Field | Conditions | Values |
|---|---|---|
| `ticketNumber` | `equals`, `contains` | String |
| `customer` | `equals`, `contains` | Customer account ID or company name |
| `description` | `contains` | String |
| `status` | `equals` | `SUBMITTED`, `OPEN`, `CLOSED` |
| `crmHandoff` | `equals` | `NOT_SENT`, `SENT` |
| `createdDate` | `before`, `after` | Date, `YYYY-MM-DD` |
| `createdBy` | `equals` | Customer user ID |

#### Example Request

```http
GET /api/v1/sales/tickets?page=1&status=SUBMITTED HTTP/1.1
Host: <backend-host>
Authorization: Bearer SALES_TOKEN
Accept: application/json
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "ticketNumber": "TKT-2026-000001",
        "customer": {
          "accountId": "22222222-2222-2222-2222-222222222222",
          "companyName": "ABC Company"
        },
        "customerUser": {
          "id": "33333333-3333-3333-3333-333333333333",
          "name": "Ahmed Ali",
          "email": "ahmed@example.com",
          "phone": "+966500000000",
          "role": "PURCHASER"
        },
        "description": "Need support with an order.",
        "status": "SUBMITTED",
        "crmHandoffStatus": "NOT_SENT",
        "crmResponse": null,
        "crmResolvedAt": null,
        "sales": null,
        "createdAt": "2026-09-03T10:00:00.000Z",
        "updatedAt": "2026-09-03T10:20:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 6.2 Get Sales Ticket Detail

```http
GET /api/v1/sales/tickets/:id
```

Retrieves one non-draft ticket and its activity events.

#### Permissions

Required:

- Sales authentication
- `SALES_REP`

#### Path Parameters

| Parameter | Type | Required |
|---|---:|---:|
| `id` | UUID | Yes |

#### Backend Rules

- `DRAFT` tickets are not visible through Sales APIs.
- Unknown or inaccessible tickets return a not-found error.

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "customer": {
        "accountId": "22222222-2222-2222-2222-222222222222",
        "companyName": "ABC Company"
      },
      "customerUser": {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Ahmed Ali",
        "email": "ahmed@example.com",
        "phone": "+966500000000",
        "role": "PURCHASER"
      },
      "description": "Need support with an order.",
      "status": "SUBMITTED",
      "crmHandoffStatus": "NOT_SENT",
      "crmResponse": null,
      "crmResolvedAt": null,
      "sales": null,
      "createdAt": "2026-09-03T10:00:00.000Z",
      "updatedAt": "2026-09-03T10:20:00.000Z",
      "events": [
        {
          "id": "44444444-4444-4444-4444-444444444444",
          "type": "TICKET_CREATED",
          "previousStatus": null,
          "newStatus": "DRAFT",
          "actor": {
            "kind": "CUSTOMER",
            "id": "33333333-3333-3333-3333-333333333333",
            "name": "Ahmed Ali",
            "role": "PURCHASER"
          },
          "data": {
            "ticketNumber": "TKT-2026-000001"
          },
          "createdAt": "2026-09-03T10:00:00.000Z"
        },
        {
          "id": "55555555-5555-5555-5555-555555555555",
          "type": "TICKET_SUBMITTED",
          "previousStatus": "DRAFT",
          "newStatus": "SUBMITTED",
          "actor": {
            "kind": "CUSTOMER",
            "id": "33333333-3333-3333-3333-333333333333",
            "name": "Ahmed Ali",
            "role": "PURCHASER"
          },
          "data": {
            "ticketNumber": "TKT-2026-000001"
          },
          "createdAt": "2026-09-03T10:20:00.000Z"
        }
      ]
    }
  }
}
```

---

### 6.3 Send Ticket to CRM

```http
POST /api/v1/sales/tickets/:id/send-to-crm
```

Marks a submitted ticket as sent to CRM processing.

This endpoint does not call a real CRM API. The CRM adapter foundation exists, but no external CRM provider is connected.

#### Permissions

Required:

- Sales authentication
- `SALES_REP`

#### Backend Rules

- Ticket must exist.
- Ticket status must be `SUBMITTED`.
- CRM handoff status must be `NOT_SENT`.
- `DRAFT`, `OPEN`, and `CLOSED` tickets cannot be sent.
- Tickets already sent to CRM cannot be sent again.

#### Status Change

```text
SUBMITTED → OPEN
```

#### CRM Handoff Change

```text
NOT_SENT → SENT
```

#### Example Request

```http
POST /api/v1/sales/tickets/11111111-1111-1111-1111-111111111111/send-to-crm HTTP/1.1
Host: <backend-host>
Authorization: Bearer SALES_TOKEN
Accept: application/json
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "11111111-1111-1111-1111-111111111111",
      "ticketNumber": "TKT-2026-000001",
      "description": "Need support with an order.",
      "status": "OPEN",
      "crmHandoffStatus": "SENT",
      "sales": {
        "sentAt": "2026-09-03T11:00:00.000Z",
        "userId": "66666666-6666-6666-6666-666666666666",
        "userName": "Sales User"
      },
      "createdAt": "2026-09-03T10:00:00.000Z",
      "updatedAt": "2026-09-03T11:00:00.000Z"
    }
  }
}
```

#### Event

Creates:

```text
TICKET_SENT_TO_CRM
```

The event metadata records the previous and new CRM handoff state.

---

## 7. Response Standard

### Success Response

```json
{
  "success": true,
  "data": {}
}
```

### List Response

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

### Error Response

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

Validation errors may also include an `errors` object and detailed Zod validation issues.

---

## 8. Common Error Responses

| HTTP Status | Error Code | Meaning |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Request payload, path parameter, or query parameter failed validation |
| `401` | `CUSTOMER_AUTH_REQUIRED` | Customer authentication is missing or invalid |
| `401` | `SALES_AUTH_REQUIRED` | Sales authentication is missing or invalid |
| `403` | `CUSTOMER_ROLE_FORBIDDEN` | Customer role is not authorized |
| `403` | `SALES_ROLE_FORBIDDEN` | Sales role is not authorized |
| `403` | `CUSTOMER_TICKET_CREATE_FORBIDDEN` | Customer role cannot create tickets |
| `403` | `CUSTOMER_TICKET_UPDATE_FORBIDDEN` | Customer cannot update this draft |
| `403` | `CUSTOMER_TICKET_SUBMIT_FORBIDDEN` | Customer cannot submit this draft |
| `403` | `CUSTOMER_TICKET_DELETE_FORBIDDEN` | Customer cannot delete this ticket |
| `404` | `CUSTOMER_TICKET_NOT_FOUND` | Ticket does not exist or is not visible to the actor |
| `409` | `CUSTOMER_TICKET_UPDATE_STATUS_INVALID` | Only draft tickets can be updated |
| `409` | `CUSTOMER_TICKET_SUBMIT_STATUS_INVALID` | Only draft tickets can be submitted |
| `409` | `CUSTOMER_TICKET_DELETE_STATUS_INVALID` | Only draft or closed tickets can be deleted |
| `409` | `CUSTOMER_TICKET_STATUS_INVALID` | Only submitted tickets can be sent to CRM |
| `409` | `CUSTOMER_TICKET_ALREADY_SENT_TO_CRM` | Ticket was already sent to CRM |
| `503` | `CUSTOMER_TICKET_CREATE_FAILED` | Ticket creation failed |
| `503` | `CUSTOMER_TICKET_UPDATE_FAILED` | Ticket update failed |

---

## 9. Security

### Authentication

All ticket APIs require either Customer Portal or Sales Portal authentication.

External systems should use bearer tokens if AlSafwa provides a controlled integration login. Browser cookies are supported for portal usage but are not ideal for server-to-server integration.

### Authorization

Customer-side authorization is role and ownership based.

Sales-side authorization currently requires:

```text
SALES_REP
```

### Customer/Tenant Isolation

Customer endpoints derive the customer account from the authenticated customer session.

The API must not trust these fields from the frontend:

- `customer_account_id`
- `customer_user_id`
- `customerAccountId`
- `customerUserId`

Customer visibility rules:

| Role | Visibility |
|---|---|
| `CUSTOMER_ADMIN` | All tickets for own customer account |
| `PURCHASER` | Own tickets only |
| `FINANCE_USER` | Own tickets only |
| `VIEWER` | Own tickets only |

### Sensitive Data Restrictions

Do not expose:

- Passwords
- Password hashes
- Authentication secrets
- Internal database credentials
- SMTP credentials
- Unrelated customer data
- Tickets belonging to other customer accounts

### Rate Limiting

No ticket-specific rate limiting was found in the inspected ticket module. External use should add API gateway or middleware-level rate limiting before exposing these APIs to third parties.

---

## 10. Notification and Event Architecture

The Ticket System uses a ticket event dispatcher.

Flow:

```text
Ticket Service
→ Customer Ticket Event Dispatcher
→ Notification handlers
```

Implemented email hooks:

| Event | Email behavior |
|---|---|
| `TICKET_SUBMITTED` | Sends Sales Team email when `SALES_TEAM_EMAIL` is configured |
| `TICKET_CLOSED` | Sends customer resolution email when customer email exists |

Email failure is logged and does not roll back the ticket workflow.

WhatsApp and real CRM provider integrations are not implemented.

---

## 11. Integration Usage Guidelines

### For External Read-only Data Pull

Use only the relevant `GET` endpoints.

Recommended customer-scoped endpoints:

- `GET /api/v1/customer/tickets`
- `GET /api/v1/customer/tickets/:id`

Use customer authentication and ensure the authenticated user belongs to the intended customer account.

### For Ticket Workflow Integration

Existing workflow endpoints can create, update, submit, delete, and send tickets to CRM handoff, but they are portal workflow APIs, not a dedicated external B2B API.

If an external company needs to manage the lifecycle, AlSafwa should provide a dedicated integration user, token policy, and agreed permissions.

### Current Limitations

- No dedicated external service-account authentication.
- No dedicated external API scopes.
- No CRM response import endpoint.
- No API endpoint to close tickets from an external CRM response.
- No CSV export/import API.
- No webhook subscription API.
- No public OpenAPI/Swagger specification found for the ticket module.
- No ticket-specific rate limit found.

---

## 12. Required APIs Not Currently Available

The following APIs are likely required for a complete external CRM handoff integration but are not currently implemented:

| Missing API | Purpose |
|---|---|
| External service-account login/token endpoint | Server-to-server authentication |
| External read-only ticket sync endpoint | Stable partner data pull with strict fields |
| Ticket delta endpoint | Pull only tickets changed after a timestamp/cursor |
| CRM response import endpoint | Import CRM status/response from external system |
| Close ticket endpoint | Move `OPEN → CLOSED` with CRM response |
| Ticket comments endpoint | Add/read conversation notes, if required |
| Ticket attachment endpoint | Attach files to service requests, if required |
| Webhook/event subscription endpoint | Notify external systems when ticket lifecycle changes |
| API audit log endpoint/report | Track external access |

---

## 13. Recommended External API Documentation Structure

For sharing with an external company, use this structure:

1. Purpose and scope
2. Environment/base URLs
3. Authentication and token handling
4. Required headers
5. Rate limits and retry rules
6. Standard response envelope
7. Error response format
8. Ticket data model
9. Status lifecycle
10. CRM handoff lifecycle
11. Read-only endpoints
12. Workflow endpoints, if approved for partner use
13. Filtering and pagination
14. Security and tenant isolation
15. Known limitations
16. Future CRM integration plan

---

## 14. Endpoint Summary

| Method | Endpoint | Purpose | External classification |
|---|---|---|---|
| `GET` | `/api/v1/customer/tickets` | List customer-visible tickets | Read-only data pull |
| `POST` | `/api/v1/customer/tickets` | Create draft ticket | Customer workflow |
| `GET` | `/api/v1/customer/tickets/:id` | Read customer-visible ticket detail | Read-only data pull |
| `PATCH` | `/api/v1/customer/tickets/:id` | Update own draft ticket | Customer workflow |
| `POST` | `/api/v1/customer/tickets/:id/submit` | Submit own draft ticket to Sales | Customer workflow |
| `DELETE` | `/api/v1/customer/tickets/:id` | Delete eligible draft/closed ticket | Customer workflow |
| `GET` | `/api/v1/sales/tickets` | List non-draft tickets for Sales | Internal Sales workflow |
| `GET` | `/api/v1/sales/tickets/:id` | Read non-draft ticket detail for Sales | Internal Sales workflow |
| `POST` | `/api/v1/sales/tickets/:id/send-to-crm` | Mark submitted ticket as sent to CRM | Internal Sales workflow |

