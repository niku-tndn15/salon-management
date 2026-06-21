# Staff Performance & Commission Tracking — PRD Section

> **Document Version:** 1.0  
> **Last Updated:** 2026-06-14  
> **Module:** Staff Performance & Commission Tracking  
> **Parent Application:** Salon Management Web Application  
> **Status:** Draft — Ready for Review

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [User Stories](#2-user-stories)
3. [Detailed User Flows](#3-detailed-user-flows)
4. [Functional Requirements](#4-functional-requirements)
5. [Data Model](#5-data-model)
6. [Business Rules](#6-business-rules)
7. [Edge Cases](#7-edge-cases)
8. [Out of Scope for V1](#8-out-of-scope-for-v1)

---

## 1. Module Overview

### 1.1 Purpose

The **Staff Performance & Commission Tracking** module enables salon owners to manage their workforce end-to-end — from onboarding a new professional to tracking their daily service output, calculating earned commissions, and generating date-range performance reports. It simultaneously empowers individual staff members with a self-service view of their own productivity and earnings, without exposing any other staff member's data or sensitive business financials.

### 1.2 Scope

| In Scope | Out of Scope (V1) |
|---|---|
| Staff CRUD (Create, Read, Update, Deactivate) | Staff scheduling / shift management |
| Commission % setup per professional | Tiered or service-category-specific commission |
| Auto-calculation of commissions from service revenue | Salary, tips, or bonus tracking |
| Owner performance reports with custom date range | Payroll integration or payment disbursement |
| Staff self-view dashboard (own data only) | Multi-branch / multi-location support |
| Role-based access control (Owner / Billing / Staff) | Staff-to-staff messaging |
| Offline support with background sync | Public staff profile or booking widget |
| Deactivation logic with historical data preservation | Performance review workflows (ratings, feedback) |

### 1.3 Actors

| Actor | Role Description | Access Level |
|---|---|---|
| **Owner** | Salon owner or designated manager | Full access: staff CRUD, commission setup, all reports, all staff data |
| **Billing Person** | Front-desk / billing staff | Can view staff names to tag services; cannot view commission %, earnings, or performance reports |
| **Staff / Professional** | Hair stylists, beauticians, technicians, etc. | Can log in and view **only their own** performance dashboard and commission earnings |

---

## 2. User Stories

### Owner Stories

**US-01 — Add a New Staff Member**
> As an **Owner**, I want to add a new professional to the system so that they can be assigned services by the billing person and tracked for performance.

**Acceptance Criteria:**
- Form collects: Name, Phone, Role/Designation, Commission %, Join Date, Status (default Active)
- System auto-generates login credentials displayed to the Owner
- New staff member appears immediately in active staff list

---

**US-02 — Set or Update Commission Percentage**
> As an **Owner**, I want to set and update a staff member's commission percentage so that their earnings are correctly calculated from service revenue.

**Acceptance Criteria:**
- Commission % editable from the staff profile at any time
- Changes apply only to services logged **after** the change date (non-retroactive)
- Commission % field not visible to Billing Person or Staff roles

---

**US-03 — View a Staff Member's Daily Services**
> As an **Owner**, I want to see all services a specific staff member performed on a given day so that I can verify billing accuracy and assess daily output.

**Acceptance Criteria:**
- Owner selects a staff member and a specific date
- List shows: Service Name, Client Name, Amount, Time
- Daily totals (service count + revenue) shown at top

---

**US-04 — View Staff Performance Over a Custom Date Range**
> As an **Owner**, I want to generate a performance report for any staff member over a custom date range so that I can make informed decisions about commissions and staffing.

**Acceptance Criteria:**
- Date-range picker with start/end date
- Report shows: total services, total revenue, commission earned, average services/day
- Can filter by specific staff member or view all staff

---

**US-05 — Compare Staff Performance**
> As an **Owner**, I want to compare performance metrics across multiple staff members for a selected period so that I can identify top performers.

**Acceptance Criteria:**
- Comparative table: Staff Name, Designation, Services Count, Revenue, Commission Earned
- Sortable by any column
- Inactive staff excluded by default; toggleable

---

**US-06 — Deactivate a Staff Member**
> As an **Owner**, I want to deactivate a staff member who has left so that they can no longer log in, while preserving all historical records.

**Acceptance Criteria:**
- Inactive staff cannot log in
- Do not appear in billing person's staff dropdown
- All historical records remain intact and queryable

---

**US-07 — Reset Staff Member Login Credentials**
> As an **Owner**, I want to reset a staff member's login password so that they can regain access if they forget it.

**Acceptance Criteria:**
- Owner triggers password reset; system generates temp password
- Staff forced to change on next login

---

**US-08 — View Commission Calculation Breakdown**
> As an **Owner**, I want to see an itemised commission calculation for any staff member for a given period so that I can verify accuracy and justify payouts.

**Acceptance Criteria:**
- Shows each service, amount, commission % applied, commission earned
- If commission % changed during the period, report segments earnings by rate

---

### Staff / Professional Stories

**US-09 — Staff Self-Login and Dashboard Access**
> As a **Staff Member**, I want to log in with my own credentials and see my performance dashboard so that I have transparent visibility into my work output and earnings.

**Acceptance Criteria:**
- Lands on personal dashboard: today's services, current month totals, date-range selector
- Can only see own data — no other staff info accessible

---

**US-10 — Staff Views Their Own Service History**
> As a **Staff Member**, I want to browse my service history by date so that I can cross-check what has been logged.

**Acceptance Criteria:**
- Date or date-range selector
- Each entry shows: date, service name, revenue amount
- Read-only — cannot edit or delete

---

**US-11 — Staff Views Their Commission Earnings**
> As a **Staff Member**, I want to see my commission earnings for any selected period so that I know what I have earned.

**Acceptance Criteria:**
- Shows: total services, total revenue, commission %, commission earned
- If rate changed during period, shown in segments
- Commission % is read-only

---

**US-12 — Staff Changes Their Password**
> As a **Staff Member**, I want to change my login password so that I can keep my account secure.

**Acceptance Criteria:**
- Must provide current password first
- Must meet minimum requirements (8+ chars)

---

## 3. Detailed User Flows

### Flow A — Adding a New Professional

```
Owner → Staff Management → [Add New Staff]
  → Form: Name*, Phone*, Designation*, Commission %*, Join Date*, Status (Active)
  → [Save]
  → Validation runs:
       - Name: non-empty, max 100 chars
       - Phone: 10-digit, unique across all staff
       - Commission %: 0–100, max 2 decimal places
       - Join Date: not in the future
  → If valid:
       a. Record saved locally (IndexedDB)
       b. Login credentials auto-generated (username + temp password)
       c. Credentials shown to Owner with copy-to-clipboard
       d. If online: synced to server immediately
       e. If offline: queued for sync
  → Staff member can now log in
```

---

### Flow B — Owner Viewing Staff Performance Report

```
Owner → Reports → Staff Performance
  → Date Range picker: select Start Date and End Date
  → (Optional) Select specific staff member or "All Staff"
  → [Generate Report]
  → System queries local cache (offline-first); fetches fresh data if online
  → Calculates per staff member:
       • Services Count
       • Total Revenue (sum of service amounts)
       • Commission Earned (each service × applicable commission % from rate history)
       • Avg Services/Day
  → Table renders; sortable by any column
  → Click staff row → itemised service list:
       Date | Service | Amount | Commission % | Commission Earned
  → Navigate back → report state preserved for session
```

---

### Flow C — Staff Member Viewing Own Dashboard

```
Staff → Login → Lands on /my-performance
  → Dashboard shows:
       • Today tab: services logged today, count + revenue + commission preview
       • This Month summary card
       • Commission earned (current month)
  → Staff selects date range → filtered service list:
       Date | Service Name | Amount | Commission
  → Staff → My Earnings → period selector:
       Total revenue | Commission % | Total commission earned
       (Segmented by rate if rate changed in period)
  → Any attempt to access /staff-management, /reports/all, /billing → redirected
    with "Access Denied" toast
```

---

### Flow D — Commission Calculation for a Period

```
Example: Owner requests report for Staff X, May 1–31

Step 1 — Fetch Service Records
  → All billing records WHERE tagged_staff_id = X
    AND service_date BETWEEN May 1 AND May 31

Step 2 — Resolve Commission Rate Per Service
  → Check commission_rate_history for Staff X:
       Rate history: 2026-01-01 → 10%, 2026-05-15 → 12%
  → Services May 1–14 → 10% applied
  → Services May 15–31 → 12% applied

Step 3 — Calculate Per-Service Commission
  → commission_earned = service_amount × (applicable_rate / 100)
     Example: May 10 service ₹1,000 × 10% = ₹100
              May 20 service ₹1,500 × 12% = ₹180

Step 4 — Aggregate
  → total_services, total_revenue, total_commission
  → Segmented by rate period in the report

Step 5 — Render
  → Itemised table + period summary shown to Owner
```

---

## 4. Functional Requirements

### 4.1 Staff CRUD

| ID | Requirement |
|---|---|
| FR-01 | Owner MUST be able to create a staff profile with all required fields |
| FR-02 | Phone number MUST be unique across all staff records (active and inactive) |
| FR-03 | System MUST auto-generate login credentials on staff creation and display to Owner |
| FR-04 | Owner MUST be able to edit any field on a staff profile at any time |
| FR-05 | Owner MUST be able to set Status = "Inactive" (soft delete only — no hard deletion) |
| FR-06 | System MUST NOT allow permanent deletion of staff records that have associated services |
| FR-07 | Owner MUST be able to reactivate an Inactive staff member |
| FR-08 | System MUST display staff list filterable by Status, sortable by Name/Join Date/Designation |

### 4.2 Commission Setup

| ID | Requirement |
|---|---|
| FR-09 | Owner MUST be able to set Commission % (0–100, up to 2 decimal places) per staff member |
| FR-10 | Every Commission % change MUST be logged with new value and effective date |
| FR-11 | Commission % in effect on the **date of service** MUST be used — not the current rate |
| FR-12 | Commission % field MUST NOT be visible to Billing Person or Staff roles |

### 4.3 Performance Metrics

| ID | Requirement |
|---|---|
| FR-13 | System MUST calculate for any staff member and date range: services count, total revenue, total commission, avg services/day |
| FR-14 | Custom date-range selection MUST be supported; max range 365 days in V1 |
| FR-15 | Comparative view of all staff members side-by-side MUST be available for a selected range |
| FR-16 | Comparative view MUST be sortable by any metric column |

### 4.4 Date-Range Reports

| ID | Requirement |
|---|---|
| FR-17 | Date-range picker with start and end date fields MUST be provided |
| FR-18 | System MUST validate start date ≤ end date before generating report |
| FR-19 | Itemised commission breakdown report MUST show each service, amount, applicable rate, and commission earned |
| FR-20 | If commission % changed within selected range, report MUST segment by rate period |

### 4.5 Role-Based Access Control

| ID | Requirement |
|---|---|
| FR-21 | Staff role MUST only access their own data (server-enforced) |
| FR-22 | RBAC MUST be enforced at API level; server returns HTTP 403 for unauthorised requests |
| FR-23 | Billing Person MUST NOT access commission %, earnings data, or performance reports |
| FR-24 | Unauthorised access attempts MUST redirect to "Access Denied" screen |
| FR-25 | Owner MUST be able to reset any staff member's password |

### 4.6 Deactivation Behavior

| ID | Requirement |
|---|---|
| FR-26 | Inactive staff MUST NOT appear in the Billing Person's staff dropdown |
| FR-27 | Inactive staff MUST NOT be able to log in |
| FR-28 | Historical service records for deactivated staff MUST remain readable by Owner |
| FR-29 | Deactivation MUST be recorded with a timestamp and optional reason note |

### 4.7 Offline Behavior

| ID | Requirement |
|---|---|
| FR-30 | App MUST function in read mode while offline using cached data |
| FR-31 | Writes performed offline MUST be queued and synced automatically on reconnect |
| FR-32 | A visible offline indicator MUST be shown when device has no internet |
| FR-33 | Sync conflicts MUST be resolved using last-write-wins; conflicts logged for Owner review |

---

## 5. Data Model

### 5.1 Staff Entity

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `staff_id` | UUID | Yes (auto) | System-generated | Primary key |
| `name` | String | Yes | Non-empty, max 100 chars | Display name |
| `phone` | String | Yes | 10-digit, unique | Primary contact; basis for username |
| `designation` | String | Yes | Predefined list or free text | E.g., Hair Stylist, Beautician |
| `commission_pct` | Decimal | Yes | 0.00–100.00, max 2 decimal places | Current active rate |
| `join_date` | Date | Yes | Not in the future | Staff start date |
| `status` | Enum | Yes | `ACTIVE` \| `INACTIVE` | Default: `ACTIVE` |
| `deactivation_date` | Date | No | Required if status = INACTIVE | Set on deactivation |
| `deactivation_reason` | String | No | Max 500 chars | Optional Owner note |
| `username` | String | Yes (auto) | Unique, system-generated | Login credential |
| `password_hash` | String | Yes (auto) | bcrypt hashed | Never stored in plaintext |
| `force_password_change` | Boolean | Yes | Default: `true` | Reset to `false` after first change |
| `created_at` | Timestamp | Yes (auto) | | Record creation time |
| `updated_at` | Timestamp | Yes (auto) | | Last modification time |

### 5.2 Commission Rate History Entity

| Field | Type | Required | Notes |
|---|---|---|---|
| `rate_history_id` | UUID | Yes (auto) | Primary key |
| `staff_id` | UUID (FK) | Yes | References `Staff.staff_id` |
| `commission_pct` | Decimal | Yes | Rate at time of change |
| `effective_from` | Date | Yes | Current date at time of change |
| `effective_to` | Date | No | Null = currently active; filled when superseded |
| `changed_by` | UUID (FK) | Yes | Owner user ID — audit trail |
| `created_at` | Timestamp | Yes (auto) | |

### 5.3 Service Record (Reference Fields)

| Field | Type | Notes |
|---|---|---|
| `service_id` | UUID | Primary key (owned by Billing module) |
| `tagged_staff_id` | UUID (FK) | References `Staff.staff_id`; set by Billing Person |
| `service_date` | Date | Date service was performed |
| `service_name` | String | Name of the service rendered |
| `service_amount` | Decimal | Revenue amount |
| `client_name` | String | Optional |
| `created_at` | Timestamp | When billing record was created |

---

## 6. Business Rules

| Rule | Description |
|---|---|
| **BR-01** | Commission is calculated using the rate in effect **on the date of the service**, not at report-generation time. `commission_rate_history` is the source of truth. |
| **BR-02** | Commission % changes are effective from the **calendar day following the change** (i.e., `effective_from = change_date + 1 day`). All services on the change date itself use the prior rate. This eliminates intra-day ambiguity — no partial-day rate splits occur. |
| **BR-03** | Deactivating a staff member does NOT delete, anonymise, or hide their historical service records or commission data. |
| **BR-04** | Status = "Inactive" staff MUST NOT appear in any service-tagging UI. API-level enforcement required. |
| **BR-05** | Commission % is set individually per staff member. No salon-wide default rate in V1. |
| **BR-06** | Commission % of 0% is valid (e.g., salaried staff). Not flagged as an error. |
| **BR-07** | Staff role can only query data where `tagged_staff_id` = their own `staff_id`. Server-enforced. |
| **BR-08** | Offline write conflicts resolved by last-write-wins at field level; conflict log created for Owner review. |
| **BR-09** | Commission earnings attributed to the **service date**, not the billing entry date (supports retroactive billing). |
| **BR-10** | All required fields must be present before saving a staff profile — enforced at both client and API level. |
| **BR-11** | **Refunds and performance calculations:** When an invoice is fully or partially refunded, the refunded line item amounts are excluded from the tagged staff member's revenue and commission totals in all performance reports. A full refund zeroes all line items on that invoice. A partial refund reduces only the affected line item(s). Commission already shown in a prior report period is not retroactively restated — the correction appears in the report period in which the refund was processed. |

---

## 7. Edge Cases

| # | Scenario | Expected Behaviour |
|---|---|---|
| EC-01 | **Commission % changed mid-period** | System applies 10% to services before change date, 12% after. Report segments by rate period clearly. |
| EC-02 | **Staff deactivated mid-month** | Services up to deactivation date retained and reportable. No new services can be tagged post-deactivation. |
| EC-03 | **Staff reactivated after inactivity** | Historical records intact. Gap in records shown as zero services. Login re-enabled immediately. |
| EC-04 | **Report run after staff deactivation** | Inactive staff excluded by default in comparative view. Owner can toggle "Include Inactive." |
| EC-05 | **Two staff with same name** | Allowed — phone is the unique key. UI disambiguates with phone suffix or designation. |
| EC-06 | **Service entered with a past date (retroactive billing)** | Commission uses rate on `service_date`, not entry date. Service appears in reports for the past date. |
| EC-07 | **Staff views data while offline** | App loads from cache. Offline banner shown. Data reflects last sync. Staff informed new data may be pending. |
| EC-08 | **Commission % set to 0% and never updated** | Commission shows ₹0.00 — valid. Owner dashboard may show soft reminder "2 staff at 0% commission." |
| EC-09 | **Billing Person calls Staff Performance API directly** | Server returns HTTP 403 Forbidden. No data leaked. UI never renders the control. |
| EC-10 | **365-day report for 10 staff with 50 services/day** | Loading indicator shown if >3 seconds. Drill-down paginated (50/page). Aggregates computed server-side. |

---

## 8. Out of Scope for V1

| Feature | Reason Deferred |
|---|---|
| Tiered commission rates | Adds calculation complexity; covers <10% of salons |
| Service-category-specific commission | Requires billing module categorisation to mature first |
| Salary tracking | Payroll is a separate domain |
| Tips tracking | Cash-based; requires POS integration |
| Bonus or incentive management | Requires benchmarking logic not in V1 scope |
| Payroll disbursement / payment integration | Requires compliance review |
| Multi-branch / multi-location support | Architecture change required |
| Staff scheduling and shift management | Separate module |
| Staff rating and feedback system | Requires client-facing features not in V1 |
| Report export to PDF / Excel | Data structured for this; feature deferred to V2 |
| Email / SMS notifications to staff | Notification infrastructure deferred to V2 |
| Audit log UI for Owners | Data captured in V1; dedicated UI view is V2 |
| Commission approval workflow | V2 |

---

*End of PRD Section: Staff Performance & Commission Tracking*
