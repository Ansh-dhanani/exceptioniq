# ExceptionIQ — Reconciliation Exception Orchestration Platform
## Product Plan v3.0 — Free-Tier-First Edition

> **Document Purpose:** Full product plan including original scope, identified gaps, remediation decisions, and enterprise-readiness additions. Intended for internal product, engineering, and pre-sales use. Version 3.0 supersedes v2.0 and updates the architecture for a free-tier-first build with no AWS dependency.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Market Opportunity](#3-market-opportunity)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Product Vision & Positioning](#5-product-vision--positioning)
6. [User Personas](#6-user-personas)
7. [Reconciliation Domains](#7-reconciliation-domains)
8. [GST & Tax Reconciliation Module](#8-gst--tax-reconciliation-module) *(New)*
9. [Core Product Workflows](#9-core-product-workflows)
10. [Notification & Alerting System](#10-notification--alerting-system) *(New)*
11. [Integration Strategy](#11-integration-strategy) *(New)*
12. [Multi-Currency & Multi-Entity Support](#12-multi-currency--multi-entity-support) *(New)*
13. [Exception Resolution Playbooks](#13-exception-resolution-playbooks) *(New)*
14. [Functional Requirements](#14-functional-requirements)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Security & Compliance Framework](#16-security--compliance-framework) *(Enhanced)*
17. [Data Governance & Retention](#17-data-governance--retention) *(New)*
18. [Technical Architecture](#18-technical-architecture)
19. [Frontend Strategy](#19-frontend-strategy) *(Enhanced)*
20. [API Design](#20-api-design)
21. [Data Model](#21-data-model)
22. [Matching & AI Strategy](#22-matching--ai-strategy)
23. [Infrastructure & DevOps](#23-infrastructure--devops) *(Enhanced — Free Tier)*
24. [Observability & Ops](#24-observability--ops)
25. [Testing Strategy](#25-testing-strategy)
26. [MVP Plan](#26-mvp-plan)
27. [Expansion Roadmap](#27-expansion-roadmap)
28. [Pricing & Commercial Model](#28-pricing--commercial-model) *(New)*
29. [Go-to-Market Strategy](#29-go-to-market-strategy) *(New)*
30. [Customer Onboarding & Success](#30-customer-onboarding--success) *(New)*
31. [White-Labeling & OEM Option](#31-white-labeling--oem-option) *(New)*
32. [Risk Register & Mitigations](#32-risk-register--mitigations) *(Enhanced)*
33. [Success Metrics](#33-success-metrics)
34. [Implementation Checklist](#34-implementation-checklist)

---

## 1. Executive Summary

**ExceptionIQ** is a purpose-built reconciliation exception orchestration platform that transforms how finance teams detect, investigate, resolve, and audit mismatches across bank, accounts payable (AP), accounts receivable (AR), and tax (GST/TDS) operations.

Most organizations can perform basic reconciliation. The problem is what happens next — when records do not match. Exceptions scatter across spreadsheets, emails, ERP exports, and WhatsApp threads. Ownership is unclear. Aging is untracked. Audit evidence is missing. ExceptionIQ is the dedicated layer that sits between your data sources and your finance team, orchestrating the full exception lifecycle from detection to closure.

**For MSMEs**, ExceptionIQ replaces manual reconciliation effort and reduces the risk of GST mismatches, payment errors, and month-end firefighting. The product is offered as a self-serve SaaS with guided onboarding and Tally/Zoho integrations that require no IT involvement.

**For corporates and enterprises**, ExceptionIQ provides multi-entity support, ERP integration (SAP, Oracle, Microsoft Dynamics), role-based approval workflows, SLA enforcement, signed audit trails, and compliance-ready reporting for internal audit and regulatory review.

**Key differentiators:**
- Exception orchestration as the primary function, not a side feature of a broader ERP
- GST reconciliation (GSTR-2A/2B vs purchase register) built in from day one
- AI-assisted document parsing with low token cost via PDF-to-Markdown pipeline
- Configurable routing rules with maker-checker enforcement
- Designed for Indian compliance requirements with global expansion readiness

**Commercial model:** Subscription SaaS with three tiers — Starter (MSME), Growth (mid-market), and Enterprise (large corporates and multi-entity groups). White-label licensing available for banks and accounting firms.

---

## 2. Problem Statement

### The Core Pain

Most organizations can perform basic reconciliation. The unresolved problem is exception handling. When mismatches occur, the work breaks across finance, procurement, warehouse, treasury, tax, and compliance teams. Ownership becomes unclear, exceptions age without escalation, and audit evidence is scattered in inboxes and spreadsheets.

### For MSMEs

- Manual reconciliation consumes hours that founders and finance heads cannot spare
- GST mismatches between GSTR-2A and purchase register create ITC risk and notices
- Payment disputes with customers and vendors are tracked in WhatsApp, not systems
- Month-end closes take days longer than they should
- Audit preparation requires reconstructing evidence from multiple sources

### For Corporates and Enterprises

- High transaction volumes create thousands of unmatched items monthly
- Multiple entities, currencies, and ERP instances make centralized visibility impossible
- Internal control expectations require documented, time-stamped audit trails
- Procurement, treasury, and finance teams blame each other for unresolved exceptions
- SLA breaches on vendor payments result in penalties and relationship damage
- Regulatory reviews expose gaps in three-way match documentation

### Gap Identified in Original Plan

The original plan described the problem well for bank reconciliation and AP/AR but did not address the GST pain, which is the single largest compliance driver for MSMEs and the most common cause of ITC reversals and departmental notices in India. This is corrected in Section 8.

---

## 3. Market Opportunity

### Indian Market Context

India's GST ecosystem alone creates a mandatory reconciliation requirement for every registered business. With over 15 million active GST filers, GSTR-2A/2B mismatches are the primary driver of ITC disputes and notices. No purpose-built MSME tool addresses this as a first-class feature. This is ExceptionIQ's beachhead.

Beyond GST, the AP and bank reconciliation market in India is fragmented. Large ERPs are over-engineered and expensive for mid-market. Tally and Zoho handle bookkeeping but not exception orchestration. Manual reconciliation remains the default for the vast majority of businesses.

### Sizing Indicators

- India has over 63 million MSMEs. Even a narrow slice — the 2 to 3 million that use accounting software — represents a large addressable market at a ₹2,000–₹10,000 per month price point.
- Large enterprises and business groups (500+employee companies) number in the tens of thousands and represent the high-value corporate segment at ₹50,000–₹3,00,000 per month.
- Banks, NBFCs, and accounting firms represent a white-label and OEM channel that multiplies reach without proportional sales cost.

### Why Now

- GST portal's GSTR-2B auto-population has increased the data availability but not the reconciliation tooling
- Increased RBI pressure on internal controls for NBFCs and banks
- Post-COVID normalization of cloud SaaS adoption in tier-2 and tier-3 businesses
- AI/LLM capabilities now make document parsing cheap enough to include in a mid-market product

---

## 4. Competitive Landscape

### Global Players (Enterprise Focus)

| Product | Strength | Weakness vs ExceptionIQ |
|---|---|---|
| BlackLine (SAP) | Deep ERP integration, strong workflows | Over-engineered, USD pricing, no GST support, requires SAP ecosystem |
| Trintech Cadency | Strong bank and intercompany recon | Enterprise-only, complex onboarding, no India localization |
| ReconArt | Good UI, flexible rules engine | No AI layer, limited India compliance |
| Oracle Fusion Recon | Tight Oracle integration | Lock-in, no standalone option, expensive |

### Indian / Regional Players

| Product | Strength | Weakness vs ExceptionIQ |
|---|---|---|
| Tally Prime | Ubiquitous in India, strong ledger | No exception orchestration, no routing or SLA engine |
| Zoho Books | Good MSME coverage | Basic reconciliation only, no exception lifecycle management |
| ClearTax (now Clear) | Strong GST filing | Reconciliation is a side feature; no exception routing or audit trails |
| BUSY Accounting | Popular in trading | Desktop-first, limited reconciliation features |

### ExceptionIQ's Differentiated Position

ExceptionIQ sits in a gap no current product fills: a dedicated exception orchestration layer with Indian compliance (GST, TDS), AI-assisted document parsing, configurable routing, and audit-ready evidence — available to both MSMEs (self-serve, affordable) and enterprise (customizable, integrated).

The product is not competing with ERPs. It is a reconciliation intelligence layer that sits above them.

---

## 5. Product Vision & Positioning

### Long-Term Vision

Build the exception operating system for finance and adjacent enterprise operations — the system of record for every unmatched transaction, its investigation, its resolution, and its audit proof.

### Positioning Statement

> **For finance teams that are drowning in unmatched transactions and manual follow-ups**, ExceptionIQ is the **exception orchestration platform** that **automatically detects, routes, tracks, and closes reconciliation mismatches** — unlike generic ERP modules or spreadsheets, **ExceptionIQ gives every exception an owner, an SLA, a resolution trail, and an audit log**.

### Design Principles

- **Exception-first**: every feature exists to move exceptions from detected to closed
- **Evidence-always**: every action is logged, timestamped, and exportable
- **Configurable, not coded**: routing rules, SLAs, and escalations are business-user configurable
- **AI-assisted, not AI-dependent**: deterministic logic runs first; AI reduces ambiguity at the edges
- **Indian by default, global by design**: GST and TDS are first-class, not afterthoughts

---

## 6. User Personas

### Primary Users (Daily or Weekly)

| Persona | Key Need | Key Fear |
|---|---|---|
| AP Analyst | Resolve invoice mismatches before payment runs | Paying a duplicate or wrong amount |
| AR Analyst | Identify and close unidentified receipts | Aging open items affecting DSO |
| Treasury Analyst | Clear bank statement exceptions before period close | Cash position errors |
| GST Executive | Reconcile GSTR-2A/2B before return filing deadline | Missing ITC claims, GST notices |
| TDS Officer | Match TDS deducted with Form 26AS | Demand notices for mismatch |
| Procurement Owner | Resolve three-way match failures | Vendor payment holds damaging relationships |
| Warehouse / Receiving Lead | Confirm GRN-related exceptions | Goods accepted but not invoiced |
| Internal Auditor | Review exception trails for control evidence | Gaps in evidence during audit |

### Management Users (Periodic)

| Persona | Key Need |
|---|---|
| Finance Manager / Controller | Exception aging dashboard, SLA breach alerts |
| CFO | Summary metrics, month-end status, risk exposure |
| Admin / Configurator | Set up routing rules, teams, SLAs, entities |

### MSME-Specific Persona

| Persona | Key Need |
|---|---|
| MSME Founder or Finance Head | Single-screen view of all open mismatches, no complex setup |
| Accountant / CA | Audit trail export, client-level reconciliation evidence |

---

## 7. Reconciliation Domains

### 7.1 Bank Reconciliation

Match bank statement lines with ledger entries.

**Typical exceptions:**
- Amount mismatch
- Date drift (transaction present on different dates)
- Reference mismatch
- Missing ledger entry (bank side present, ledger absent)
- Missing bank entry (ledger present, bank absent)
- Suspected duplicate (same amount, same date, different reference)
- Counterparty name variance

**Exception codes:** BANK-AMT, BANK-DATE, BANK-REF, BANK-MISS-LEDGER, BANK-MISS-BANK, BANK-DUP, BANK-NAME

### 7.2 AP Three-Way Matching

Match purchase order, goods received note (GRN), and vendor invoice.

**Typical exceptions:**
- Price mismatch (invoice unit rate differs from PO)
- Quantity mismatch (invoice quantity differs from GRN)
- Missing GRN (invoice received, goods not confirmed)
- Duplicate invoice (same invoice number or amount from same vendor)
- Tax mismatch (GST rate or amount differs)
- Partial delivery but full invoice
- Invalid or inactive vendor reference
- PO tolerance breach (amount within PO but outside approved tolerance)

**Exception codes:** AP-PRICE, AP-QTY, AP-NO-GRN, AP-DUP, AP-TAX, AP-PART-DEL, AP-VENDOR, AP-TOL

### 7.3 AR Payment Reconciliation

Match invoice, payment receipt, and bank credit.

**Typical exceptions:**
- Underpayment (payment less than invoice amount)
- Overpayment (payment exceeds invoice)
- Unidentified receipt (money received, no matching invoice or customer)
- Partial payment against multiple invoices
- Duplicate payment from customer
- Date variance
- Currency or conversion rate mismatch
- TDS deducted at source by customer

**Exception codes:** AR-UNDER, AR-OVER, AR-UNID, AR-PART, AR-DUP, AR-DATE, AR-CCY, AR-TDS

### 7.4 Intercompany Reconciliation *(New — Corporate Tier)*

Match intercompany transactions across entities within the same group.

**Typical exceptions:**
- Amount mismatch between entity books
- Timing difference (entity A booked, entity B has not)
- Missing elimination entry
- Currency conversion difference

**Exception codes:** IC-AMT, IC-TIME, IC-ELIM, IC-CCY

---

## 8. GST & Tax Reconciliation Module

> **Gap identified in original plan:** GST reconciliation was not covered. This is the highest-frequency compliance requirement for Indian MSMEs and a significant pain point for corporate finance teams. This module is added as a first-class domain alongside bank, AP, and AR.

### 8.1 GSTR-2A / 2B vs Purchase Register Reconciliation

**What it does:** Compares the ITC (Input Tax Credit) reported by vendors in GSTR-1 (visible to buyer in GSTR-2A / 2B) against the purchase register maintained by the buyer.

**Why it matters:** ITC can only be claimed if the vendor has filed and the values match. Mismatches result in ITC reversal, interest liability, and departmental notices.

**Typical exceptions:**
- Vendor not filed GSTR-1 (invoice present in purchase register, absent in 2A/2B)
- Invoice amount mismatch
- GSTIN mismatch (wrong GSTIN on invoice)
- Tax rate mismatch (IGST vs CGST+SGST, wrong rate)
- B2B invoice missing in 2A/2B
- Excess ITC claimed (purchase register shows less than 2A/2B)
- Reverse charge not accounted

**Exception codes:** GST-NOT-FILED, GST-AMT, GST-GSTIN, GST-RATE, GST-MISS-2B, GST-EXCESS, GST-RCM

**Data sources:**
- GSTR-2A/2B JSON download from GST portal (via file upload or API when available)
- Purchase register from Tally, Zoho Books, or CSV upload

**Workflow:**
1. Upload or sync GSTR-2B JSON (monthly)
2. Upload purchase register (CSV or ERP connector)
3. System matches by GSTIN + invoice number + tax period
4. Exceptions are created for all mismatches
5. Exceptions are routed to GST executive or accounts team
6. Resolution options: vendor follow-up, amendment, reversal, or defer

**Reports:**
- ITC eligible vs ITC claimed variance report
- Vendor-wise filing status dashboard
- Period-wise mismatch aging

### 8.2 TDS/TCS Reconciliation

**What it does:** Matches TDS deducted/collected in books against Form 26AS / Annual Information Statement (AIS) from the Income Tax portal.

**Typical exceptions:**
- TDS deducted but not deposited by deductor (appears in books, not in 26AS)
- TDS in 26AS not in books (counterparty deducted but buyer did not account)
- Rate mismatch (lower deduction certificate not applied)
- PAN mismatch causing credit rejection

**Exception codes:** TDS-NOT-DEPOSIT, TDS-MISS-BOOKS, TDS-RATE, TDS-PAN

**Data sources:**
- Form 26AS / AIS XML download
- Books TDS ledger from Tally or accounting software

### 8.3 GST Module Expansion (Later Phases)

- GSTR-1 vs e-Invoice reconciliation (outward supply)
- E-way bill vs invoice reconciliation (for traders and manufacturers)
- Annual return (GSTR-9) vs books reconciliation

---

## 9. Core Product Workflows

### 9.1 Exception Lifecycle

```
Ingest → Standardize → Match → Detect Exception → Classify → Route → Assign → Investigate
→ [Comment / Attach Evidence] → Resolve → [Approve if Maker-Checker] → Close → Audit Log
```

Every step is timestamped. Every state transition is logged. No exception can skip states. Resolution requires evidence (comment, attachment, or resolution code at minimum).

### 9.2 Investigation Workflow

1. Analyst opens exception from their queue
2. System shows: exception type, severity, related transaction records, variance amount, and AI-generated context summary
3. Analyst reviews supporting documents (invoice PDF, GRN, bank statement line)
4. Analyst adds investigation notes or uploads corrective document
5. Analyst selects resolution type: write-off, adjustment, follow-up required, counterparty action, system error
6. If maker-checker applies, exception moves to approver queue
7. Approver reviews and approves or rejects with reason
8. Closed exception is locked and audit-logged

### 9.3 Escalation Workflow

1. Exception is assigned with SLA deadline
2. On breach: system auto-escalates to configured escalation owner
3. Manager receives notification (email + in-app)
4. Escalation is recorded in audit log with timestamp
5. Escalated exception gets a new SLA tier

### 9.4 Bulk Operations *(New)*

When the same root cause affects many exceptions (e.g., a vendor filed all invoices with wrong GSTIN), analysts can:
- Select multiple exceptions of the same type
- Apply a bulk resolution with a single shared resolution code and note
- Bulk reassign to a different team member
- Export selection to CSV for external review

Bulk operations still generate individual audit entries per exception.

### 9.5 Batch Processing Status *(New — Gap Fixed)*

> **Gap identified:** Original plan mentioned CSV upload but did not design the processing status experience. Large files (50,000+ rows) need async processing with visible status.

**Design:**
- Upload triggers a background job with a unique batch ID
- User sees a live status page: queued → parsing → validating → matching → exceptions created
- Progress bar with estimated completion time based on row count
- Email notification when batch completes with summary: X matched, Y exceptions created, Z errors
- Error report downloadable for rows that failed validation (malformed dates, missing fields, unrecognized references)
- Batch history page showing all past uploads, their status, match rate, and exception count

### 9.6 Bad Data Handling *(New — Gap Fixed)*

> **Gap identified:** Original plan had no design for handling malformed or invalid upload data.

**Approach:**
- Pre-validation step before matching runs: schema check, required field check, type check, date format check
- Row-level errors do not fail the entire batch; valid rows proceed
- Error report generated with row number, field name, error type, and guidance message
- User can fix and re-upload only the error rows (via a "re-upload corrections" flow)
- Partial batches are clearly labeled in the exceptions list

---

## 10. Notification & Alerting System

> **Gap identified in original plan:** No notification design was included. Notifications are critical to the exception workflow — they are what makes routing actionable.

### 10.1 Notification Channels

| Channel | Use Case | Tier |
|---|---|---|
| In-app notification center | Assignment, comments, SLA warnings | All tiers |
| Email | Assignment, SLA breach, escalation, batch completion | All tiers |
| SMS | Critical SLA breach, high-severity exceptions | Growth and Enterprise |
| WhatsApp (via API) | Assignment alerts, resolution nudges | Enterprise and white-label |
| Webhook / API push | Downstream system integration | Enterprise |

### 10.2 Notification Events

| Event | Recipients | Priority |
|---|---|---|
| Exception assigned to me | Assignee | Medium |
| Exception commented on | Assignee + followers | Low |
| SLA 50% elapsed | Assignee | Medium |
| SLA breach | Assignee + escalation owner + manager | High |
| Exception escalated | New owner + manager | High |
| Batch processing complete | Uploader | Low |
| Batch processing failed | Uploader | High |
| Approval required | Approver | Medium |
| Approval completed | Requestor | Low |
| New high-severity exception | Assigned team + manager | High |

### 10.3 Notification Preferences

- Users can opt out of low-priority channels per event type
- Managers can set quiet hours (e.g., no SMS between 10 PM and 7 AM)
- Digest mode: bundle all low-priority notifications into a daily summary email

### 10.4 In-App Notification Center

- Bell icon with unread count in navigation
- Sorted by recency with category filter (assigned to me / requires approval / SLA breach)
- Mark all as read, snooze individual notifications
- Deep link from notification to exception detail page

---

## 11. Integration Strategy

> **Gap identified in original plan:** No integration plan was included. For corporate and MSME sales, the ability to connect to existing accounting software is a primary buying criterion.

### 11.1 Accounting & ERP Integrations

| System | Integration Type | Target Tier |
|---|---|---|
| Tally Prime / ERP 9 | File export (XML/CSV via Tally connector) | Starter, Growth |
| Zoho Books | REST API (Zoho OAuth) | Starter, Growth |
| QuickBooks Online | REST API (Intuit OAuth) | Starter, Growth |
| BUSY Accounting | File export (CSV) | Starter |
| SAP S/4HANA | RFC / BAPI or IDoc | Enterprise |
| Oracle NetSuite | SuiteScript REST API | Enterprise |
| Microsoft Dynamics 365 | Dataverse REST API | Enterprise |
| Custom ERP | Inbound CSV/JSON via SFTP or REST | Enterprise |

**Integration approach:**
- Phase 1 (MVP): CSV / Excel file-based import. Every integration starts here.
- Phase 2: Connector layer with pre-built adapters for Tally and Zoho
- Phase 3: REST API connectors for QuickBooks, SAP, Oracle
- File-based imports remain available as a fallback for all tiers at all times

### 11.2 Bank Statement Integrations

| Channel | Format | Notes |
|---|---|---|
| Manual upload | CSV, Excel, OFX | Universal, works on day one |
| SFTP feed | MT940, BAI2, CSV | Corporate and enterprise banks |
| Account aggregator (India) | AA framework JSON | Future; requires RBI consent framework |
| Direct bank API | Bank-specific | Future; requires bank partnerships |

### 11.3 GST Portal Integration

- GSTR-2B JSON file upload (manual, supported from day one)
- GST API integration for auto-fetch (future, requires GSP empanelment or partner API)
- Form 26AS / AIS XML file upload

### 11.4 Outbound Webhooks *(New — Gap Fixed)*

> **Gap identified:** No event publishing or webhook design was included.

ExceptionIQ publishes events to configured webhook endpoints for:
- Exception created
- Exception status changed
- SLA breached
- Exception resolved
- Batch completed

Webhook payloads are JSON with event type, timestamp, entity ID, and delta. Delivery is at-least-once with retry on failure (3 retries, exponential backoff). Failed deliveries are visible in a webhook log with manual replay option.

---

## 12. Multi-Currency & Multi-Entity Support

> **Gap identified in original plan:** Multi-currency was not mentioned. Multi-entity was only vaguely referenced as a future item. Both are required for enterprise selling.

### 12.1 Multi-Currency

- Exceptions display both original currency and functional currency equivalent
- Exchange rate source: configurable (manual input, or daily RBI/ECB rate feed)
- Amount tolerance rules can be set in functional currency to avoid false exceptions from minor FX movements
- Currency mismatch is its own exception code (BANK-CCY, AR-CCY)
- Reports can aggregate across currencies with conversion at period-end rate

### 12.2 Multi-Entity / Multi-Company

**Design:**
- Platform supports multiple entities (companies, branches, subsidiaries) under a single tenant account
- Each entity has its own: chart of accounts mapping, routing rules, SLA policies, team assignments, and data isolation
- Cross-entity dashboard for group finance controllers and CFO office
- Intercompany reconciliation module (Section 7.4) sits on top of the multi-entity layer
- Users can have different roles in different entities (e.g., approver in Entity A, viewer in Entity B)
- Data is logically isolated per entity; users cannot see another entity's data unless explicitly granted access

**Corporate Group Structure:**
```
Tenant (Group)
├── Entity A (India HQ)
│   ├── Bank recon
│   ├── AP/AR
│   └── GST recon
├── Entity B (Manufacturing subsidiary)
│   ├── Bank recon
│   └── AP/AR
└── Entity C (Trading arm)
    ├── GST recon
    └── AR recon
```

---

## 13. Exception Resolution Playbooks

> **Gap identified in original plan:** No resolution playbooks or templates were designed. For enterprise users, canned resolution guides reduce investigation time and improve consistency.

### 13.1 What Is a Playbook

A playbook is a configurable resolution guide attached to an exception type or exception code. It tells the assignee:
- What to check first
- What documents to gather
- What the typical root causes are
- What resolution options exist and what each means for downstream books

### 13.2 Default Playbooks (Shipped Out of the Box)

**Bank Amount Mismatch (BANK-AMT):**
1. Check if the amount difference matches any bank charges or deductions
2. Check if a credit note or reversal applies
3. Review prior period entries for a delayed booking
4. Resolution options: bank charge write-off, adjustment entry required, counterparty follow-up, manual match accepted

**AP Duplicate Invoice (AP-DUP):**
1. Confirm with vendor if invoice was resubmitted
2. Check if an earlier payment was reversed and re-invoiced
3. Check PO for partial delivery scenarios
4. Resolution options: hold duplicate for vendor confirmation, raise debit note, reject second invoice

**GST Not Filed by Vendor (GST-NOT-FILED):**
1. Check vendor filing status on GST portal
2. Send follow-up to vendor with filing reminder
3. If vendor is consistently non-compliant, flag for vendor risk review
4. Resolution options: defer ITC claim, provisional reversal, escalate to procurement for vendor action

### 13.3 Custom Playbooks

- Admins can create custom playbooks for organization-specific exception types
- Playbooks are versioned; changes do not retroactively alter closed exceptions
- Playbooks can include links to internal SOPs, forms, or contact directories

---

## 14. Functional Requirements

### 14.1 Reconciliation Engine

- Import CSV, Excel, JSON, OFX (bank), and MT940 (bank)
- ERP connector import for Tally, Zoho, SAP (phased)
- GSTR-2B JSON import for GST module
- Standardize records into internal schemas with field mapping configuration
- Deterministic matching by amount, date, reference, vendor, invoice, account, GSTIN
- Tolerance-based matching: configurable date window and amount tolerance per entity and module
- Fuzzy matching for vendor names, reference fields, and narrative descriptions
- Create exception records when matching confidence is below configurable threshold
- Support partial matches (one-to-many, many-to-one) in addition to one-to-one
- Batch processing with async job queue and status tracking

### 14.2 Exception Management

- Unified exception table across bank, AP, AR, GST, TDS, and intercompany
- Status workflow: detected → routed → investigating → pending approval → resolved → approved → closed
- Severity levels: low, medium, high, critical (configurable thresholds by amount and exception type)
- Attachments (PDF, image, Excel), inline comments, and evidence linking
- Bulk operations: bulk resolve, bulk reassign, bulk export
- Exception aging counters with visual indicators
- Follower/subscriber model: users can follow an exception to receive update notifications without being the assignee

### 14.3 Routing Engine

- Rules based on: exception code, amount threshold, entity, account type, vendor, team, currency, and GST category
- Round-robin or explicit role-based assignment
- Automatic escalation after SLA breach with configurable escalation path
- Optional approval routing for high-value or sensitive exceptions
- Routing rules are versioned; changes apply to new exceptions only

### 14.4 Audit and Reporting

- Immutable action logs: every state change, comment, assignment, approval, and escalation is recorded with user ID and timestamp
- Audit log export in CSV and PDF for regulatory and internal audit use
- Exception aging dashboard (open count by age bucket: 0–3 days, 4–7, 8–14, 15–30, 30+)
- Resolution time analytics (average, median, P90 by exception type and team)
- SLA breach rate tracking
- Repeat exception analysis (recurring exceptions by root cause code)
- GST-specific reports: ITC eligibility variance, vendor filing status, period-wise mismatch summary
- Downloadable reports in CSV and Excel

### 14.5 AI Features

- PDF-to-Markdown conversion for vendor invoices, bank statements, and GST documents
- Structured field extraction from converted Markdown (invoice number, date, amount, GSTIN, HSN code)
- AI fallback for exception classification when deterministic rules are insufficient
- AI-generated analyst context summary for each exception (what happened, why it likely mismatched)
- Suggested resolution path based on exception type and historical resolution patterns
- AI is invoked only after deterministic and rule-based steps have run

### 14.6 Configuration & Administration

- Entity setup: name, GSTIN, functional currency, fiscal year, contact details
- Team and role management
- Routing rule builder (no-code, condition-action interface)
- SLA policy configuration per exception type and severity
- Escalation path configuration
- Playbook editor
- Tolerance setting per module
- Field mapping configuration for CSV imports

---

## 15. Non-Functional Requirements

### 15.1 Performance

- Exception list load: under 1 second for up to 10,000 open exceptions
- Batch processing: 10,000 rows in under 3 minutes; 100,000 rows in under 20 minutes
- AI response (summary generation): under 5 seconds per exception
- API response (read endpoints): P95 under 300ms

### 15.2 Scalability

- Horizontal scaling for batch processing workers
- Tenant-level data isolation in shared database (row-level security via tenant_id)
- Support for 100 concurrent users per enterprise tenant without degradation

### 15.3 Availability

- Target uptime: 99.5% for Starter tier, 99.9% for Enterprise tier
- Planned maintenance windows communicated 48 hours in advance
- No planned maintenance during Indian month-end (25th to 5th of following month)

### 15.4 API Design

- RESTful, versioned (v1, v2 pattern), JSON
- API rate limiting: 1,000 requests per minute per tenant (configurable for enterprise)
- API keys per integration with scoped permissions (read-only, write, admin)
- Webhook delivery with retry and replay

### 15.5 Accessibility

- Web UI meets WCAG 2.1 AA standard
- Keyboard navigable exception queue and detail views
- Screen-reader compatible data tables

### 15.6 Localization

- Default language: English
- Number formatting configurable per entity (Indian lakh/crore vs international million/billion)
- Date format configurable (DD/MM/YYYY default for India)
- Currency symbol per entity

---

## 16. Security & Compliance Framework

> **Gap identified in original plan:** Security was listed at a high level (RBAC, maker-checker) with no depth. Enterprise buyers conduct security assessments. This section fills that gap.

### 16.1 Authentication

- Email + password with bcrypt hashing
- Multi-Factor Authentication (MFA): TOTP (Google Authenticator compatible) and SMS OTP — mandatory for admin roles, optional for standard users, enforceable by tenant admin
- Single Sign-On (SSO): SAML 2.0 and OAuth 2.0 / OIDC — available on Growth and Enterprise tiers
- Session management: configurable session timeout, concurrent session limit, forced logout on password change

### 16.2 Authorization

- Role-Based Access Control (RBAC) with pre-defined roles: Viewer, Analyst, Approver, Manager, Admin
- Custom roles configurable on Enterprise tier
- Entity-scoped roles: a user can be Analyst in Entity A and Viewer in Entity B
- Attribute-level permissions: some roles can view exception amount but not supplier details (for sensitive categories)
- Maker-checker enforcement: configurable by exception type, amount threshold, and entity

### 16.3 Data Security

- **Encryption at rest**: depend on managed provider defaults for hosted database and encrypted local volumes where self-hosted
- **Encryption in transit**: TLS 1.2 minimum, TLS 1.3 preferred; HSTS enforced
- **PII handling**: vendor bank details, GSTIN, PAN, and individual names flagged as PII fields; masked in logs and AI prompts
- **Data masking in LLM calls**: PII fields are replaced with tokens before sending to Groq; original values are substituted back in the response
- **Audit log integrity**: audit log records are append-only with a hash chain; tampering detection on export

### 16.4 Network Security

- IP allowlisting configurable per tenant (enterprise feature)
- VPN access option for on-premise deployment variant
- CSRF protection on all state-changing endpoints
- Rate limiting at API gateway and application layer
- Input validation and output encoding on all user-supplied data
- File upload scanning: virus scan on all uploaded documents before storage

### 16.5 Compliance Certifications Roadmap

| Milestone | Target Timing |
|---|---|
| SOC 2 Type I audit | 12 months after launch |
| SOC 2 Type II audit | 24 months after launch |
| ISO 27001 certification | 24 months after launch |
| DPDP Act (India) compliance documentation | Before enterprise sales launch |
| GDPR readiness documentation | Before international expansion |

### 16.6 Penetration Testing

- Pre-launch: third-party penetration test on the web application and API
- Annual: repeat third-party pentest
- Quarterly: internal vulnerability scan
- Bug bounty program launched alongside SOC 2 Type I

### 16.7 Indian Regulatory Considerations

- Data residency: choose non-AWS hosting that best aligns with customer and compliance needs; formal India-only residency is a later enterprise requirement
- DPDP Act compliance: consent management for personal data, data principal rights (access, correction, erasure) supported
- GST data: no GST portal credentials stored; only processed JSON files retained per data retention policy
- RBI guidelines: for bank and NBFC customers, data handling follows applicable RBI circulars

---

## 17. Data Governance & Retention

> **Gap identified in original plan:** No data retention, archival, or migration policy was designed.

### 17.1 Data Retention Policy

| Data Category | Active Retention | Archival Retention | Deletion |
|---|---|---|---|
| Exception records (open) | Indefinite (while open) | — | Never |
| Exception records (closed) | 7 years active | After 7 years, archive | Configurable per tenant |
| Audit logs | 7 years active | — | Cannot be deleted |
| Uploaded files (invoices, statements) | 3 years active | Archive after 3 years | Configurable |
| Batch import files | 90 days | — | Auto-deleted |
| AI interaction logs | 30 days | — | Auto-deleted |
| User session logs | 90 days | — | Auto-deleted |

- Retention periods configurable per entity for Enterprise tier (within regulatory minimums)
- 7-year default aligns with Indian income tax record retention requirements
- DPDP Act erasure requests honored for personal data; financial records exempted per applicable law

### 17.2 Data Archival

- Closed exceptions older than 3 years move to a cold storage tier (read-only access)
- Archived data is searchable but not editable
- Archive export available for auditors in structured JSON or CSV

### 17.3 Data Migration

> **Gap identified:** No plan for migrating historical reconciliation data from existing tools.

**Migration support:**
- Standard CSV import template for historical exception records
- Bulk status import: import closed historical exceptions with resolution codes and dates (for audit continuity)
- Tally ledger history import for bank reconciliation seed data
- Migration guide provided in onboarding package for Enterprise tier
- Professional services offering for large-scale historical data migration (billable)

### 17.4 Backup & Disaster Recovery

> **Gap identified:** No backup or DR plan was included.

- **Database backup**: rely on managed Postgres provider backup capabilities on the chosen free tier where available, plus scheduled logical dumps for local retention
- **File storage backup**: local export during MVP; secondary storage sync added when object storage is introduced
- **Recovery approach**: best-effort recovery for MVP, with enterprise-grade RTO and RPO formalized only after paid infrastructure adoption
- **Status page**: optional lightweight status page in later phases

---

## 18. Technical Architecture

### 18.1 Architecture Philosophy

Start as a modular monolith. Extract services as runtime behavior and team structure require it, not before. The interface contracts between modules should be clean from day one even when running in the same process.

### 18.2 Service Boundaries

#### A. Reconciliation Engine

**Purpose:** Ingest data, normalize schemas, run matching rules, detect exceptions.

**Technology:** Django app within the monolith. Async processing via Celery workers.

**Why it has clean boundaries:** CPU-heavy matching logic has a distinct runtime profile. When batch volumes grow, worker count scales independently.

#### B. Exception Service

**Purpose:** Own the exception lifecycle state machine, store evidence and comments, serve the exception API.

**Technology:** Django app. PostgreSQL as system of record.

**Why it has clean boundaries:** Central business state engine. All other services interact with exceptions through this service's API, never directly against the exceptions table.

#### C. Routing Engine

**Purpose:** Apply assignment rules, manage SLAs, trigger escalations.

**Technology:** Django app with a rule evaluation engine. Rules stored in the database and evaluated at exception creation and on schedule (for SLA checks).

**Why it has clean boundaries:** Rule logic changes frequently; isolating it prevents breakage in other modules.

#### D. AI & Document Service

**Purpose:** PDF-to-Markdown conversion, structured field extraction, exception classification, analyst summaries.

**Technology:** FastAPI service (separate process even in monolith phase due to different runtime).

**External dependency:** Groq API for LLM inference.

**Why separate from day one:** Different latency profile (inference can take 2–5 seconds), external dependency on Groq, easier to scale and experiment independently.

#### E. Notification Service

**Purpose:** Deliver notifications via in-app, email, SMS, and webhook channels.

**Technology:** Django app + Celery. Email via Brevo or Resend free tier. SMS and WhatsApp are deferred until paid or enterprise phases.

**Why separate boundary:** Notification logic changes often (new channels, new event types). Isolating prevents notification bugs from affecting core exception logic.

#### F. Integration Adapter Layer

**Purpose:** Receive data from ERP connectors, bank feeds, and GST portal. Transform to internal schema. Hand off to Reconciliation Engine.

**Technology:** Django app. File-based adapters are simple Python transformers. API-based adapters use OAuth flows.

### 18.3 What Stays Together Initially

- User management and authentication
- Admin configuration (routing rules, SLA policies, entity setup)
- Reporting and dashboard APIs
- Frontend serving

### 18.4 Caching Strategy

> **Gap identified:** Original plan had "No Redis in first version" without addressing caching needs.

**Phase 1 (MVP without Redis):**
- Database query result caching via Django's per-view cache decorator (in-memory)
- Exception list API responses cached for 30 seconds with cache invalidation on write
- Batch processing status stored in the database (sufficient for low concurrency)

**Phase 2 (Optional Redis introduced):**
- Redis is added only after real load justifies it, such as sustained concurrency, growing background-job backlog, or session and cache pressure
- Until then, Celery can use the Django database backend and low-volume caching can remain in-process or database-backed
- When introduced later, Redis is used for Celery broker, response caching, SLA countdown timers, and session optimization

### 18.5 Tech Stack Summary (Free-Tier-First)

| Layer | Technology | Rationale |
|---|---|---|
| Backend (main) | Django 5.x + DRF | Robust ORM, admin, auth, rapid development |
| Backend (AI service) | FastAPI | Async-first, low overhead for I/O-heavy AI calls |
| Frontend (MVP) | React (Vite) + TypeScript + Tailwind CSS | Enterprise-grade UX from day one without a rewrite |
| Primary database | PostgreSQL 16 on Neon or Supabase free tier | Managed Postgres without AWS and suitable for MVP workloads |
| Secondary storage | MongoDB (Phase 3+) | Optional for unstructured AI logs and raw extracted documents |
| Task queue | Celery | Mature, Django-native |
| Message broker | Django DB backend in Phase 1; Redis only in later phases | Free-tier-first approach with clean upgrade path |
| LLM inference | Groq API | Low latency, cost-effective for selective AI calls |
| Object storage | Local filesystem in dev; Cloudflare R2 or Supabase Storage later | Avoid AWS and stay free-tier-friendly |
| Email | Brevo or Resend free tier | Transactional email for assignment, SLA, and batch notifications |
| SMS | None in MVP; MSG91 or Twilio later if needed | Keep MVP free-tier-first and reduce complexity |
| Containerization | Docker + Docker Compose | Local dev and simple deployment |

---


### 18.6 Free-Tier Deployment Profile

To keep the first version fully free-tier-first and avoid AWS entirely, ExceptionIQ v3 uses the following practical deployment profile:

- **Frontend hosting:** Cloudflare Pages, Vercel free tier, or Netlify free tier for the React application.
- **Backend hosting:** start locally with Docker Compose for development; for public demos use a free or hobby-tier container host only when required.
- **Database:** Neon or Supabase PostgreSQL free tier.
- **Object/file storage:** local filesystem first; Cloudflare R2 or Supabase Storage only when shared file storage becomes necessary.
- **Email:** Brevo or Resend free tier.
- **Task execution:** Celery with the Django database backend in early versions; no Redis in the first version.
- **Monitoring:** lightweight logs and health endpoints first; advanced observability added later.

This profile is intentionally optimized for low cash burn, learning speed, and shipping an MVP without paid infrastructure commitments.

---

## 19. Frontend Strategy

> **Gap identified in original plan:** Streamlit was proposed as the frontend. Streamlit is adequate for internal prototyping but is unsuitable for an enterprise-grade product sold to corporate and MSME customers. It has limited customization, poor performance on complex data tables, no production-grade authentication UX, and no mobile responsiveness. This section replaces the Streamlit plan.

### 19.1 Decision: React from MVP

**Use React (Vite + TypeScript) as the frontend from day one.** The MVP will be a lean React app with essential screens only. The effort delta between a Streamlit MVP and a React MVP is 2–4 weeks, and the payoff is:
- A product that looks and feels enterprise-ready from the first demo
- No rewrite tax when moving to "real" frontend
- Mobile responsiveness built in with Tailwind CSS
- Proper authentication flows (MFA, SSO) that Streamlit cannot support

### 19.2 MVP Frontend Screens (Phase 1)

1. **Login / MFA** — email + password, TOTP second factor
2. **Exception Queue** — filterable, sortable table; status chips; SLA countdown badges
3. **Exception Detail** — transaction context, variance explanation, comment thread, attachment list, status action buttons
4. **Upload / Ingest** — drag-and-drop file upload, field mapping preview, batch submission
5. **Batch Status** — progress indicator, summary on completion, error download
6. **Basic Dashboard** — open exception count by type, aging chart, SLA breach count
7. **Admin: Routing Rules** — simple condition-action rule builder
8. **Admin: Team Management** — users, roles, entity assignment

### 19.3 Mobile Responsiveness

- Exception queue and detail views are mobile-responsive from day one
- Approval workflow (approve / reject with comment) is optimized for mobile
- Notification center accessible on mobile
- Upload is desktop-primary (file handling) but dashboard and approvals work on phone

### 19.4 Later Frontend Enhancements (Phase 3+)

- Multi-entity switcher and group dashboard
- Customizable dashboard widgets
- In-app playbook viewer
- Bulk operation interface
- GST reconciliation-specific views
- Excel-like exception grid for power users

---

## 20. API Design

### 20.1 Versioning

All APIs are versioned at the path level: `/api/v1/...`. Breaking changes trigger a new version. Old versions are supported for 12 months after a new version is published.

### 20.2 Authentication

All API endpoints require authentication via:
- Session cookie (for browser-based UI calls)
- API key in `Authorization: Bearer <key>` header (for integration calls)

API keys are scoped to: `read`, `write`, `admin`. Keys are tenant-scoped and can be further scoped to a specific entity.

### 20.3 Rate Limiting

- Default: 1,000 requests per minute per API key
- Batch upload endpoints: 10 requests per minute (large payloads)
- AI endpoints: 60 requests per minute (LLM cost protection)
- Enterprise tenants: configurable limits

Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 20.4 Recon APIs

```
POST   /api/v1/recon/bank/upload
POST   /api/v1/recon/ap/upload
POST   /api/v1/recon/ar/upload
POST   /api/v1/recon/gst/upload
POST   /api/v1/recon/tds/upload
POST   /api/v1/recon/run/{batch_id}
GET    /api/v1/recon/batches
GET    /api/v1/recon/batches/{batch_id}/status
GET    /api/v1/recon/batches/{batch_id}/errors
```

### 20.5 Exception APIs

```
GET    /api/v1/exceptions
GET    /api/v1/exceptions/{id}
POST   /api/v1/exceptions/{id}/comment
POST   /api/v1/exceptions/{id}/resolve
POST   /api/v1/exceptions/{id}/approve
POST   /api/v1/exceptions/{id}/reject
POST   /api/v1/exceptions/{id}/reassign
POST   /api/v1/exceptions/{id}/escalate
POST   /api/v1/exceptions/{id}/follow
POST   /api/v1/exceptions/bulk/resolve
POST   /api/v1/exceptions/bulk/reassign
GET    /api/v1/exceptions/{id}/audit-log
```

### 20.6 Routing APIs

```
GET    /api/v1/routing/rules
POST   /api/v1/routing/rules
PUT    /api/v1/routing/rules/{id}
DELETE /api/v1/routing/rules/{id}
POST   /api/v1/routing/apply/{exception_id}
POST   /api/v1/routing/escalate/{exception_id}
GET    /api/v1/routing/sla-policies
POST   /api/v1/routing/sla-policies
```

### 20.7 AI APIs

```
POST   /api/v1/ai/parse-document
POST   /api/v1/ai/extract-fields
POST   /api/v1/ai/classify-exception
POST   /api/v1/ai/summarize-exception
```

### 20.8 Notification & Webhook APIs

```
GET    /api/v1/notifications
POST   /api/v1/notifications/mark-read
GET    /api/v1/webhooks
POST   /api/v1/webhooks
PUT    /api/v1/webhooks/{id}
DELETE /api/v1/webhooks/{id}
GET    /api/v1/webhooks/{id}/deliveries
POST   /api/v1/webhooks/{id}/replay/{delivery_id}
```

### 20.9 Reporting APIs

```
GET    /api/v1/reports/exception-aging
GET    /api/v1/reports/resolution-time
GET    /api/v1/reports/sla-breach-rate
GET    /api/v1/reports/match-rate
GET    /api/v1/reports/gst-variance
GET    /api/v1/reports/audit-trail
POST   /api/v1/reports/export
```

---

## 21. Data Model

### 21.1 Core PostgreSQL Entities

**Tenant & Organization**
- `tenants` (id, name, plan_tier, status)
- `entities` (id, tenant_id, name, gstin, currency, fiscal_year_start)
- `users` (id, tenant_id, email, password_hash, mfa_enabled, status)
- `roles` (id, tenant_id, name, permissions_json)
- `user_entity_roles` (user_id, entity_id, role_id)

**Reconciliation Data**
- `reconciliation_batches` (id, entity_id, module, status, total_rows, matched_rows, exception_count, error_count, created_by, created_at)
- `bank_entries` (id, batch_id, entity_id, transaction_date, amount, currency, reference, narration, counterparty, raw_json)
- `ledger_entries` (id, batch_id, entity_id, entry_date, amount, currency, account_code, reference, narration, raw_json)
- `purchase_orders` (id, batch_id, entity_id, po_number, vendor_id, po_date, line_items_json, total_amount, currency)
- `grns` (id, batch_id, entity_id, grn_number, po_id, vendor_id, grn_date, received_items_json)
- `invoices` (id, batch_id, entity_id, invoice_number, vendor_id, invoice_date, amount, tax_amount, currency, gstin_supplier, gstin_recipient, hsn_json)
- `payments` (id, batch_id, entity_id, payment_reference, customer_id, payment_date, amount, currency, bank_reference)
- `receipts` (id, batch_id, entity_id, receipt_reference, bank_date, amount, currency, narration)
- `gstr2b_entries` (id, batch_id, entity_id, supplier_gstin, invoice_number, invoice_date, taxable_amount, igst, cgst, sgst, cess, filing_period)
- `purchase_register_entries` (id, batch_id, entity_id, supplier_gstin, invoice_number, invoice_date, taxable_amount, igst, cgst, sgst, cess, itc_eligible)

**Exception Core**
- `exceptions` (id, entity_id, module, exception_code, severity, status, source_record_ids_json, amount_difference, date_difference, currency, confidence_score, assigned_to, sla_deadline, escalated_to, escalated_at, root_cause_code, resolution_code, created_at, updated_at, resolved_at, closed_at)
- `exception_comments` (id, exception_id, user_id, content, created_at)
- `exception_attachments` (id, exception_id, user_id, file_name, storage_key, file_size, mime_type, created_at)
- `exception_followers` (exception_id, user_id)

**Routing & SLA**
- `routing_rules` (id, entity_id, name, conditions_json, actions_json, priority, is_active)
- `sla_policies` (id, entity_id, exception_code, severity, response_hours, resolution_hours, escalation_path_json)
- `assignments` (id, exception_id, assigned_to, assigned_by, assigned_at, reason)
- `escalations` (id, exception_id, escalated_to, escalated_by, escalated_at, reason, sla_level)

**Approval**
- `approval_requests` (id, exception_id, requested_by, requested_at, approver_id, status, responded_at, response_note)

**Audit**
- `audit_logs` (id, tenant_id, entity_id, exception_id, user_id, action_type, before_state_json, after_state_json, ip_address, created_at)

**Notifications & Webhooks**
- `notifications` (id, user_id, event_type, exception_id, message, is_read, created_at)
- `webhooks` (id, tenant_id, url, secret, events_json, is_active)
- `webhook_deliveries` (id, webhook_id, event_type, payload_json, response_status, delivered_at, attempts)

**Playbooks**
- `playbooks` (id, entity_id, exception_code, title, steps_json, resolution_options_json, version, created_at)

### 21.2 Key Indexes

- `exceptions(entity_id, status, severity)` — exception queue queries
- `exceptions(assigned_to, status)` — analyst view
- `exceptions(sla_deadline)` — SLA breach detection
- `audit_logs(exception_id, created_at)` — exception history
- `gstr2b_entries(entity_id, supplier_gstin, invoice_number, filing_period)` — GST matching
- `bank_entries(entity_id, transaction_date, amount)` — bank matching

---

## 22. Matching & AI Strategy

### 22.1 Deterministic First

All matching runs deterministic rules before any AI or fuzzy logic.

**Bank reconciliation:**
1. Exact: amount + reference (normalized)
2. Amount + date window (configurable ±3 days)
3. Amount + narration keyword match

**AP three-way match:**
1. Exact: invoice number + vendor GSTIN + amount + tax amount
2. PO number + vendor + quantity + unit rate (with tolerance)
3. GRN number + invoice number

**GST reconciliation:**
1. Exact: supplier GSTIN + invoice number + filing period + tax amounts
2. Supplier GSTIN + invoice number + amount tolerance ±2%

### 22.2 Rule-Based Tolerance

- Date tolerance: configurable per entity (default ±3 calendar days for bank, ±30 days for AP)
- Amount tolerance: configurable per entity (default ±₹100 or ±0.5% whichever is higher)
- Name similarity threshold: configurable (default 85% similarity for vendor name fuzzy match)
- GST amount tolerance: ±₹1 (rounding differences only)

### 22.3 AI Fallback

AI (Groq) is invoked only when:
- Reference fields are broken, truncated, or contain non-standard formats
- Vendor name appears in multiple formats and rule-based normalization has not resolved to a match
- PDF invoice extraction requires interpretation of a non-standard layout
- An analyst context summary is requested
- Exception classification confidence from rules is below threshold

**AI cost controls:**
- Every document is converted to Markdown before sending to the LLM (reduces tokens by 40–70%)
- Only the relevant excerpt is sent (not the entire document)
- AI calls are batched where possible
- AI response caching: if the same document hash has been processed before, return cached result
- Monthly AI spend cap configurable per tenant (alert at 80%, hard stop at 100%)

### 22.4 Matching Confidence Score

Every matched pair gets a confidence score (0–100):
- 100: exact deterministic match
- 80–99: deterministic match with tolerance applied
- 60–79: fuzzy match, auto-accepted above threshold
- Below 60: exception created, human review required

---

## 23. Infrastructure & DevOps

### 23.1 Environments

> **Gap identified:** No environment strategy was defined.

| Environment | Purpose | Deployment |
|---|---|---|
| Local (dev) | Individual developer, Docker Compose | Developer machine |
| Development | Shared dev environment, CI deploys | Shared cloud instance |
| Staging | Pre-production, full data clone (anonymized) | Cloud, mirrors production |
| Production | Live, customer-facing | Cloud, HA setup |

Environment-specific configuration is managed via environment variables (`.env` files locally, secrets manager in cloud).

### 23.2 CI/CD Pipeline

> **Gap identified:** No CI/CD plan was included.

**Tooling:** GitHub Actions (or GitLab CI)

**Pipeline stages:**
1. **Lint**: Ruff (Python), ESLint (TypeScript)
2. **Test**: pytest (unit + integration), Vitest (frontend unit)
3. **Build**: Docker image build
4. **Security scan**: Bandit (Python), npm audit, container scan (Trivy)
5. **Deploy to staging**: auto-deploy on merge to `main`
6. **Deploy to production**: manual approval gate + auto-deploy on release tag

**Branch strategy:** feature branches → `main` (staging) → release tag (production)

### 23.3 Container Strategy

- Docker Compose for local development (all services + dependencies in one command)
- Production: start with a simple single-instance deployment on a free or low-cost host; Kubernetes is deferred until later growth
- Each service has its own Dockerfile with multi-stage build for small images
- Base images: Python 3.12-slim, Node 20-slim

### 23.4 File Size & Volume Limits

> **Gap identified:** No limits were defined.

| Resource | Limit | Notes |
|---|---|---|
| Single file upload | 50 MB | Covers most bank statements and invoice batches |
| Rows per batch | 200,000 | Above this, split into multiple batches |
| Attachments per exception | 20 files, 100 MB total | |
| API request body | 10 MB | |
| Concurrent batch jobs per tenant | 3 (Starter), 10 (Enterprise) | |

---

## 24. Observability & Ops

- Structured JSON logs from every service (Django, FastAPI, Celery)
- Correlation / request IDs across all services (injected at API gateway, propagated via headers)
- Key metrics (via Prometheus or CloudWatch):
  - Match rate per batch and per module
  - Exception creation rate
  - SLA breach count and rate
  - Average and P90 resolution time
  - AI API call latency and cost
  - Batch processing throughput (rows/second)
  - Error rate by endpoint
- Alerting: PagerDuty or email alerts on: error rate spike, SLA breach volume spike, Celery queue depth above threshold, AI cost spike
- Health endpoints: `GET /health` on each service
- Distributed tracing (optional, Phase 3): OpenTelemetry

---

## 25. Testing Strategy

- **Unit tests**: matching rules, routing rules, SLA calculations, tolerance logic, resolution state machine
- **Unit tests (AI service)**: Markdown conversion output, field extraction accuracy (golden-file tests with sample invoices)
- **State transition tests**: exception lifecycle state machine — all valid and invalid transitions
- **Integration tests**: end-to-end reconciliation batch (upload CSV → run matching → exceptions created → routed → resolved → audit log)
- **API tests**: contract tests for all public API endpoints
- **Frontend tests**: Vitest for components; Playwright for critical user flows (login, upload, resolve exception, approve)
- **Security tests**: SAST in CI, dependency vulnerability scan, input validation tests
- **Performance tests**: batch processing with 100,000-row dataset before each major release
- **Synthetic datasets**: covering all exception types, edge cases (duplicates, partial matches, tolerance boundaries), and invalid data scenarios

**Coverage targets:**
- Backend unit tests: 80% line coverage
- API integration tests: 100% of documented endpoints
- Critical frontend flows: 100% (login through exception resolution)

---

## 26. MVP Plan

### 26.1 MVP Goal

Demonstrate to one or two pilot customers (or internal synthetic users) that the platform can ingest bank reconciliation data, detect exceptions, route them to the right person, manage their lifecycle, and produce an audit trail — all from a professional web UI.

### 26.2 MVP Scope

**Module:** Bank reconciliation only.

**Features:**
- CSV upload for bank statement and ledger
- Deterministic matching engine
- Exception list with status, severity, age, and SLA countdown
- Exception detail with context, comment thread, and file attachment
- Routing rules (manual configuration by admin)
- Maker-checker approval (configurable)
- Audit trail per exception
- PDF-to-Markdown parser for bank statement PDFs
- AI-generated exception summary (Groq)
- Email notification on assignment and SLA breach
- Basic dashboard (open count, aging, SLA breach rate)
- Role-based access (Analyst, Approver, Manager, Admin)

**Frontend:** React (Vite + TypeScript + Tailwind CSS) — not Streamlit.

**Not in MVP:**
- AP, AR, GST, TDS modules
- ERP connectors (CSV only)
- SMS / WhatsApp notifications
- Multi-entity support
- SSO
- Mobile app

### 26.3 Why Bank First

- Simplest schema (two sides: bank + ledger)
- Every business type needs it
- Easiest to generate realistic synthetic test data
- Best proving ground for the routing, lifecycle, and audit machinery that all other modules reuse

---

## 27. Expansion Roadmap

### Phase 1 — Bank Reconciliation MVP (Months 1–4)
- Bank reconciliation engine
- React frontend with all MVP screens
- Email notifications via Brevo or Resend free tier
- Audit trail
- PDF-to-Markdown + Groq integration
- CSV import
- Docker Compose local deployment

### Phase 2 — AI Enhancement & GST Module (Months 4–7)
- GSTR-2B vs purchase register reconciliation
- TDS reconciliation
- Improved AI classification and document extraction
- In-app notification center
- Batch status page
- Tally CSV adapter

### Phase 3 — AP Three-Way Match (Months 7–10)
- Purchase order, GRN, invoice model and matching
- Zoho Books connector
- SMS notifications (MSG91 or equivalent, only after paid phase)
- Bulk resolution
- Resolution playbooks
- Exception followers

### Phase 4 — AR Reconciliation & Multi-Entity (Months 10–14)
- AR payment reconciliation
- Customer payment and receipt matching
- Multi-entity support
- Cross-entity dashboard
- Intercompany reconciliation module

### Phase 5 — Enterprise Features & Integration Depth (Months 14–20)
- SSO (SAML 2.0 / OIDC)
- SAP and Oracle connectors
- IP allowlisting
- White-label theming
- SOC 2 Type I audit
- Kubernetes production deployment
- Webhook delivery system
- API v2

### Phase 6 — AI Intelligence Layer (Months 20–28)
- Root-cause recommendation engine (pattern detection across resolved exceptions)
- Preventive control suggestions based on recurring exception patterns
- Vendor risk scoring based on exception history
- Entity-level exception heatmaps
- AI-generated month-end summary report for CFO

---

## 28. Pricing & Commercial Model

> **Gap identified in original plan:** No pricing model was included. This is critical for sales readiness.

### 28.1 Pricing Tiers

#### Starter — MSME Self-Serve
**Price:** ₹2,499/month (annual) or ₹2,999/month (monthly)

**Includes:**
- 1 entity
- Up to 5 users
- Bank reconciliation module
- GST (GSTR-2B) reconciliation module
- CSV import only
- Email notifications
- Standard support (email, 48-hour SLA)
- 7-year audit retention

**Limits:**
- 10,000 transactions per month
- 5 active routing rules
- 5 GB file storage

#### Growth — Mid-Market
**Price:** ₹12,999/month (annual) or ₹15,999/month (monthly)

**Includes:**
- 3 entities
- Up to 25 users
- Bank + GST + AP three-way match + AR modules
- Tally and Zoho CSV adapters
- Email + SMS notifications
- Priority support (12-hour SLA)
- Custom routing rules (unlimited)
- Resolution playbooks (up to 20)
- Webhook (up to 5 endpoints)

**Limits:**
- 100,000 transactions per month
- 50 GB file storage

#### Enterprise — Corporate & Groups
**Price:** Custom (₹50,000–₹3,00,000/month based on entities, users, volume)

**Includes:**
- Unlimited entities
- Unlimited users
- All modules including intercompany and TDS
- SAP, Oracle, Microsoft Dynamics connectors
- SSO (SAML / OIDC)
- IP allowlisting
- MFA enforcement policy
- WhatsApp notifications
- Unlimited webhooks
- Dedicated CSM
- 4-hour support SLA
- Custom data retention configuration
- White-label theming option
- Professional services for onboarding and data migration
- SOC 2 report access (post-audit)

### 28.2 Add-Ons

| Add-On | Price |
|---|---|
| Additional entity (Growth tier) | ₹3,000/entity/month |
| Additional users (5-pack) | ₹1,500/month |
| Historical data migration (professional services) | ₹25,000–₹1,00,000 (one-time) |
| White-label licensing | Custom |
| API access (beyond standard rate limits) | Custom |

### 28.3 Free Trial

- 14-day free trial on Starter and Growth tiers (no credit card required)
- Sandbox environment with pre-loaded synthetic data for immediate demo experience

### 28.4 Commercial Terms

- Annual contracts: 2-month discount (effectively 10 months billed for 12)
- Multi-year contracts: additional negotiation available for Enterprise
- Monthly contracts: no lock-in, cancel anytime
- Startup program: 50% discount for companies under 3 years old with revenue under ₹5 crore

---

## 29. Go-to-Market Strategy

> **Gap identified in original plan:** No GTM strategy was included.

### 29.1 Phase 1 GTM: MSME via Accountant Channel (Months 1–8)

**Target:** CAs and accounting firms that manage 10–50 MSME clients each.

**Strategy:**
- Partner program for CAs: free seat for the CA, client seats billed
- CA becomes the implementation partner and onboarding agent for their clients
- Content: GST reconciliation education (CA CPE webinars, blog content, YouTube tutorials)
- Distribution: ICAI network, CA club forums, accounting software communities

**Why accountants first:**
- One CA partnership creates access to 10–50 MSMEs
- CAs are trusted advisors; their recommendation converts without a long sales cycle
- GST reconciliation is a pain CAs share with their clients

### 29.2 Phase 2 GTM: Mid-Market Direct (Months 6–14)

**Target:** Companies with 50–500 employees, dedicated finance teams, using Tally or Zoho.

**Strategy:**
- Inbound content: "How to reconcile GSTR-2B" searches, AP automation content
- Integration listing on Tally and Zoho marketplace
- Free trial with self-serve onboarding
- Inside sales team for trial-to-paid conversion

### 29.3 Phase 3 GTM: Enterprise (Months 12–24)

**Target:** Large corporates, business groups, NBFCs, manufacturing companies.

**Strategy:**
- Field sales with CFO / controller outreach
- Events: CFO forums, finance technology conferences, NASSCOM Finance SIG
- Reference customers from Phase 2 used as case studies
- Systems integrator (SI) channel: empanel 2–3 SIs who do SAP/Oracle implementations
- RFP response capability with security documentation, SOC 2 roadmap, and compliance pack

### 29.4 White-Label / OEM Channel (Month 18+)

**Target:** Banks offering treasury tools, accounting software vendors, NBFCs with internal reconciliation ops.

**Strategy:**
- Approach 3–5 banks with reconciliation pain in their treasury or transaction banking divisions
- License the engine under their brand
- Fixed annual license + per-transaction fee

### 29.5 Metrics

- Trial-to-paid conversion: target 25% within 30 days
- Net Revenue Retention (NRR): target 115% at 12 months (expansion via additional modules and entities)
- CAC payback: target under 9 months
- Month 12 ARR target: ₹1 crore (Starter + Growth pilots)
- Month 24 ARR target: ₹5 crore (mix of all tiers)

---

## 30. Customer Onboarding & Success

> **Gap identified in original plan:** No onboarding or customer success plan was included.

### 30.1 Self-Serve Onboarding (Starter Tier)

- Guided setup wizard on first login: entity details, GSTIN, fiscal year, first user invitation
- Pre-loaded synthetic data option: "Try with sample bank statement" for immediate demo experience
- In-app tooltip guidance on first use of each major screen
- Video library: 2–5 minute tutorials for each module
- Help center: searchable knowledge base
- Community forum for Starter users

### 30.2 Assisted Onboarding (Growth Tier)

- Welcome call with customer success team (1 hour) within 3 business days of sign-up
- Data migration template provided for historical exception records
- Routing rule configuration workshop (1-hour video call)
- 30-day check-in call to review adoption and answer questions

### 30.3 Enterprise Onboarding (Enterprise Tier)

- Dedicated Customer Success Manager (CSM) assigned at contract signature
- Onboarding project plan with milestones (target: go-live in 6–8 weeks)
- Professional services for: ERP connector setup, historical data migration, custom playbook authoring
- User training sessions (live, per team: AP team, AR team, GST team, admin)
- UAT support: help customer run parallel reconciliation during validation period
- Hypercare period: 30 days post go-live with daily check-ins

### 30.4 Ongoing Customer Success

- Monthly product update email with release notes
- Quarterly business review (QBR) for Enterprise: metrics review, roadmap preview, expansion discussion
- In-app release notes popover for significant feature releases
- NPS survey at 30, 90, and 180 days
- Escalation path: CSM → Head of Customer Success → CTO (for critical issues)

### 30.5 Training & Documentation

- User documentation: Gitbook or similar, organized by module and role
- API documentation: Swagger / OpenAPI spec auto-generated, with examples
- Admin guide: routing rule builder, SLA configuration, user management
- CA partner guide: managing multiple client accounts
- Release notes: published on documentation site and in-app

---

## 31. White-Labeling & OEM Option

> **Gap identified in original plan:** No white-label option was mentioned. This is a high-value channel for banks and accounting software vendors.

### 31.1 What Is Offered

- Custom domain (recon.clientbank.com instead of app.exceptioniq.in)
- Client's logo and color scheme in the UI
- Client-branded email notifications
- Removal of ExceptionIQ branding from all user-facing surfaces
- Separate tenant database isolation (logical or physical)

### 31.2 Technical Approach

- Theming via CSS custom properties (primary color, logo URL, font) configurable per tenant
- White-label flag in tenant configuration disables all ExceptionIQ brand references
- Custom domain support via DNS CNAME and SSL certificate provisioning (Let's Encrypt or client-provided cert)

### 31.3 Commercial Model

- One-time setup fee: ₹2,00,000
- Annual license: based on user count or transaction volume (negotiated)
- Revenue share option for accounting software vendors who resell seats

---

## 32. Risk Register & Mitigations

### Product & Market Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Overbuilding before market validation | Medium | High | Bank recon MVP first; no new module until first paying customer |
| GST module complexity underestimated | Medium | Medium | Treat GSTR-2B matching as a separate 6-week workstream; timebox |
| MSME adoption slower than expected | Medium | High | CA channel partnership for demand aggregation; low price point |
| Enterprise sales cycle too long for early revenue | High | Medium | Target Growth tier as primary revenue source in first 18 months |
| Competitor adds exception orchestration to existing ERP | Low | High | Speed to market; deep India compliance as moat |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI (Groq) adds latency or cost beyond plan | Medium | Low | AI is always a fallback; deterministic engine is primary |
| Data quality of customer uploads is poor | High | Medium | Pre-validation step with error report; bad data handling (Section 9.6) |
| Tally integration more complex than expected | Medium | Medium | Start with CSV export from Tally; native connector deferred to Phase 3 |
| PostgreSQL performance at large enterprise volumes | Low | Medium | Connection pooling (PgBouncer), query optimization, read replicas |
| Streamlit rewrite cost (AVOIDED by switching to React in MVP) | N/A | High | ✅ Fixed: React from MVP (Section 19) |

### Compliance & Security Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Data breach | Low | Very High | Encryption at rest and in transit, MFA, penetration testing, minimal PII in AI calls |
| GST portal API changes breaking integration | High | Low | File upload is primary; portal API is additive only |
| DPDP Act non-compliance | Low | High | Data residency in India, consent framework, erasure support |

---

## 33. Success Metrics

### Product Health Metrics

| Metric | Definition | Target (12 months) |
|---|---|---|
| Match rate | Transactions matched / total transactions uploaded | > 85% |
| Exception rate | Exceptions created / total transactions | < 15% |
| Average time to resolve | Median hours from exception created to closed | < 48 hours |
| SLA breach rate | Exceptions breached SLA / total exceptions | < 10% |
| Repeat exception rate | Exceptions with same root cause in 90 days | < 20% |
| AI classification accuracy | Correct classification / AI-classified exceptions | > 90% |
| Batch processing success rate | Batches with zero critical errors / total batches | > 99% |

### Customer Metrics

| Metric | Target |
|---|---|
| Trial-to-paid conversion (30-day) | > 25% |
| Net Promoter Score (NPS) at 90 days | > 40 |
| Monthly Active Users / Total Licensed Users | > 70% |
| Churn rate (annual) | < 10% for Growth, < 5% for Enterprise |
| Net Revenue Retention (NRR) | > 115% |

### Business Metrics

| Metric | Month 12 Target | Month 24 Target |
|---|---|---|
| ARR | ₹1 crore | ₹5 crore |
| Paying customers | 20 | 100 |
| Enterprise accounts | 1–2 | 10 |
| CA partner accounts | 5 | 30 |

---

## 34. Implementation Checklist

### Product & Design
- [ ] Finalize exception taxonomy for all modules (bank, AP, AR, GST, TDS)
- [ ] Define exception codes and severity rules
- [ ] Define resolution codes (write-off, adjustment, counterparty action, system error, deferred)
- [ ] Define user roles and permission matrix
- [ ] Design UI wireframes for all MVP screens
- [ ] Write default playbooks for top 10 exception codes
- [ ] Define routing rule builder UX

### Engineering — MVP (Bank Reconciliation)
- [ ] Set up Django project structure with modular app boundaries
- [ ] Set up FastAPI project for AI service
- [ ] Set up React + Vite + TypeScript frontend
- [ ] Design and implement PostgreSQL schema (core tables)
- [ ] Implement bank reconciliation matching engine with tolerance rules
- [ ] Implement exception lifecycle state machine
- [ ] Implement routing rule engine (condition-action evaluator)
- [ ] Implement SLA countdown and breach detection (Celery periodic task)
- [ ] Build React frontend: login, exception queue, exception detail, upload, dashboard
- [ ] Build batch processing pipeline with async status tracking
- [ ] Implement bad data validation and error reporting
- [ ] Add PDF-to-Markdown pipeline (PyMuPDF / pdfplumber → Markdown)
- [ ] Add Groq integration for exception summaries
- [ ] Implement email notification system using Brevo or Resend free tier
- [ ] Implement audit log (append-only, all state transitions)
- [ ] Implement RBAC (roles, entity-scoped permissions)
- [ ] Implement MFA (TOTP)
- [ ] Write unit tests for matching engine, routing engine, state machine
- [ ] Write integration tests for end-to-end bank reconciliation batch
- [ ] Containerize with Docker Compose
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Set up a low-cost or free shared staging environment
- [ ] Third-party security review before first customer

### Engineering — Phase 2 (GST & AI)
- [ ] Implement GSTR-2B JSON parser and normalization
- [ ] Implement GST matching engine (GSTIN + invoice number + period)
- [ ] Build GST exception codes and routing
- [ ] Build GST-specific reports (ITC variance, vendor filing status)
- [ ] Implement TDS reconciliation (Form 26AS XML parser + books matching)
- [ ] Add in-app notification center
- [ ] Add Tally CSV export adapter
- [ ] Implement batch status page and email notification on completion

### Engineering — Phase 3+ (AP, AR, Enterprise)
- [ ] Implement AP three-way match engine (PO + GRN + invoice)
- [ ] Implement AR reconciliation engine
- [ ] Add multi-entity support and cross-entity dashboard
- [ ] Add Zoho Books connector (REST API)
- [ ] Add SMS notifications (MSG91)
- [ ] Implement bulk resolution
- [ ] Add webhook system
- [ ] Implement intercompany reconciliation module
- [ ] Add SSO (SAML 2.0)
- [ ] Add IP allowlisting
- [ ] Implement white-label theming
- [ ] Kubernetes production deployment
- [ ] Redis for caching and Celery broker
- [ ] SOC 2 Type I audit preparation

### Go-to-Market
- [ ] Set up CA partner program documentation and sign-up page
- [ ] Build sandbox environment with synthetic data
- [ ] Prepare security and compliance documentation pack
- [ ] Publish user documentation on Gitbook
- [ ] Create 5 onboarding tutorial videos
- [ ] Set up customer support workflow using free tools initially
- [ ] Set up status page (statuspage.io or self-hosted)
- [ ] Price page live on marketing site
- [ ] Free trial flow (no credit card) functional

---

*Document version: 2.0 | Updated from original reconciliation_exception_platform_plan.md | All gap annotations marked with (New) or (Enhanced) in section headers*
