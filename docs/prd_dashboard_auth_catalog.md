# Salon Management Web Application — PRD
## Sections A, B & C: Owner Dashboard · Authentication & Role Management · Service Catalog

**Document Version:** 2.0
**Date:** 2026-06-17
**Status:** Revised — All Gaps Addressed
**Scope:** Single-salon, browser-based web application (counter laptop / tablet). Offline-first with background sync.

**Revision Notes (v1.0 → v2.0):** Added Average Ticket Value KPI, Service Category Split chart, Birthday Alert widget, Payment Method Split widget, WoW change indicators, New/Returning customer split, filter-independence rules for trend and birthday widgets, tie-breaking rule for Top Performer, and 6 new edge cases. Fixed lapsed threshold inconsistency in US-A7 (was "30+ days" — corrected to 45 days). Removed unimplemented "revenue target" language from US-A1.

---

# Section A: Owner Dashboard

## A.1 Module Overview

The Owner Dashboard is the command centre for the Salon Owner — a single-screen, real-time operational and financial pulse of the business. It surfaces actionable signals, not raw data, so an owner can walk in, glance at the screen for 30 seconds, and know exactly what needs attention today.

**Who uses it:** Owner only (role-gated; enforced at UI and API level).
**When:** Loaded automatically on Owner login; recommended to keep open throughout the day.
**Goal:** Replace the mental accounting salon owners currently do — no spreadsheets, no guesswork.

**Design Principle:** Every metric shown must answer a question the owner actually asks — "How much did I make?", "Who worked hardest?", "Which customers am I losing?", "What's popular?". If a number doesn't answer a real question, it doesn't belong on the dashboard.

---

## A.2 Dashboard Layout

