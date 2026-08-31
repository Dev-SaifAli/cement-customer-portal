# AlSafwa Cement Portal — User Guide and UAT

> Client-facing operating guide and user acceptance testing evidence

## Table of Contents

- [Document Control](#document-control)
- [Document Purpose](#document-purpose)
- [Portal Overview](#portal-overview)
- [User Roles & Responsibilities](#user-roles-responsibilities)
- [Getting Started](#getting-started)
- [Customer Registration & Onboarding](#customer-registration-onboarding)
- [Sales Representative](#sales-representative)
- [Customer Portal](#customer-portal)
- [Pricing Administrator](#pricing-administrator)
- [Hader Manager](#hader-manager)
- [Price Manager](#price-manager)
- [Commercial Director](#commercial-director)
- [Portal Administrator](#portal-administrator)
- [End-to-End Workflows](#end-to-end-workflows)
- [UAT Testing Guide](#uat-testing-guide)
  - [UAT-REG-001 — Start a customer registration](#uat-reg-001-start-a-customer-registration)
  - [UAT-REG-002 — Complete company and contact information](#uat-reg-002-complete-company-and-contact-information)
  - [UAT-REG-003 — Upload registration documents](#uat-reg-003-upload-registration-documents)
  - [UAT-REG-004 — Add a delivery location and map position](#uat-reg-004-add-a-delivery-location-and-map-position)
  - [UAT-REG-005 — Nominate administrator and submit registration](#uat-reg-005-nominate-administrator-and-submit-registration)
  - [UAT-SAL-001 — Review and approve a customer registration](#uat-sal-001-review-and-approve-a-customer-registration)
  - [UAT-SAL-002 — Activate an approved customer account](#uat-sal-002-activate-an-approved-customer-account)
  - [UAT-CUS-001 — Check application status](#uat-cus-001-check-application-status)
- [UAT Testing Checklist](#uat-testing-checklist)
- [Known Limitations & Pending Features](#known-limitations-pending-features)
- [UAT Sign-Off](#uat-sign-off)
- [Screenshot Evidence Register](#screenshot-evidence-register)

## Document Control

| Field | Value |
| --- | --- |
| Document owner | AlSafwa Cement |
| Prepared for | AlSafwa Cement Portal End Users |
| Version | 1.0 |
| Classification | Client Use |
| Generated | 2026-08-30T23:58:05.872Z |
| Screenshot evidence | 12 file(s) |

## Document Purpose

This document provides client-facing operating guidance and User Acceptance Testing (UAT) evidence for confirmed AlSafwa Cement Portal functionality. It uses only screenshots captured from the running application and separates implemented functionality from pending or unverified work.

## Portal Overview

The AlSafwa Cement Portal provides role-based customer onboarding, customer self-service, Sales review, pricing administration, Hader operations, commercial approval, and portal administration capabilities. The options visible to each user depend on their authenticated role and existing permissions.

**Confirmed guide areas**

- Customer Registration & Onboarding
- Customer Portal
- Sales Representative
- Pricing Administrator
- Hader Manager
- Price Manager
- Commercial Director
- Portal Administrator / User Management
- End-to-End Workflows

## User Roles & Responsibilities

| Role | Responsibility in this guide |
| --- | --- |
| Prospective Customer | Completes and submits the organization registration and checks its status. |
| Customer User | Uses the authenticated Customer Portal features permitted by the assigned customer role. |
| Sales Representative | Reviews customer onboarding applications and performs authorized Sales actions. |
| Pricing Administrator | Maintains authorized portal-owned product and pricing configuration. |
| Hader Manager | Manages authorized Hader operational workflows and configuration. |
| Price Manager | Reviews authorized pricing and Ship-to Variance workflows. |
| Commercial Director | Reviews commercial approval requests assigned to the role. |
| Portal Administrator | Manages authorized internal users and role-aware portal access. |

## Getting Started

1. Open the portal entry point provided for your authorized role.
2. Sign in using credentials issued through the approved administration process.
3. Confirm that the displayed navigation matches your assigned responsibilities.
4. Follow the relevant section of this guide and record the UAT result where required.
5. Use only approved test data and sign out when testing is complete.

> Security note: Credentials and authentication secrets are intentionally excluded from this document.

## Customer Registration & Onboarding

**Audience:** Prospective customer and Customer Administrator

Create an organization registration, provide company and contact details, upload required documents, define delivery locations, nominate the Customer Administrator, and submit the application for Sales review.

**Procedure**

1. Open the customer registration page and start a new application.
2. Enter the required company and contact information.
3. Upload the required company documents and provide valid future expiry dates.
4. Add delivery locations and select map locations where applicable.
5. Enter the Customer Administrator details.
6. Review the application and submit it for Sales review.

<figure id="figure-1">
  <img src="../screenshots/01_customer_registration_start.png" alt="Customer registration start page" width="100%">
  <figcaption><strong>Figure 1:</strong> Customer registration start page — Select the registration action to begin a new organization application.</figcaption>
</figure>

<figure id="figure-2">
  <img src="../screenshots/02_company_information.png" alt="Company information" width="100%">
  <figcaption><strong>Figure 2:</strong> Company information — Complete the required organization and company registration information.</figcaption>
</figure>

<figure id="figure-3">
  <img src="../screenshots/03_contact_information.png" alt="Contact information" width="100%">
  <figcaption><strong>Figure 3:</strong> Contact information — Provide the primary business contact details.</figcaption>
</figure>

<figure id="figure-4">
  <img src="../screenshots/04_documents.png" alt="Required company documents" width="100%">
  <figcaption><strong>Figure 4:</strong> Required company documents — Upload the required documents and enter valid expiry dates where requested.</figcaption>
</figure>

<figure id="figure-5">
  <img src="../screenshots/05_delivery_locations.png" alt="Delivery locations" width="100%">
  <figcaption><strong>Figure 5:</strong> Delivery locations — Add the operational delivery locations associated with the registration.</figcaption>
</figure>

<figure id="figure-6">
  <img src="../screenshots/06_set_map_location.png" alt="Map location selection" width="100%">
  <figcaption><strong>Figure 6:</strong> Map location selection — Use the map to select and confirm the correct delivery location.</figcaption>
</figure>

<figure id="figure-7">
  <img src="../screenshots/07_customer_admin.png" alt="Customer Administrator details" width="100%">
  <figcaption><strong>Figure 7:</strong> Customer Administrator details — Nominate the primary administrator who will manage the customer portal account.</figcaption>
</figure>

<figure id="figure-8">
  <img src="../screenshots/08_registration_review_submit.png" alt="Registration review and submission" width="100%">
  <figcaption><strong>Figure 8:</strong> Registration review and submission — Review the entered information and submit the application for Sales review.</figcaption>
</figure>

## Sales Representative

**Audience:** Sales Representative

Review submitted customer registration information, approve the registration, and activate the customer account using the authorized Sales workflow.

**Procedure**

1. Open the submitted application from the Sales applications queue.
2. Review the company, contact, document, delivery-location, and administrator information.
3. Apply the appropriate Sales decision.
4. For an approved application, complete customer account activation using the existing activation action.

<figure id="figure-9">
  <img src="../screenshots/09_sales_registration_review.png" alt="Sales registration review" width="100%">
  <figcaption><strong>Figure 9:</strong> Sales registration review — Review the complete submitted registration before making a decision.</figcaption>
</figure>

<figure id="figure-10">
  <img src="../screenshots/10_sales_approve.png" alt="Sales approval action" width="100%">
  <figcaption><strong>Figure 10:</strong> Sales approval action — Approve the application when all required information has been verified.</figcaption>
</figure>

<figure id="figure-11">
  <img src="../screenshots/11_approve_customer_account.png" alt="Customer account activation" width="100%">
  <figcaption><strong>Figure 11:</strong> Customer account activation — Use the authorized activation action to enable the approved customer account.</figcaption>
</figure>

<figure id="figure-12">
  <img src="../screenshots/12_customer_registration_result_application_status.png" alt="Customer registration result and application status" width="100%">
  <figcaption><strong>Figure 12:</strong> Customer registration result and application status — Confirm the customer-visible registration result after the Sales onboarding decision.</figcaption>
</figure>

## Customer Portal

**Audience:** Activated customer users

Guidance for authenticated customer features. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## Pricing Administrator

**Audience:** Pricing Administrator

Guidance for authorized product, pricing, and related administration. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## Hader Manager

**Audience:** Hader Manager

Guidance for authorized Hader delivery operations. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## Price Manager

**Audience:** Price Manager

Guidance for authorized pricing review and variance workflows. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## Commercial Director

**Audience:** Commercial Director

Guidance for authorized commercial approval workflows. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## Portal Administrator

**Audience:** Portal Administrator

Guidance for internal user administration and role-aware access management. Detailed procedures will be added as real screenshots are captured and mapped.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## End-to-End Workflows

**Audience:** Business process owners and UAT participants

Cross-role workflow guidance will be expanded only from verified application evidence.

> **[SCREENSHOT TO BE ADDED AFTER MANUAL TESTING]**

## UAT Testing Guide

Execute each test using an authorized test account and the stated preconditions. Record the observed result without changing the expected result. Mark the case Pass only when the actual result matches the expected result; otherwise mark Fail or Blocked and add a clear comment.

### UAT-REG-001 — Start a customer registration

| Field | Detail |
| --- | --- |
| Test ID | UAT-REG-001 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | The registration page is available and the user is not signed in. |
| Steps | 1. Open the customer registration page.<br>2. Start a new organization registration. |
| Expected Result | The registration workflow opens and allows the user to enter company information. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 01_customer_registration_start.png |

### UAT-REG-002 — Complete company and contact information

| Field | Detail |
| --- | --- |
| Test ID | UAT-REG-002 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | A customer registration has been started. |
| Steps | 1. Enter all required company information.<br>2. Enter all required contact information.<br>3. Continue to the documents step. |
| Expected Result | Valid company and contact information is retained and the registration can continue. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 02_company_information.png<br>03_contact_information.png |

### UAT-REG-003 — Upload registration documents

| Field | Detail |
| --- | --- |
| Test ID | UAT-REG-003 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | The registration has reached the document step and valid files are available. |
| Steps | 1. Upload the required company documents.<br>2. Enter valid future expiry dates where required.<br>3. Continue to the next step. |
| Expected Result | The uploaded documents and their metadata remain associated with the registration. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 04_documents.png |

### UAT-REG-004 — Add a delivery location and map position

| Field | Detail |
| --- | --- |
| Test ID | UAT-REG-004 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | The registration has reached the delivery-location step. |
| Steps | 1. Enter a delivery location.<br>2. Open the map selector.<br>3. Select and confirm the correct map location. |
| Expected Result | The delivery location and selected map position are retained in the registration. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 05_delivery_locations.png<br>06_set_map_location.png |

### UAT-REG-005 — Nominate administrator and submit registration

| Field | Detail |
| --- | --- |
| Test ID | UAT-REG-005 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | All preceding registration steps contain valid information. |
| Steps | 1. Enter the Customer Administrator details.<br>2. Review the full registration.<br>3. Submit the application. |
| Expected Result | The application is submitted for Sales review and receives an application reference. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 07_customer_admin.png<br>08_registration_review_submit.png |

### UAT-SAL-001 — Review and approve a customer registration

| Field | Detail |
| --- | --- |
| Test ID | UAT-SAL-001 |
| Module | Sales Representative |
| Role | Sales Representative |
| Preconditions | A valid customer registration is pending Sales review and the Sales user is authenticated. |
| Steps | 1. Open the pending registration from the Sales applications queue.<br>2. Review the submitted information and documents.<br>3. Approve the application. |
| Expected Result | The application is approved through the authorized Sales workflow. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 09_sales_registration_review.png<br>10_sales_approve.png |

### UAT-SAL-002 — Activate an approved customer account

| Field | Detail |
| --- | --- |
| Test ID | UAT-SAL-002 |
| Module | Sales Representative |
| Role | Sales Representative |
| Preconditions | The customer application is approved and ready for account activation. |
| Steps | 1. Open the approved application.<br>2. Run the customer account activation action. |
| Expected Result | The customer account is activated using the approved registration information. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 11_approve_customer_account.png |

### UAT-CUS-001 — Check application status

| Field | Detail |
| --- | --- |
| Test ID | UAT-CUS-001 |
| Module | Customer Registration & Onboarding |
| Role | Prospective customer |
| Preconditions | The user has the submitted application reference and registered email. |
| Steps | 1. Open the application status page.<br>2. Enter the application reference and registered email.<br>3. Submit the status enquiry. |
| Expected Result | The current customer-visible application result is displayed. |
| Actual Result | _To be completed during UAT_ |
| Pass/Fail | ☐ Pass &nbsp;&nbsp; ☐ Fail &nbsp;&nbsp; ☐ Blocked |
| Comments | _To be completed during UAT_ |
| Screenshot Evidence | 12_customer_registration_result_application_status.png |

## UAT Testing Checklist

| Test ID | Module | Test Case | Tester | Date | Pass | Fail | Blocked | Comments |
| --- | --- | --- | --- | --- | :---: | :---: | :---: | --- |
| UAT-REG-001 | Customer Registration & Onboarding | Start a customer registration |  |  | ☐ | ☐ | ☐ |  |
| UAT-REG-002 | Customer Registration & Onboarding | Complete company and contact information |  |  | ☐ | ☐ | ☐ |  |
| UAT-REG-003 | Customer Registration & Onboarding | Upload registration documents |  |  | ☐ | ☐ | ☐ |  |
| UAT-REG-004 | Customer Registration & Onboarding | Add a delivery location and map position |  |  | ☐ | ☐ | ☐ |  |
| UAT-REG-005 | Customer Registration & Onboarding | Nominate administrator and submit registration |  |  | ☐ | ☐ | ☐ |  |
| UAT-SAL-001 | Sales Representative | Review and approve a customer registration |  |  | ☐ | ☐ | ☐ |  |
| UAT-SAL-002 | Sales Representative | Activate an approved customer account |  |  | ☐ | ☐ | ☐ |  |
| UAT-CUS-001 | Customer Registration & Onboarding | Check application status |  |  | ☐ | ☐ | ☐ |  |

## Known Limitations & Pending Features

The following functionality is pending or has not been verified as implemented. It must not be accepted during UAT as completed functionality:

- VAS Cloud Logistics API integration
- System Parameters
- Audit / Activity Logs
- Global Notifications (subject to implementation verification)
- Reports & Analytics (subject to implementation verification)
- Financial posting of approved Ship-to Variance charges
- Oracle Fusion integration
- Invoices / Receivables / Statements (subject to implementation verification)

## UAT Sign-Off

| Approval | Name | Role | Signature | Date |
| --- | --- | --- | --- | --- |
| Prepared by |  |  |  |  |
| Business reviewer |  |  |  |  |
| UAT approver |  |  |  |  |

**Overall UAT decision:** ☐ Accepted &nbsp;&nbsp; ☐ Accepted with conditions &nbsp;&nbsp; ☐ Rejected

**Sign-off comments:**

________________________________________________________________________________

## Screenshot Evidence Register

| Sequence | Actual filename | Guide section |
| ---: | --- | --- |
| 1 | 01_customer_registration_start.png | Customer Registration & Onboarding |
| 2 | 02_company_information.png | Customer Registration & Onboarding |
| 3 | 03_contact_information.png | Customer Registration & Onboarding |
| 4 | 04_documents.png | Customer Registration & Onboarding |
| 5 | 05_delivery_locations.png | Customer Registration & Onboarding |
| 6 | 06_set_map_location.png | Customer Registration & Onboarding |
| 7 | 07_customer_admin.png | Customer Registration & Onboarding |
| 8 | 08_registration_review_submit.png | Customer Registration & Onboarding |
| 9 | 09_sales_registration_review.png | Sales Representative |
| 10 | 10_sales_approve.png | Sales Representative |
| 11 | 11_approve_customer_account.png | Sales Representative |
| 12 | 12_customer_registration_result_application_status.png | Sales Representative |