The dashboard is a single-page, non-scrolling layout optimised for 1024px+ width, divided into 4 horizontal widget rows.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Salon Name]                      [Date]  [Range: Today ▾]  [↻ Refresh]│
│  Last updated: 14:32                                                      │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│  Today's     │  Customers   │  Avg Ticket  │  Lapsed      │  Top         │
│  Revenue     │  Served      │  Value       │  Customers   │  Performer   │
│  ₹12,400     │  18          │  ₹689        │  7 ⚠         │  Ravi        │
│  ↑ 23% WoW   │  +4 WoW      │  ↑ 8% WoW    │  +2 WoW      │  ₹4,200 · 9x │
│              │  12 New · 6↩ │              │              │              │
├──────────────┴──────────────┴──────────────┴──────────────┴──────────────┤
│  Revenue Trend  (Bar — rolling 30 days, filter-independent)               │
│  ██ ██ ██ ██ ██ ██ ██ ████ ██ ████ ████ ██ ████ ██ ████ ██ ████ ████    │
│  Jun-18       Jun-22       Jun-26       Jun-30       Jul-04     Today    │
├──────────────────────────────────────┬───────────────────────────────────┤
│  Top 5 Services  (by Revenue)        │  Staff Leaderboard                │
│  1. Haircut        ₹3,200   12x      │  1. ★ Ravi       ₹4,200   9 svc  │
│  2. Facial         ₹2,800    8x      │  2.   Sunita     ₹3,800   7 svc  │
│  3. Threading      ₹1,200   24x      │  3.   Anita      ₹2,100   5 svc  │
│  4. Hair Colour    ₹1,100    3x      │  4. ↓ Priya        ₹600   2 svc  │
│  5. Manicure         ₹900    6x      │                                   │
├──────────────────────────────────────┼───────────────────────────────────┤
│  🎂 Upcoming Birthdays (7 days)      │  Service Category Split           │
│  Today:  Priya Sharma  98765…        │       ╭───────────────╮           │
│  Jun 19: Rahul Mehta   91234…        │    ╭──┤  Hair  45%    ├──╮        │
│  Jun 22: Anita Jain    99988…        │    │  │  Skin  30%    │  │        │
│                                      │    ╰──┤  Nails 15%    ├──╯        │
│                                      │       │  Other 10%    │           │
│                                      │       ╰───────────────╯           │
└──────────────────────────────────────┴───────────────────────────────────┘
```

**Row 1 — KPI Strip (5 cards):** Today's Revenue · Customers Served (with New/Returning) · Average Ticket Value · Lapsed Customers · Today's Top Performer

**Row 2 — Full-Width Chart:** Revenue Trend (Bar, rolling 30 days — always fixed, not affected by date range filter)

**Row 3 — Ranked Lists (side by side):** Top 5 Services · Staff Leaderboard

**Row 4 — Alert & Split Widgets (side by side):** Upcoming Birthdays · Service Category Split (Doughnut)

---

## A.3 User Stories

| # | As a… | I want to… | So that… | Acceptance Criteria |
|---|--------|------------|----------|---------------------|
| US-A1 | Owner | See today's total revenue at a glance with WoW change | I can immediately sense if today is above or below last week | KPI card shows SUM of paid invoices for the current calendar day. WoW % change vs. same day last week displayed in green (positive) or red (negative). |
| US-A2 | Owner | See how many customers were served today, split into new vs. returning | I can track both footfall and whether I'm retaining vs. acquiring | KPI card shows total unique customer count. Sub-label shows "N New · M Returning." WoW absolute change (+/-) displayed below. |
| US-A3 | Owner | See the Average Ticket Value for today with WoW change | I can monitor whether upselling is working or declining | ATV card = Today's Revenue ÷ Customers Served. Shows "—" when no customers served. WoW % change shown. |
| US-A4 | Owner | See how many customers are lapsed (45+ days inactive) | I can know how large my re-engagement problem is at a glance | KPI card shows count of lapsed customers. WoW net change shown (+/- vs. same day last week). Clicking opens the full lapsed list in a slide-over panel. |
| US-A5 | Owner | See today's top-performing staff member | I can acknowledge high performers by name | Card shows name, total revenue generated today, and service count. Tie-breaking: most services first; still tied → alphabetical A→Z. Clicking opens that staff member's full day breakdown. |
| US-A6 | Owner | See a 30-day rolling revenue trend as a bar chart | I can spot growth, decline, or weekly patterns over time | Bar chart renders one bar per day, rolling last 30 calendar days. Today's bar in accent colour. Hover tooltip shows date and revenue. This chart always shows 30 days regardless of the date range filter. |
| US-A7 | Owner | See the top 5 services by revenue for the selected period | I can identify which services are driving the business | Ranked list: rank · service name · revenue · times rendered. Follows global date range filter. |
| US-A8 | Owner | See a staff leaderboard for the selected period | I can identify top and bottom performers at a glance | All active staff sorted by revenue descending. Bottom performer marked with a ↓ red indicator. Revenue and service count shown per row. Follows global date range filter. |
| US-A9 | Owner | See upcoming customer birthdays for the next 7 days | I can proactively reach out with a greeting or offer | Widget lists customers with name, masked phone (last 4 digits visible), and birthday date. Today's birthdays in bold at the top. Always shows 7-day window regardless of date range filter. |
| US-A10 | Owner | See how revenue is split across service categories | I can make informed pricing and promotion decisions | Doughnut chart shows % contribution per category for the selected date range. Hovering shows category name, ₹ revenue, and % share. |
| US-A11 | Owner | Filter all applicable widgets by a date range | I can compare today vs. last week vs. custom periods | Date range selector in the dashboard header (Today / Yesterday / This Week / This Month / Custom Range). Applies to all widgets except Revenue Trend chart and Upcoming Birthdays widget, which are always fixed-window. |
| US-A12 | Owner | Drill into any KPI to see the underlying records | I can investigate anomalies without leaving the dashboard | Clicking any KPI card opens a right slide-over panel (≈40% viewport width) with paginated itemised records. No page navigation occurs. Close via × button or Esc key. |
| US-A13 | Owner | Have the dashboard auto-refresh while I work | I don't need to manually reload throughout the day | Data refreshes every 5 minutes when online. Manual refresh (↻) button always available. "Last updated: HH:MM" shown in header. Offline: renders from cache with offline banner. |

---

## A.4 Detailed User Flows

### A.4.1 Login → Dashboard Landing

```
Owner enters credentials → Authentication succeeds
  → App checks role = "Owner"
  → Redirects to /dashboard
  → Dashboard skeleton loaders appear (≤ 300 ms)
  → Data fetched from local IndexedDB cache immediately (stale-while-revalidate)
  → Background sync pulls fresh data from server if online
  → All 5 KPI cards + 4 widget areas populate
  → "Last updated: HH:MM" shown in dashboard header
```

### A.4.2 Default State on Load

| Widget | Default Date Range | Filter-Independent? |
|--------|--------------------|---------------------|
| Today's Revenue KPI | Current calendar day | No (follows global filter) |
| Customers Served KPI (+ New/Returning) | Current calendar day | No |
| Average Ticket Value KPI | Current calendar day | No |
| Lapsed Customers KPI | As of today (45-day threshold) | Yes — always "as of today" |
| Today's Top Performer | Current calendar day | No |
| Revenue Trend Chart | Rolling last 30 calendar days | **Yes — always 30-day rolling** |
| Top 5 Services | Current calendar day | No |
| Staff Leaderboard | Current calendar day | No |
| Upcoming Birthdays | Today + next 7 calendar days | **Yes — always 7-day window** |
| Service Category Split | Current calendar day | No |

### A.4.3 Date Range Filter Interaction

1. Owner clicks the **Date Range** selector in the dashboard header.
2. Options: `Today` · `Yesterday` · `This Week` · `This Month` · `Custom Range`.
3. Selecting a preset applies instantly to all **filterable** widgets (see table above).
4. `Custom Range` opens a date-picker; owner selects start and end date → clicks **Apply**. Maximum range: 366 days.
5. Two widgets are **filter-independent** and always show their fixed window:
   - **Revenue Trend Chart** — always rolling last 30 calendar days. Changing the date range filter does not alter this chart.
   - **Upcoming Birthdays** — always today + next 7 days. Not date-filterable by design.
6. The active filter label is shown persistently in the header.
7. WoW % change indicators on KPI cards always compare vs. the equivalent prior period (e.g., "This Week" selected → WoW shows this week vs. last week; "Today" selected → WoW shows today vs. same weekday last week).

### A.4.4 KPI Drill-Down

1. Owner clicks any KPI card.
2. A right-side slide-over panel opens (width: ~40% of viewport) with itemised records.
3. Content per KPI:
   - **Today's Revenue** → Paid invoice list: customer name · services · total amount · time of invoice
   - **Customers Served** → Customer list: name · invoice total · New/Returning badge
   - **Average Ticket Value** → Same as Customers Served with per-customer ATV column
   - **Lapsed Customers** → Lapsed customer list: name · masked phone · last visit date · days inactive
   - **Top Performer** → That staff member's service log for the day: service name · customer name · amount · time
4. Panels are paginated at 20 records per page.
5. Close via **×** button or `Esc` key. No page navigation occurs.

---

## A.5 Functional Requirements

### A.5.1 KPI Cards

| KPI | Calculation | Display Format | WoW Indicator | Drill-Down |
|-----|-------------|---------------|---------------|------------|
| Today's Revenue | SUM(paid invoices, today) | ₹ currency, large font | % change vs. same weekday last week; green (positive) / red (negative) | Paid invoice list |
| Customers Served | COUNT(distinct customers, today) | Integer; sub-label: "N New · M Returning" | Absolute +/- vs. same weekday last week | Customer list with New/Returning badge |
| Average Ticket Value | Today's Revenue ÷ Customers Served | ₹ currency; shows "—" if 0 customers | % change vs. same weekday last week | Per-customer ATV breakdown |
| Lapsed Customers | COUNT(customers where last_visit < today − 45 days AND total_visits > 0) | Integer with ⚠ icon | Net change vs. same day last week (e.g., +2 means 2 more lapsed since last week) | Full lapsed list: name · phone · last visit · days inactive |
| Today's Top Performer | Staff with highest revenue today | Name + ₹ revenue + service count | N/A | Staff's full service list for the day |

### A.5.2 Charts

| Chart | Type | Date Scope | X-Axis | Y-Axis | Interactivity |
|-------|------|-----------|--------|--------|---------------|
| Revenue Trend | Bar chart | Rolling last 30 calendar days (filter-independent) | Daily dates | Revenue (₹) | Hover tooltip: date + revenue. Today's bar in accent colour. |
| Service Category Split | Doughnut chart | Follows global date filter | N/A | % share of revenue | Hover: category name + ₹ revenue + %. Click segment: slide-over showing services in that category for the period. |

### A.5.3 Ranked Lists

| List | Items Shown | Sort | Per Row | Date Scope | Drill-Down |
|------|-------------|------|---------|-----------|-----------|
| Top 5 Services | Top 5 only | Revenue descending | Rank · Service Name · ₹ Revenue · Times Rendered | Global filter | Click row → all invoices containing that service in slide-over |
| Staff Leaderboard | All active staff | Revenue descending | Rank · Name · ₹ Revenue · Service Count; lowest-revenue staff marked with ↓ red indicator | Global filter | Click row → staff's service detail for the period |

### A.5.4 Alert & Engagement Widgets

| Widget | Content | Sort | Interaction |
|--------|---------|------|-------------|
| Upcoming Birthdays | Customers with birthday today or within next 7 days (always fixed window, filter-independent) | Today's birthdays first (bold), then ascending by upcoming birthday date | Click customer name → opens customer profile in new tab |
| Service Category Split | Doughnut — see A.5.2 | N/A | See A.5.2 |

### A.5.5 Refresh & Sync

- **Online:** Auto-refresh every 5 minutes. Manual refresh (↻) button in header.
- **Offline:** Renders from IndexedDB cache. Persistent offline banner. Refresh button shows "No network — showing cached data" if pressed.
- **Last Updated:** Always visible in dashboard header (format: `Last updated: HH:MM`).

---

## A.6 Metrics Definitions

| Metric | Definition | Exclusions |
|--------|------------|-----------|
| **Today's Revenue** | SUM(invoice.grand_total) WHERE status = 'PAID' AND created_date = today | Refunded invoices fully excluded |
| **Customers Served** | COUNT(DISTINCT invoice.customer_id) WHERE status = 'PAID' AND invoice_date falls in selected range | — |
| **New Customer** | Customer whose first-ever paid invoice was created within the selected range | — |
| **Returning Customer** | Customer with ≥1 paid invoice prior to the selected range | — |
| **Average Ticket Value (ATV)** | Revenue for period ÷ Customers Served for period. Returns "—" when Customers Served = 0 to avoid division by zero. | — |
| **WoW % Change (Revenue)** | (Period Revenue − Prior Equivalent Period Revenue) ÷ Prior Period Revenue × 100. Shows "—" if prior period had ₹0. | — |
| **WoW Change (Customers)** | Customers Served this period − Customers Served in prior equivalent period. Absolute integer. | — |
| **Lapsed Customers** | COUNT(customers) WHERE last_visit_date < today − 45 days AND total_visits > 0 AND status = 'ACTIVE' | MERGED and DELETED customer statuses excluded |
| **Staff Revenue** | SUM(line_item.unit_price_snap) WHERE line_item.professional_id = staff.id AND invoice.status = 'PAID' | Line items on fully or partially refunded invoices excluded proportionally |
| **Top Performer** | Active staff member with highest Staff Revenue for the selected range. Tie-break: most services first; still tied → alphabetical A→Z. | — |
| **Bottom Performer** | Active staff member with lowest Staff Revenue for the selected range. Highlighted with ↓ red indicator. | — |
| **Service Revenue** | SUM(line_item.unit_price_snap) WHERE service_id = X AND invoice.status = 'PAID' | Refunded line items excluded |
| **Service Category Split %** | (Category Revenue ÷ Total Revenue for period) × 100 | — |

---

## A.7 Edge Cases

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| EC-A1 | No transactions in the selected period | All KPI cards show ₹0 or 0. Charts show empty state: "No data for this period." WoW indicators show "—". |
| EC-A2 | Prior period revenue = ₹0 (salon was closed) | WoW % indicator shows "—" to avoid division by zero. Not shown as +∞ or an error. |
| EC-A3 | Customers Served = 0 today | ATV card shows "—" (not ₹0 and not ∞). |
| EC-A4 | Two staff tied for Top Performer (equal revenue) | Staff with more services wins. If still tied, alphabetical A→Z. |
| EC-A5 | All staff deactivated | Staff Leaderboard shows: "No active staff. Add staff in Settings." Top Performer card shows empty state. |
| EC-A6 | First day of operation (zero history) | Lapsed KPI shows 0 with note: "Not enough history yet." Revenue Trend shows single bar. WoW indicators show "—". |
| EC-A7 | App is offline | Offline banner shown persistently. Dashboard renders from last IndexedDB sync. Refresh button shows: "No network — showing cached data." |
| EC-A8 | Very large data volume (500+ invoices in range) | Drill-down panels paginate at 20 records per page. KPI cards use pre-aggregated values — unaffected by data volume. |
| EC-A9 | Custom range: start date after end date | Apply button disabled until valid. Inline error: "End date must be on or after start date." |
| EC-A10 | Line item has no assigned staff | Revenue included in all revenue totals and ATV. Line item excluded from Staff Leaderboard and Top Performer. Footnote in Staff Leaderboard: "N line items had no staff assigned." |
| EC-A11 | Refund processed today | Refunded invoice amounts excluded from Today's Revenue and ATV on next auto-refresh (within 5 minutes). |
| EC-A12 | No customers have birthdays in next 7 days | Birthday widget shows: "No upcoming birthdays in the next 7 days." |
| EC-A13 | Service Category Split with only one category | Doughnut renders as a full circle for that single category. |
| EC-A14 | Only one active staff member | Staff Leaderboard shows one row. No "bottom performer" indicator shown when only one active staff exists. |

---

# Section B: Authentication & Role Management

## B.1 Module Overview

Governs how every user accesses the salon application, enforcing **role-based access control (RBAC)** across three roles — Owner, Billing Person, and Staff/Professional — each with strictly scoped permissions.

**Who configures it:** Owner only.  
**Who uses it:** All users.  
**Goal:** Every person sees exactly what they need — nothing more, nothing less.

---

## B.2 User Stories

| # | As a… | I want to… | So that… |
|---|--------|------------|----------|
| US-B1 | Owner | Log in with my username and password | I can access the full management dashboard |
| US-B2 | Billing Person | Log in with my username and password | I can access the billing workflow |
| US-B3 | Staff Member | Log in with my username and password | I can view my own performance |
| US-B4 | Owner | Create a new user account | I can onboard a new team member |
| US-B5 | Owner | Reset any user's password | I can help a locked-out team member |
| US-B6 | Owner | Deactivate a user account | A departing employee cannot log in |
| US-B7 | Any User | Be automatically logged out after inactivity | My session is not left open on a shared device |
| US-B8 | Any User | See a clear error after multiple failed login attempts | I understand my account is locked |
| US-B9 | Owner | View all user accounts and roles | I can audit who has access |
| US-B10 | Any User | Change my own password after first login | I can replace the temporary password |

---

## B.3 Detailed User Flows

### B.3.1 Login Flow (All Roles)

```
User navigates to app URL
  → Login Screen (username, password, Login button)
  → User enters credentials → clicks Login
  → [Validation] Fields non-empty?
       → No → inline error "This field is required"
  → [Auth Check] Credentials valid?
       → No  → Increment failed attempt counter
               → counter < 5: "Invalid username or password"
               → counter = 5: Lock account 15 min; show lockout message
       → Yes → Reset failed attempt counter
               → [First Login?] → Yes → Redirect to /change-password (forced)
               → No → Resolve role → Redirect to role home screen
```

### B.3.2 Post-Login Redirect by Role

| Role | Landing Screen | URL |
|------|---------------|-----|
| Owner | Owner Dashboard | /dashboard |
| Billing Person | Billing / Invoice screen | /billing |
| Staff / Professional | My Performance screen | /my-performance |

### B.3.3 Session Management

```
User active in app
  → Inactivity timer resets on any mouse/keyboard/touch event
  → 30 minutes of inactivity:
       → Session token invalidated server-side
       → Redirect to /login: "Session expired"
  → Manual Logout:
       → Session invalidated server-side
       → Local auth tokens cleared
       → Redirect to /login
```

### B.3.4 Owner Creates a New User

```
Owner → Settings → User Management → [+ Add User]
  → Form: Full Name*, Username*, Role*, Temporary Password*, Confirm Password*
  → Submit → Validation → User created (status = Active, forcePasswordChange = true)
  → Toast: "User [name] created successfully"
```

### B.3.5 Owner Deactivates a User

```
Owner → User Management → User row → [Deactivate]
  → Confirmation modal
  → Owner confirms → status = Inactive; active session invalidated immediately
  → Toast: "User deactivated"
```

---

## B.4 Functional Requirements

### B.4.1 Password Policy

| Rule | Requirement |
|------|-------------|
| Minimum length | 8 characters |
| Must contain | ≥1 uppercase, ≥1 lowercase, ≥1 digit |
| Cannot reuse | Immediately preceding password |
| Temporary password | Set by owner; forcePasswordChange = true |

### B.4.2 Session Management

| Parameter | Value |
|-----------|-------|
| Inactivity timeout | 30 minutes |
| Token type | Signed JWT in sessionStorage |
| Concurrent sessions | Single session per user; new login invalidates prior |

### B.4.3 Account Lockout

| Parameter | Value |
|-----------|-------|
| Failed attempts before lock | 5 consecutive |
| Lockout duration | 15 minutes (auto-unlock) |
| Lockout scope | Per username |

---

## B.5 Access Control Matrix

| Feature / Module | Owner | Billing Person | Staff / Professional |
|-----------------|-------|---------------|----------------------|
| **Owner Dashboard** | ✅ Full | ❌ No Access | ❌ No Access |
| **Billing / Invoicing** | ✅ Full | ✅ Full | ❌ No Access |
| **Service Catalog (View)** | ✅ Full | 👁️ Read Only | ❌ No Access |
| **Service Catalog (Add/Edit/Delete)** | ✅ Full | ❌ No Access | ❌ No Access |
| **My Performance Screen** | ✅ All staff | ❌ No Access | 👁️ Own data only |
| **User Management** | ✅ Full | ❌ No Access | ❌ No Access |
| **Customer Records (View & Edit)** | ✅ Full | ✅ Full | ❌ No Access |
| **Reports & Analytics** | ✅ Full | ❌ No Access | ❌ No Access |
| **Settings (App Config)** | ✅ Full | ❌ No Access | ❌ No Access |
| **Change Own Password** | ✅ | ✅ | ✅ |

---

## B.6 Edge Cases

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| EC-B1 | Owner tries to deactivate themselves | Blocked. Error: "You cannot deactivate your own account." |
| EC-B2 | Only one Owner account and it is locked out | Lockout auto-expires after 15 minutes. No bypass in V1. |
| EC-B3 | User deactivated mid-session | Next API request returns 401 → redirect to login: "Account deactivated." |
| EC-B4 | Staff tries to access /dashboard via URL | Route guard redirects to /my-performance with permission error toast. |
| EC-B5 | Duplicate username on creation | Inline error: "This username is already taken." No account created. |
| EC-B6 | App offline during login | If cached auth exists, login succeeds offline. Otherwise: "Cannot verify credentials while offline." |
| EC-B7 | Session expires while filling a form offline | Pending local data saved; redirect to login. Data not lost. |
| EC-B8 | Billing Person calls Add Service API directly | HTTP 403 Forbidden returned. UI never renders the control. |

---

# Section C: Service Catalog Management

## C.1 Module Overview

The Service Catalog is the master list of all services the salon offers. It is the single source of truth for service names, categories, pricing, and durations.

**Who manages it:** Owner only.  
**Who reads it:** Owner (full), Billing Person (active services only, during invoicing).  
**Goal:** Ensure all billed services are standardised, priced correctly, and traceable.

---

## C.2 User Stories

| # | As a… | I want to… | So that… |
|---|--------|------------|----------|
| US-C1 | Owner | Add a new service | New offerings are available for billing |
| US-C2 | Owner | Edit a service's price | Pricing stays current without recreating the service |
| US-C3 | Owner | Deactivate a service | Services no longer offered are hidden from billing |
| US-C4 | Owner | Reactivate a service | A previously suspended service can be offered again |
| US-C5 | Owner | View the full service catalog | I have a complete picture of all offerings |
| US-C6 | Owner | Search and filter the catalog | I can quickly find a specific service |
| US-C7 | Owner | Organise services into categories | The catalog and billing screen are easy to navigate |
| US-C8 | Owner | Permanently delete a test/erroneous service | I can keep the catalog clean |
| US-C9 | Billing Person | Browse only active services when creating an invoice | I can select the correct service quickly |
| US-C10 | Owner | Add a custom category | I can organise services specific to this salon |

---

## C.3 Detailed User Flows

### C.3.1 Adding a New Service

```
Owner → Service Catalog → [+ Add Service]
  → Modal: Service Name*, Category*, Price*, Duration (mins)*, Description, Status (default: Active)
  → [Save]
  → Validation → Service created
  → Toast: "Service '[Name]' added successfully"
  → If Active: immediately available in billing picker
```

### C.3.2 Editing a Service

```
Owner → Service Catalog → [Edit]
  → Modal pre-populated → Owner modifies fields → [Save]
  → Past invoices: unchanged (price snapshotted at billing time)
  → Future billing: new price applies immediately
```

### C.3.3 Deactivating a Service

```
Owner → Service Catalog → Active/Inactive toggle
  → Confirmation modal: "Deactivate '[Name]'? Hidden from billing; past invoices unaffected."
  → Confirms → status = 'inactive'
  → Billing Person's picker: service no longer appears
  → Owner's catalog: service shows "Inactive" badge
```

### C.3.4 Permanently Deleting a Service

```
Owner → Edit modal → [Delete Service]
  → System checks: service ever on an invoice?
       → Yes → Delete disabled; tooltip: "Deactivate instead."
       → No  → Confirmation → Permanent delete
```

---

## C.4 Functional Requirements

| Operation | Who | Behaviour |
|-----------|-----|-----------|
| **Create** | Owner | All required fields valid; name unique |
| **Read (all)** | Owner | All services and statuses |
| **Read (active only)** | Billing Person | During invoice creation only |
| **Update** | Owner | All fields editable; price change is forward-only |
| **Deactivate** | Owner | Reversible; soft delete |
| **Delete** | Owner | Only if zero invoice history; irreversible |

### Category Management

- Predefined: Hair, Skin, Nails, Makeup, Other.
- Owner can create custom categories.
- Categories cannot be deleted if referenced by any service.

---

## C.5 Data Model

### Entity: `services`

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| id | UUID | Yes (auto) | Primary Key |
| name | VARCHAR(100) | Yes | Unique within salon, case-insensitive |
| category_id | FK → service_categories | Yes | Must reference existing category |
| price | DECIMAL(10,2) | Yes | >= 0 |
| duration_minutes | INTEGER | Yes | > 0 |
| description | TEXT | No | Max 500 chars |
| status | ENUM('active','inactive') | Yes | Default: 'active' |
| created_at | TIMESTAMP | Yes (auto) | |
| updated_at | TIMESTAMP | Yes (auto) | |
| created_by | FK → users.id | Yes | |

### Entity: `service_categories`

| Field | Type | Required |
|-------|------|----------|
| id | UUID | Yes (auto) |
| name | VARCHAR(50) | Yes, unique |
| created_at | TIMESTAMP | Yes (auto) |

---

## C.6 Business Rules

| # | Rule |
|---|------|
| BR-C1 | Updating a service price NEVER changes past invoices. Invoice line items store a price snapshot. |
| BR-C2 | Deactivation is a soft delete — record persists, visible to Owner, hidden from billing. |
| BR-C3 | Billing Person's service picker queries WHERE status = 'active'. Enforced at UI and API level. |
| BR-C4 | Billing Person cannot enter a free-form service name or price. All billed services must be catalog entries. |
| BR-C5 | Service names must be unique (case-insensitive). |
| BR-C6 | Category is required on all services. |
| BR-C7 | Permanent delete blocked if COUNT(invoice_line_items WHERE service_id = x) > 0. |
| BR-C8 | Duration minimum is 1 minute. |
| BR-C9 | Catalog is cached locally for offline use; edits queue for sync. |

---

## C.7 Edge Cases

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| EC-C1 | Duplicate service name | Inline error: "A service with this name already exists." |
| EC-C2 | Empty catalog | Owner sees onboarding prompt. Billing Person sees: "No services available. Contact your owner." |
| EC-C3 | Delete service with billing history | Delete disabled; tooltip: "Deactivate instead." |
| EC-C4 | Deactivate service in an open invoice | Allowed with warning: "Referenced in [N] open invoice(s). Deactivating will not affect them." |
| EC-C5 | Price edit while offline | Written locally; synced on reconnect using last-write-wins. |
| EC-C6 | All services in a category deactivated | Category remains; returns empty list when filtered to Active Only. |
| EC-C7 | Service saved with price = 0 | Allowed (complimentary service). Soft warning: "Saving at ₹0. Is this intentional?" Requires confirmation. |

---

*End of PRD — Sections A (Owner Dashboard), B (Authentication), C (Service Catalog)*  
*Document Version 1.0 · June 2026 · Single Salon · Browser-based · Offline-first*
