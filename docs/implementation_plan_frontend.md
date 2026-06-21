# Frontend Implementation Plan — Salon Management Web App
**Version:** 1.0 | **Date:** 2026-06-17 | **Stack:** Vanilla HTML5 · ES6 Modules · Dexie.js · Chart.js · CSS Custom Properties

---

## Overview

The frontend is a **zero-build, zero-dependency-install Single Page Application (SPA)** that runs directly in any modern browser by opening `index.html`. It uses IndexedDB (via Dexie.js) as its local database — making it fully offline-capable with no backend required at this stage.

The frontend is the **complete product** — not a prototype. All business logic, validation, access control, calculations, and data persistence happen here. The backend phase of the project will later replace IndexedDB reads/writes with API calls, but the UX and business logic will remain identical.

**Build order is strict.** Each milestone depends on the previous. Do not start a milestone until its predecessor passes all testing checkpoints.

---

## Tech Stack

| Layer | Technology | Source |
|---|---|---|
| Markup | HTML5 (semantic) | — |
| Styling | CSS Custom Properties + Flexbox/Grid | — |
| Logic | ES6 Modules (vanilla JS, no bundler) | — |
| Local Database | Dexie.js v3.x | CDN |
| Charts | Chart.js v4.x | CDN |
| Icons | Lucide Icons (SVG via CDN) | CDN |
| Fonts | Inter (Google Fonts) | CDN |
| Routing | Custom hash-based router (`#/route`) | Custom |

---

## Complete File Structure

```
Salon Application/
├── index.html                        # Single HTML shell; loads all CDN scripts + entry JS
│
├── css/
│   ├── variables.css                 # Design tokens: colours, spacing, typography, shadows
│   ├── app.css                       # Layout: shell, sidebar, header, content area
│   ├── components/
│   │   ├── button.css                # Button variants: primary, secondary, danger, ghost
│   │   ├── card.css                  # KPI cards, content cards, list cards
│   │   ├── form.css                  # Inputs, selects, labels, validation states
│   │   ├── modal.css                 # Modal overlay, modal body, modal footer
│   │   ├── slideover.css             # Right-side slide-over panel
│   │   ├── table.css                 # Data tables, sortable headers, status badges
│   │   ├── badge.css                 # Status badges: LAPSED, BIRTHDAY, PAID, REFUNDED, etc.
│   │   ├── toast.css                 # Toast notification system
│   │   └── chart.css                 # Chart wrappers and legend styles
│   └── pages/
│       ├── login.css                 # Login screen layout
│       ├── dashboard.css             # Dashboard grid, KPI strip, widget rows
│       ├── billing.css               # Split-pane billing workspace
│       ├── customers.css             # Customer directory, profile card, visit history
│       ├── staff.css                 # Staff directory, performance report layout
│       ├── catalog.css               # Service catalog grid/list
│       └── settings.css              # Settings page tabs and panels
│
├── js/
│   ├── app.js                        # Entry point: initialises DB, auth check, router
│   ├── db.js                         # Dexie schema definition + 30-day seed data
│   ├── router.js                     # Hash router, RBAC route guards, page rendering
│   ├── auth.js                       # Session management, login/logout, role helpers
│   ├── utils.js                      # Shared helpers: formatCurrency, formatDate, etc.
│   │
│   ├── components/
│   │   ├── sidebar.js                # Sidebar nav: renders role-filtered links
│   │   ├── header.js                 # Top header: user info, logout, role display
│   │   ├── toast.js                  # Global toast notification system
│   │   ├── modal.js                  # Reusable modal: open(config), close()
│   │   ├── slideover.js              # Right slide-over panel: open(title, content), close()
│   │   └── offline-banner.js         # Offline status banner: detects navigator.onLine
│   │
│   └── pages/
│       ├── login.js                  # Login form, credential validation, session init
│       ├── dashboard.js              # All 9 dashboard widgets + date filter
│       ├── billing.js                # Cart, invoice generation, history, refund console
│       ├── customers.js              # Customer search, profile, visit history, reports
│       ├── staff.js                  # Staff CRUD, commission, performance reports
│       ├── catalog.js                # Service catalog CRUD, category management
│       └── settings.js               # Salon profile, GST, discounts, user management
│
└── docs/                             # PRD documents (reference only)
```

---

## Milestone M0 — Foundation Setup

**Goal:** A running shell with design system and navigation. Nothing interactive yet.

### 0.1 — `index.html`

Create the single HTML file that acts as the app shell:

```html
<!-- CDN dependencies (in <head>) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/lucide@latest/font/lucide.min.css">

<!-- All CSS files -->
<link rel="stylesheet" href="css/variables.css">
<link rel="stylesheet" href="css/app.css">
<link rel="stylesheet" href="css/components/button.css">
... (all component + page CSS files)

<!-- CDN scripts (before </body>) -->
<script src="https://cdn.jsdelivr.net/npm/dexie/dist/dexie.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- App entry point (must be type="module") -->
<script type="module" src="js/app.js"></script>
```

Shell structure inside `<body>`:
```
#app-shell
  #offline-banner        (hidden by default)
  #sidebar               (empty; rendered by sidebar.js)
  #main-wrapper
    #top-header          (empty; rendered by header.js)
    #page-content        (empty; page JS renders here)
  #toast-container       (empty; toast.js appends here)
  #modal-overlay         (hidden by default)
  #slideover-panel       (hidden by default; slides in from right)
```

### 0.2 — `css/variables.css`

Define all design tokens:

```css
:root {
  /* Brand colours */
  --clr-primary: hsl(250, 70%, 55%);         /* Violet — main accent */
  --clr-primary-hover: hsl(250, 70%, 48%);
  --clr-primary-light: hsl(250, 70%, 95%);

  /* Semantic colours */
  --clr-success: hsl(145, 60%, 40%);
  --clr-warning: hsl(38, 90%, 50%);
  --clr-danger: hsl(4, 75%, 55%);
  --clr-info: hsl(205, 80%, 50%);

  /* Neutrals */
  --clr-bg: hsl(240, 10%, 98%);
  --clr-surface: hsl(0, 0%, 100%);
  --clr-border: hsl(240, 10%, 90%);
  --clr-text-primary: hsl(240, 10%, 15%);
  --clr-text-secondary: hsl(240, 5%, 45%);
  --clr-text-muted: hsl(240, 5%, 65%);

  /* Sidebar */
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 64px;
  --clr-sidebar-bg: hsl(240, 20%, 12%);
  --clr-sidebar-text: hsl(240, 10%, 75%);
  --clr-sidebar-active: hsl(250, 70%, 55%);

  /* Spacing scale */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px;  --sp-10: 40px;
  --sp-12: 48px;

  /* Typography */
  --font-family: 'Inter', sans-serif;
  --text-xs: 11px; --text-sm: 13px; --text-base: 14px;
  --text-md: 16px; --text-lg: 18px; --text-xl: 22px;
  --text-2xl: 28px; --text-3xl: 36px;
  --font-regular: 400; --font-medium: 500;
  --font-semibold: 600; --font-bold: 700;

  /* Shadows */
  --shadow-sm: 0 1px 3px hsla(0,0%,0%,0.06), 0 1px 2px hsla(0,0%,0%,0.04);
  --shadow-md: 0 4px 6px hsla(0,0%,0%,0.07), 0 2px 4px hsla(0,0%,0%,0.05);
  --shadow-lg: 0 10px 15px hsla(0,0%,0%,0.08), 0 4px 6px hsla(0,0%,0%,0.05);

  /* Radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 350ms ease;
}
```

### 0.3 — `css/app.css`

Shell layout using CSS Grid:
- Sidebar fixed left (240px or 64px collapsed)
- Main wrapper: top header (56px) + scrollable content area
- Sidebar collapses to icon-only on toggle
- Content area: full remaining width, no overflow-x

### 0.4 — M0 Testing Checkpoint

- [ ] Page loads without errors in Chrome, Firefox, Edge
- [ ] CDN scripts load (Dexie, Chart.js, Lucide)
- [ ] Shell layout renders with visible sidebar area and content area
- [ ] CSS variables apply correctly (check computed styles in DevTools)
- [ ] No console errors

---

## Milestone M1 — Database Layer (Dexie.js)

**Goal:** All data structures defined; seed data ready for immediate use.

**File:** `js/db.js`

### 1.1 — Dexie Schema Definition

```javascript
const db = new Dexie('SalonDB');

db.version(1).stores({
  // Salon-level config
  salonProfile: '++id',

  // Users / Auth
  users: '++id, username, role, status',

  // Customer Management
  customers: '++id, phone, status, referralSource, createdAt',

  // Service Catalog
  serviceCategories: '++id, name',
  services: '++id, categoryId, status, name',

  // Staff
  staff: '++id, phone, status, name',
  commissionRateHistory: '++id, staffId, effectiveFrom',

  // Invoicing
  invoices: '++id, invoiceNumber, customerId, invoiceDate, status, paymentMethod, createdBy, syncStatus',
  invoiceLineItems: '++id, invoiceId, serviceId, professionalId',
  refunds: '++id, invoiceId, processedAt',

  // Settings
  predefinedDiscountOffers: '++id, name, status',

  // Sync
  syncQueue: '++id, entityType, entityId, operation, createdAt, syncStatus'
});
```

Key Dexie index notes:
- `phone` on customers and staff: enables O(1) phone lookup
- `invoiceDate` and `customerId` on invoices: enables dashboard aggregations
- `professionalId` on invoiceLineItems: enables staff performance queries
- `syncStatus` on invoices: enables finding PENDING records on reconnect

### 1.2 — Seed Data Function

`db.js` exports a `seedDatabase()` function that runs on first launch (checked via a `db_seeded` flag in `localStorage`):

**Seed the following:**

| Entity | Count | Notes |
|---|---|---|
| Salon Profile | 1 | "Glamour Studio", Mumbai address, GSTIN, GST enabled |
| Users | 4 | owner / billing1 / ravi (staff) / sunita (staff) |
| Service Categories | 5 | Hair · Skin · Nails · Makeup · Other |
| Services | 12 | 3 per major category; realistic Indian salon pricing |
| Staff | 4 | Ravi (15%), Sunita (12%), Anita (10%), Priya (10%) |
| Commission Rate History | 5 | Includes one mid-period rate change for Ravi |
| Customers | 8 | Mix of genders, referral sources; one with DOB today+3 (birthday test); one last visited 60 days ago (lapsed test) |
| Predefined Discount Offers | 3 | Monsoon Special 10% · Senior Citizen ₹100 · Weekend Glow 15% |
| Invoices + Line Items | 30 days × ~4/day = ~120 invoices | Realistic distribution across staff and services; includes 2 refunds |

Seed function must:
- Generate invoice numbers sequentially: `SAL-202606-0001` through `SAL-202606-NNNN`
- Use `Math.random()` with a fixed seed for reproducibility
- Run only once (`localStorage.getItem('salon_db_seeded')`)
- Set `localStorage.setItem('salon_db_seeded', '1')` on completion

### 1.3 — Database Helper Functions

Export from `db.js` (used by all page modules):

```javascript
// Customer helpers
export async function findCustomerByPhone(phone) { ... }
export async function createCustomer(data) { ... }
export async function updateCustomer(id, data) { ... }
export async function getCustomerWithStats(id) { ... }  // includes computed fields
export async function getLapsedCustomers(thresholdDays = 45) { ... }
export async function getUpcomingBirthdays(daysAhead = 7) { ... }

// Invoice helpers
export async function createInvoice(invoiceData, lineItems) { ... }  // atomic transaction
export async function getInvoiceWithLineItems(invoiceId) { ... }
export async function getInvoicesByCustomer(customerId) { ... }
export async function getInvoicesByDateRange(startDate, endDate) { ... }
export async function processRefund(invoiceId, refundData) { ... }

// Staff helpers
export async function getActiveStaff() { ... }
export async function getStaffPerformance(staffId, startDate, endDate) { ... }
export async function getCommissionRateOnDate(staffId, date) { ... }

// Dashboard helpers
export async function getDashboardKPIs(startDate, endDate) { ... }
export async function getRevenueByDay(last30Days) { ... }
export async function getRevenueByCategoryForRange(startDate, endDate) { ... }
export async function getStaffLeaderboard(startDate, endDate) { ... }

// Settings helpers
export async function getSalonProfile() { ... }
export async function updateSalonProfile(data) { ... }
export async function getActiveDiscountOffers() { ... }
```

All write functions must:
- Validate required fields before writing
- Set `syncStatus: 'PENDING'` on every write (backend sync hook)
- Set `createdAt` / `updatedAt` automatically

### 1.4 — M1 Testing Checkpoint

- [ ] Open DevTools → Application → IndexedDB → SalonDB: all tables visible
- [ ] All seed records present (count each table)
- [ ] `findCustomerByPhone('9876543210')` returns correct result in DevTools console
- [ ] `getInvoicesByDateRange(...)` returns invoices within range only
- [ ] `getCommissionRateOnDate(staffId, date)` returns correct rate before/after a rate change

---

## Milestone M2 — Core Infrastructure

**Goal:** Router, auth session, reusable components. All subsequent pages depend on these.

### 2.1 — `js/auth.js`

```javascript
// Session stored in sessionStorage as JSON
const SESSION_KEY = 'salon_session';

export function setSession(user) { ... }          // saves {id, username, role, name} to sessionStorage
export function getSession() { ... }               // returns parsed session or null
export function clearSession() { ... }             // removes session + redirects to #/login
export function requireAuth() { ... }              // called by router; redirects if no session
export function hasRole(...roles) { ... }          // e.g. hasRole('OWNER') → boolean
export function getCurrentUser() { ... }           // returns session object
```

Password hashing for simulated auth (no backend yet):
- On login: compare password against stored `passwordHash` in Dexie `users` table
- Use a simple deterministic hash function (e.g., djb2) for V1 frontend simulation
- Note: real bcrypt runs server-side; this is replaced in the backend integration phase

Failed attempt tracking:
- Store `{ username, attempts, lockedUntil }` in `localStorage` as `salon_lockouts`
- Check on every login attempt; block if `lockedUntil > Date.now()`
- Increment on failure; reset on success

Inactivity timeout:
- Store `lastActivity` in `sessionStorage`
- `setInterval` every 60 seconds checks if `Date.now() - lastActivity > 30 * 60 * 1000`
- On any `mousemove`, `keydown`, `click`, `touchstart`: update `lastActivity`
- On timeout: call `clearSession()` with toast "Session expired due to inactivity"

### 2.2 — `js/router.js`

```javascript
// Route configuration
const ROUTES = {
  '/login':          { page: 'login',     roles: null },        // public
  '/dashboard':      { page: 'dashboard', roles: ['OWNER'] },
  '/billing':        { page: 'billing',   roles: ['OWNER', 'BILLING_PERSON'] },
  '/customers':      { page: 'customers', roles: ['OWNER', 'BILLING_PERSON'] },
  '/catalog':        { page: 'catalog',   roles: ['OWNER', 'BILLING_PERSON'] },
  '/staff':          { page: 'staff',     roles: ['OWNER'] },
  '/my-performance': { page: 'staff',     roles: ['STAFF'] },   // same page, filtered view
  '/settings':       { page: 'settings',  roles: ['OWNER'] },
};
```

Router logic:
1. Listen to `hashchange` and `DOMContentLoaded` events
2. Parse route from `location.hash` (strip `#`)
3. Check session exists → redirect to `/login` if not
4. Check role permission → redirect to role home + "Access Denied" toast if fails
5. Call page module's `render(container)` function
6. Update active state in sidebar nav

Role home screens:
- OWNER → `/dashboard`
- BILLING_PERSON → `/billing`
- STAFF → `/my-performance`

### 2.3 — `js/components/toast.js`

```javascript
export function showToast(message, type = 'success', duration = 3500) { ... }
// type: 'success' | 'error' | 'warning' | 'info'
// Appends to #toast-container, auto-removes after duration
// Stacks vertically if multiple toasts
```

### 2.4 — `js/components/modal.js`

```javascript
export function openModal({ title, body, footer, size = 'md', onClose }) { ... }
// size: 'sm' | 'md' | 'lg'
// body: HTML string or DOM element
// footer: HTML with action buttons (caller passes HTML string)
// Traps focus inside modal (accessibility)
// Closes on Escape key or clicking overlay

export function closeModal() { ... }
```

### 2.5 — `js/components/slideover.js`

```javascript
export function openSlideover({ title, content, onClose }) { ... }
// Slides in from the right (40% viewport width)
// content: HTML string or DOM node
// Closes on Escape or × button
// Does not navigate away from current page

export function closeSlideover() { ... }
```

### 2.6 — `js/components/offline-banner.js`

```javascript
export function initOfflineBanner() { ... }
// Listens to window 'online'/'offline' events
// Shows/hides #offline-banner
// Banner text: "You are offline. Data will sync when reconnected."
// On 'online': triggers sync simulation (marks PENDING records as syncing)
```

### 2.7 — `js/components/sidebar.js`

```javascript
export function renderSidebar(role) { ... }
// Renders only the nav items the current role can access
// Shows salon name from salonProfile
// Highlights active route
// Supports collapse/expand toggle (saves state in localStorage)
```

Nav items per role:

| Route | Label | OWNER | BILLING | STAFF |
|---|---|---|---|---|
| /dashboard | Dashboard | ✅ | ❌ | ❌ |
| /billing | Billing | ✅ | ✅ | ❌ |
| /customers | Customers | ✅ | ✅ | ❌ |
| /catalog | Services | ✅ | ✅ (read) | ❌ |
| /staff | Staff | ✅ | ❌ | ❌ |
| /my-performance | My Performance | ❌ | ❌ | ✅ |
| /settings | Settings | ✅ | ❌ | ❌ |

### 2.8 — `js/utils.js`

```javascript
export function formatCurrency(amount) { ... }   // → "₹1,234.00"
export function formatDate(date) { ... }          // → "17 Jun 2026"
export function formatDateTime(ts) { ... }        // → "17 Jun 2026, 14:32"
export function daysBetween(dateA, dateB) { ... } // → integer
export function generateInvoiceNumber(count) { }  // → "SAL-202607-0042"
export function generateRefundNumber(count) { }   // → "REF-202607-0001"
export function maskPhone(phone) { ... }          // → "XXXXXX4210"
export function debounce(fn, delay) { ... }       // for search inputs
export function paginate(array, page, perPage) { } // → { items, totalPages, currentPage }
export function sortBy(array, key, dir = 'asc') { }
export function getDateRange(preset) { ... }      // preset: 'today'|'yesterday'|'thisWeek'|'thisMonth'
```

### 2.9 — M2 Testing Checkpoint

- [ ] Router navigates to each route via browser address bar hash change
- [ ] RBAC: change role in session → unauthorized routes redirect with toast
- [ ] `showToast('Test', 'success')` shows green toast, auto-dismisses
- [ ] `openModal({...})` opens modal; Escape closes it
- [ ] Offline banner appears when network is throttled to Offline in DevTools
- [ ] Sidebar collapses to icon-only; expanded state persists on refresh
- [ ] `formatCurrency(1234.5)` → `"₹1,234.50"`

---

## Milestone M3 — Login Module

**File:** `js/pages/login.js`

### 3.1 — Login Page Render

Full-screen centered layout (no sidebar). Render:
- Salon logo placeholder (salon name in large type)
- Username field
- Password field (toggle show/hide)
- Login button
- Error message zone (below form)

### 3.2 — Login Logic

```
On form submit:
  1. Validate: both fields non-empty → inline "This field is required" if not
  2. Check lockout: read localStorage 'salon_lockouts' for this username
     → If lockedUntil > Date.now(): show "Account locked. Try again in X minutes." Stop.
  3. Find user in Dexie users table WHERE username = ? AND status = 'ACTIVE'
     → Not found: increment attempt counter; show "Invalid username or password"
     → Found: compare entered password to stored hash
       → Mismatch: increment attempt counter
         → attempts >= 5: set lockedUntil = Date.now() + 15*60*1000; show lockout message
         → attempts < 5: show "Invalid credentials. (N attempts remaining before lockout)"
       → Match: reset attempt counter; call setSession(user)
  4. Check forcePasswordChange flag:
     → true: redirect to #/change-password (force password change screen)
     → false: redirect to role home screen
```

### 3.3 — Change Password Screen

Shown on first login (forcePasswordChange = true):
- Current password field
- New password field
- Confirm new password field
- Validation: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
- Cannot reuse immediately preceding password
- On success: update Dexie user record; set forcePasswordChange = false; redirect to role home

### 3.4 — M3 Testing Checkpoint

- [ ] Login with valid owner credentials → redirects to `/dashboard`
- [ ] Login with valid billing credentials → redirects to `/billing`
- [ ] Login with valid staff credentials → redirects to `/my-performance`
- [ ] Wrong password 5 times → lockout message; button disabled
- [ ] Lockout expires after 15 minutes (test with shortened timeout in dev)
- [ ] First-login user → forced to change password before dashboard access
- [ ] Show/hide password toggle works
- [ ] Logout button from any page → clears session → redirects to login

---

## Milestone M4 — Settings Module

**Build settings before other modules** — salon profile, GST config, and discount offers are referenced across billing and invoicing.

**File:** `js/pages/settings.js`

### 4.1 — Settings Page Layout

Three-tab layout (Tab navigation within the page):
1. **Salon Profile** — name, address, phone
2. **Tax & Offers** — GST toggle + GSTIN; Predefined Discount Offers CRUD
3. **User Management** — create / reset / deactivate user accounts

### 4.2 — Tab: Salon Profile

- Form with three fields: Salon Name*, Address*, Phone*
- Auto-loads current values from `getSalonProfile()` on render
- Save button: validates non-empty; writes to Dexie; toast "Profile saved"
- Changes immediately available to invoice generation

### 4.3 — Tab: Tax & Offers

**GST Section:**
- Toggle switch for GST enabled/disabled
- When toggle ON: GSTIN input field appears (required, 15 chars alphanumeric)
- When toggle OFF: GSTIN field hides and clears
- Save GST Settings button: validates GSTIN length if enabled; saves; toast

**Predefined Discount Offers:**
- Table: Offer Name · Type · Value · Status · Actions
- [+ Add Offer] button → opens modal:
  - Offer Name* (text, unique among active)
  - Type: Percentage (%) or Flat Amount (₹) — radio/toggle
  - Value* (numeric; % validates ≤100; ₹ validates > 0)
  - [Create Offer] → validates → saves → closes modal → refreshes table
- Deactivate button per row → toggles status; toast "Offer deactivated"
- No hard delete; status only toggles ACTIVE ↔ INACTIVE

### 4.4 — Tab: User Management

- Table: Name · Username · Role · Status · Actions
- [+ Add User] → opens modal:
  - Full Name*, Username* (unique check), Role* (dropdown: OWNER/BILLING_PERSON/STAFF), Temp Password*, Confirm Password*
  - On save: creates user in Dexie with forcePasswordChange = true; toast
- [Reset Password] per row → opens modal: enter new temp password → saves; toast
- [Deactivate] per row → confirmation modal → sets status = INACTIVE; toast
- Cannot deactivate own account → button disabled + tooltip "Cannot deactivate your own account"

### 4.5 — M4 Testing Checkpoint

- [ ] Save salon profile → verify new values persist on page refresh
- [ ] GST toggle ON → GSTIN field appears; toggle OFF → field disappears and clears
- [ ] Save GST with GSTIN = 14 chars → inline error "GSTIN must be 15 characters"
- [ ] Add discount offer "Test 10%" → appears in list; appears in billing discount picker
- [ ] Deactivate discount offer → disappears from billing picker; still visible in settings list with INACTIVE badge
- [ ] Create new user → can log in with temp password → forced to change on first login
- [ ] Deactivate user → that user cannot log in (session rejected)
- [ ] Try deactivating own account → button disabled

---

## Milestone M5 — Service Catalog Module

**File:** `js/pages/catalog.js`

### 5.1 — Catalog Page Layout

- **Owner view:** Full CRUD table + [+ Add Service] button
- **Billing Person view:** Read-only grid (active services only, organised by category)

### 5.2 — Owner Catalog View

Table columns: # · Name · Category · Price · Duration · Status · Actions

Filters row above table:
- Search by name (debounced 300ms, local filter)
- Filter by category (dropdown)
- Filter by status (All / Active / Inactive)

**Add Service** (modal):
- Service Name* (unique check — case-insensitive)
- Category* (dropdown of existing categories + "Add new category" option)
- Price (₹)* (decimal, ≥ 0)
- Duration (minutes)* (integer, ≥ 1)
- Description (textarea, optional, max 500 chars)
- Status: Active (default)
- [Save Service] → validates → saves to Dexie → toast → refreshes list

**Edit Service** (same modal, pre-populated):
- All fields editable
- Price change: forward-only (past invoices unaffected — price is snapshotted)
- Save → updates Dexie record

**Deactivate / Reactivate:**
- Toggle button per row
- Deactivate: confirmation "Hidden from billing. Past invoices unaffected." → sets status = 'inactive'
- Reactivate: immediate, no confirmation needed

**Permanent Delete:**
- Only shown if service has zero invoice history
- Checks: `COUNT(invoiceLineItems WHERE serviceId = id) = 0`
- If count > 0: delete button hidden; tooltip "Deactivate instead"
- If count = 0: confirmation → hard delete from Dexie

**Add Custom Category:**
- Small inline "Add category" link in the category dropdown
- Opens a mini-form inside the dropdown: input + save
- Saves to `serviceCategories` table; refreshes dropdown

### 5.3 — Billing Person Catalog View

- Categorised accordion or tab layout
- Only active services shown
- Read-only (no edit/delete controls)
- This view is also used as the service picker in the billing module (Phase 7)

### 5.4 — M5 Testing Checkpoint

- [ ] Add service "Test Haircut" → appears in list; appears in billing picker
- [ ] Edit price from ₹200 to ₹250 → old invoices still show ₹200 (snapshot confirmed in Dexie)
- [ ] Duplicate name "Test Haircut" → inline error "Service already exists"
- [ ] Deactivate service → disappears from billing picker; shows INACTIVE badge in catalog
- [ ] Delete service with no invoice history → hard deleted from Dexie
- [ ] Delete service with invoice history → delete button hidden
- [ ] Billing Person logs in → cannot see Add/Edit/Delete buttons
- [ ] Custom category "Wellness" added → available in add service modal

---

## Milestone M6 — Customer Management Module

**File:** `js/pages/customers.js`

### 6.1 — Page Layout

Two views accessible via sub-navigation tabs:
1. **Directory** — search and browse all customers
2. **Reports** — Lapsed, Birthdays, Referral Source (Owner only)

Plus the **Customer Profile** view (opens in-page when a customer is selected).

### 6.2 — Directory (Search)

- Large phone-number search field (primary, auto-focused on page load)
- Secondary name search (below or beside phone field)
- Results list: Name · Phone (masked last 4) · Last Visit · Status badges (LAPSED, BIRTHDAY)
- Click row → opens Customer Profile view

### 6.3 — Customer Creation

Triggered from:
- Directory: [+ New Customer] button
- Billing screen: inline when no phone match found

Form fields:
- Full Name* (2–100 chars)
- Phone Number* (exactly 10 digits; real-time format validation)
- Gender* (Male / Female / Other / Prefer not to say)
- Date of Birth* (date picker; must be past date; age 1–110)
- Referral Source* (dropdown: Walk-in / Friend Referral / Instagram / Google / Facebook / Other)
- Notes (textarea, optional, max 1,000 chars)

Validations:
- Phone uniqueness: check Dexie in real time as user types (from 10th digit)
- If phone exists: "This number is already registered. View existing profile?"
- All mandatory fields validated on submit

On save:
- Writes to Dexie with `syncStatus: 'PENDING'`
- Shows toast "Customer created"
- If created from billing screen: auto-attaches to current cart and returns to billing view

### 6.4 — Customer Profile View

Displayed as a full-width profile card:

**Header section:**
- Name (large), Phone, Gender, Age (auto-calculated from DOB)
- LAPSED badge (if last visit ≥ 45 days ago)
- BIRTHDAY badge (if birthday today or within 7 days)
- [Edit Profile] button

**Stats row (computed at runtime from Dexie):**
- Total Visits · Lifetime Spend · Average Spend · Last Visit Date · Days Since Last Visit

**Tab: Visit History**
- Table: Date · Services (comma-joined) · Staff · Total · Invoice link
- Sorted newest first
- Filter by date range (date pickers) + service category (dropdown)
- Click invoice link → opens invoice detail in slideover panel
- Summary row at bottom: Favourite Service (most frequent) · Favourite Staff

**Tab: Notes**
- Display current notes
- [Edit Notes] → inline textarea → save

### 6.5 — Customer Edit

Opens modal with pre-populated form:
- Editable: Name, Gender, DOB, Referral Source, Notes
- Phone number is READ-ONLY (greyed out with "Primary identifier — cannot be changed")
- On save: updates Dexie, `updatedAt`, `updatedBy`

### 6.6 — Owner Reports (Sub-page)

**Lapsed Customers:**
- Threshold filter: 45 / 60 / 90 / 180 days (dropdown, default 45)
- Table: Name · Phone · Last Visit · Days Inactive · Total Visits · Lifetime Spend
- Sorted by Days Inactive descending
- Click row → Customer Profile
- WhatsApp icon per row → opens `wa.me/<phone>` for manual outreach

**Upcoming Birthdays:**
- Table: Name · Phone · Birthday · Days Until Birthday
- Sorted by nearest first
- Customers with DOB = today shown in bold with "Today!" indicator

**Referral Source Report:**
- Donut chart + table: Source · Customer Count · Percentage
- Uses Chart.js doughnut

### 6.7 — Merge Profiles (Owner only)

- Accessible from a customer profile: [Merge Duplicate] button
- Opens modal: search for secondary profile by phone or name
- Preview: shows both profiles side-by-side (name, visits, spend)
- Confirm merge: older profile (lower createdAt) is kept; newer marked `status = MERGED`
- All invoices re-linked to the retained profile
- Toast "Profiles merged successfully"

### 6.8 — M6 Testing Checkpoint

- [ ] Search phone "9876543210" → correct customer appears in < 500ms
- [ ] LAPSED badge: Suresh Rao (last visit 60 days ago) shows badge
- [ ] BIRTHDAY badge: customer with DOB = today+3 shows badge
- [ ] Create customer with duplicate phone → blocked with error message
- [ ] DOB in future → blocked with validation error
- [ ] Visit history loads for customer with 30-day seeded data
- [ ] Lapsed report at 45-day threshold returns correct count
- [ ] Lapsed report at 60-day threshold: Suresh Rao appears
- [ ] Merge two profiles: invoices appear under surviving profile; merged profile shows MERGED status
- [ ] Staff role → customers page not accessible (RBAC redirect)

---

## Milestone M7 — Invoicing & Billing Module

**File:** `js/pages/billing.js`

This is the most complex module. Build it in strict sub-steps.

### 7.1 — Billing Page Layout

Split-pane layout:
```
┌──────────────────────┬─────────────────────────┐
│  LEFT PANE (60%)     │  RIGHT PANE (40%)        │
│  Cart / Line Items   │  Customer Card           │
│                      │  + Totals Panel          │
│                      │  + Payment Selector      │
│                      │  + Generate Button       │
└──────────────────────┴─────────────────────────┘
```

Below the split-pane (or separate sub-route):
- Past Invoices tab
- Refund Console

### 7.2 — Step A: Customer Identification

Top of billing screen (spans full width):
- Phone input (large, auto-focused, placeholder "Enter 10-digit phone number")
- Real-time search fires after 4th digit (debounced 200ms)

On match (card appears on right pane):
```
[Customer Card]
Priya Sharma · 9876543210
Last visit: 14 Jun 2026 · 23 visits · ₹34,500 lifetime
[LAPSED] [BIRTHDAY] (badges if applicable)
[Change Customer] link
```

On no match (after all 10 digits):
```
"No customer found for this number."
[+ Create New Customer] button
```

Clicking [+ Create New Customer]:
- Opens customer creation form as a modal
- Phone number pre-filled from search input
- On save: customer card populates; cart becomes active

### 7.3 — Step B: Cart (Line Items)

Left pane becomes active once customer is selected:

**[+ Add Service] button:**
- Opens service picker modal
- Two-column layout: category list on left, services on right
- Filter by name (live search)
- Click service → adds line item to cart → modal closes

**Cart Table (each row):**
```
[ Service Name ]  [ Professional ▾ ]  [ ₹ Price ]  [ 🗑 Remove ]
  Haircut            Ravi ▾              400          ✕
  Facial             Sunita ▾            600          ✕
```

Per row rules:
- Professional dropdown: only active staff; required before generate
- Price field: editable; default = catalog price; on change shows "Override" badge in amber
- Price = 0: shows confirmation dialog "Setting to ₹0, confirm?"
- Remove: removes row; recalculates totals

**Empty cart state:** "No services added yet. Click + Add Service to begin."

### 7.4 — Step C: Discounts

Below cart, in a "Discount" collapsible section:

```
[ No Discount ] [ Predefined Offer ▾ ] [ Manual ]   ← toggle buttons

If Predefined Offer selected:
  [ Monsoon Special 10% (−₹100) ▾ ]   (shows calculated savings)

If Manual selected:
  [ % | ₹ ] toggle   +   [ value input ]
```

Switching discount type clears the other field.
Predefined dropdown shows only ACTIVE offers.

### 7.5 — Step D: Totals Panel (Right Pane, sticky)

Updates in real time on every cart change:
```
Subtotal:          ₹1,000
Discount (10%):     −₹100
Taxable Amount:      ₹900
CGST (9%):            ₹81
SGST (9%):            ₹81
━━━━━━━━━━━━━━━━━━━━━━━━━
Grand Total:       ₹1,062
```

If GST disabled: show only Subtotal → Discount → Grand Total.
If discount = 0: hide discount row.

### 7.6 — Step E: Payment Method

Three large pill/card selectors below totals:

```
[ 💵 Cash ]  [ 📱 UPI ]  [ 💳 Card ]
```

Only one can be active at a time. Active state: highlighted border in primary colour.
None selected = Generate Invoice button disabled.

### 7.7 — Step F: Generate Invoice

**Pre-generation validation:**
- Customer selected ✓
- ≥ 1 line item ✓
- All line items have professional tagged ✓
- Payment method selected ✓

If any validation fails: button stays disabled; on hover shows tooltip listing what's missing.

**On click:**
1. Build invoice object:
   - Fetch next invoice number from Dexie (`MAX(invoiceNumber)` + 1)
   - Format: `SAL-YYYYMM-NNNN`
   - Snapshot: salon name/address/phone/GSTIN from salonProfile
   - Snapshot: all service names and professional names from line items
2. Write to Dexie in a single transaction:
   - Insert invoice record
   - Insert all invoice line items
   - Update customer `lastVisitDate` (if this is the most recent invoice)
3. Open Invoice Preview Modal

**Offline mode:** invoice_number = `LOCAL-${deviceId}-${Date.now()}`

### 7.8 — Invoice Preview Modal

Full-width modal with formatted invoice layout (matches spec from PRD Section 4.8):

```
[Salon Name]
[Address] | Phone: [phone]
GSTIN: [GSTIN] (if enabled)
─────────────────────────────
Invoice No: SAL-202607-0042
Date: 17 Jun 2026
─────────────────────────────
Customer: Priya Sharma | 9876543210
─────────────────────────────
# | Service     | By      | Price
1   Haircut       Ravi      ₹400
2   Facial        Sunita    ₹600
─────────────────────────────
Subtotal:         ₹1,000
Discount (10%):    −₹100
Taxable:            ₹900
CGST (9%):           ₹81
SGST (9%):           ₹81
─────────────────────────────
GRAND TOTAL:      ₹1,062
Payment: UPI
─────────────────────────────
Thank you for visiting [Salon Name]!
```

Modal footer buttons:
- [Share on WhatsApp] — primary button
- [Close] — secondary

**WhatsApp Share:**
```javascript
const text = encodeURIComponent(`
*${salonName} — Invoice*
Invoice: ${invoiceNumber} | Date: ${formatDate(today)}
Customer: ${customerName}

Services:
${lineItems.map(i => `• ${i.service} (${i.professional}) — ₹${i.price}`).join('\n')}

Subtotal: ₹${subtotal}
${discount > 0 ? `Discount: −₹${discount}\n` : ''}
${gstEnabled ? `CGST: ₹${cgst} | SGST: ₹${sgst}\n` : ''}
*Total: ₹${grandTotal}*
Payment: ${paymentMethod}

Thank you for visiting! 🙏
`.trim());

window.open(`https://wa.me/${customerPhone}?text=${text}`, '_blank');
```

On modal close: clear cart; reset customer selection; show toast "Invoice SAL-202607-0042 generated"

### 7.9 — Past Invoices

Sub-tab or separate section below billing area:

**Invoice list table:**
- Columns: Invoice No · Customer · Date · Amount · Payment · Status badge
- Search input (invoice number or customer name/phone) — debounced
- Filters: Date range · Payment method · Status
- Sorted newest first
- Click row → opens Invoice Detail in slideover

**Invoice Detail Slideover:**
- Full formatted invoice (same layout as preview modal)
- [Share on WhatsApp] button
- [Refund] button (only if status = PAID)

### 7.10 — Refund Console

Opens from Invoice Detail when [Refund] clicked:

Modal flow:
1. Title: "Process Refund — Invoice SAL-202607-0042"
2. Two options (radio):
   - Full Refund (₹1,062)
   - Partial Refund → shows amount input (₹1 min, < grand_total)
     - If input = grand_total → prompt "Use Full Refund instead?"
3. Reason field* (textarea, max 500 chars)
4. [Confirm Refund] button

On confirm:
- Write refund record to Dexie
- Update invoice status (REFUNDED or PARTIALLY_REFUNDED)
- Generate refund number: `REF-YYYYMM-NNNN`
- Update invoice list badge
- Toast "Refund processed — REF-202607-0001"
- Close modal

Block second refund: if invoice status ≠ PAID, Refund button hidden; tooltip "A refund has already been processed for this invoice."

### 7.11 — M7 Testing Checkpoint

- [ ] Search phone → customer card appears in < 500ms
- [ ] No match → "Create New Customer" → customer created → auto-attached to cart
- [ ] Add 3 services, tag different professionals → cart shows 3 rows
- [ ] Remove line item → totals recalculate immediately
- [ ] Override price → "Override" badge appears; subtotal updates
- [ ] Price override to ₹0 → confirmation dialog
- [ ] Apply Monsoon Special 10% → discount row appears; taxable amount = subtotal − 10%
- [ ] Manual flat discount ₹200 when subtotal ₹150 → blocked with inline error
- [ ] GST enabled: CGST/SGST rows appear; GST disabled: rows hidden
- [ ] Generate Invoice with missing professional → button disabled (tooltip explains)
- [ ] Generate Invoice → preview modal renders with correct figures
- [ ] WhatsApp button → opens wa.me in new tab with pre-filled text
- [ ] After generate: cart clears; customer deselects
- [ ] Invoice appears in Past Invoices list
- [ ] Click invoice → detail slideover opens
- [ ] Full refund → invoice shows REFUNDED badge; Re-refund attempt blocked
- [ ] Partial refund ₹200 on ₹1,062 invoice → status = PARTIALLY_REFUNDED
- [ ] Offline: billing works; invoice saved with LOCAL number; online banner disappears

---

## Milestone M8 — Staff Performance Module

**File:** `js/pages/staff.js`

Renders differently based on role:
- OWNER → full staff management + all performance reports
- STAFF → personal dashboard only (own data, no other staff visible)

### 8.1 — Owner: Staff Management

**Staff Directory Table:**
- Columns: Name · Designation · Commission % · Join Date · Status · Actions
- Filter by Status (Active / Inactive / All)
- Sort by Name, Join Date, Designation

**[+ Add Staff] Modal:**
- Full Name*, Phone* (10-digit, unique across staff), Designation* (free text or predefined list), Commission %* (0–100, 2 decimal places), Join Date* (not in future)
- On save:
  - Creates staff record in Dexie
  - Creates first `commissionRateHistory` entry: effectiveFrom = join_date
  - Auto-generates username (e.g., phone last 4 digits or first name + number) + temp password
  - Displays credentials to Owner in a copy-to-clipboard modal
  - Also creates corresponding user record in `users` table (role = STAFF)

**Edit Staff Modal:** pre-populated; all fields editable except phone

**Commission % Change:**
- Editable field in edit modal
- On save with changed %: write new `commissionRateHistory` record with `effectiveFrom = tomorrow's date`
- Old rate record gets `effectiveTo = today`
- Toast "Commission rate updated. New rate effective from [tomorrow's date]"

**Deactivate / Reactivate:**
- Deactivate: confirmation → status = INACTIVE; deactivation_date = today; staff removed from billing dropdown
- Reactivate: immediate; login re-enabled

### 8.2 — Owner: Performance Reports

**Individual Staff Report:**
- Staff picker (dropdown of all staff, default: first in list)
- Date range picker (start/end, max 365 days)
- [Generate Report] button

Report display:
```
[Ravi — Hair Stylist]
Period: 01 Jun 2026 – 17 Jun 2026

Summary:
  Total Services:     42
  Total Revenue:   ₹18,400
  Commission Rate:    15%
  Commission Earned: ₹2,760
  Avg Services/Day:   2.5

Itemised Table:
Date       | Service      | Customer   | Amount | Rate | Commission
01 Jun     | Haircut      | Priya S    | ₹400   | 15%  | ₹60
...

[Commission Rate segments if rate changed during period]
Period 01 Jun–14 Jun: 12% rate → ₹1,200 commission
Period 15 Jun–17 Jun: 15% rate → ₹360 commission
Total: ₹1,560
```

**Comparative Staff Report (All Staff):**
- Same date range picker
- Table: Name · Designation · Services · Revenue · Commission % · Commission Earned
- Sortable by any column (click header)
- Toggle: [Include Inactive Staff]
- Bottom performer highlighted with ↓ red arrow

### 8.3 — Staff Self-View (`/my-performance`)

Layout:
```
[Personal Performance Dashboard — Ravi]
Today     This Month     Custom Range ←→

[Today's Summary]
Services: 5 | Revenue: ₹2,200 | Commission: ₹330

[My Services — Today]
Service     | Customer    | Amount | Commission
Haircut       Anon         ₹400     ₹60
...

[Date Range Picker]
[My Earnings for This Range]
Total Revenue: ₹18,400 | Commission (15%): ₹2,760
```

Rules:
- Only shows `tagged_staff_id = currentUser.staffId` data
- Commission % visible as read-only (not editable)
- Customer names shown (the staff served them)
- No navigation to other staff data, customer records, or business totals

### 8.4 — M8 Testing Checkpoint

- [ ] Add new staff → credentials displayed → can log in with temp password
- [ ] Commission % change → new commission_rate_history record with effectiveFrom = tomorrow
- [ ] Generate report for Ravi May 1–31 → services before rate change show old rate, after show new rate
- [ ] Deactivate staff → disappears from billing dropdown; cannot log in
- [ ] Comparative report → sortable by revenue; bottom performer highlighted
- [ ] Staff self-view: only own services visible; trying to navigate to /staff redirects to /my-performance with toast
- [ ] Refunded invoice line items: excluded from staff revenue in performance report

---

## Milestone M9 — Owner Dashboard Module

**File:** `js/pages/dashboard.js`

### 9.1 — Dashboard Layout Implementation

4-row CSS Grid (see layout diagram from PRD Section A.2):

```css
.dashboard-grid {
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: var(--sp-6);
  padding: var(--sp-6);
}
.kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); }
.chart-row { display: grid; grid-template-columns: 1fr; }      /* full-width trend */
.list-row  { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
.alert-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
```

### 9.2 — Date Range Filter

Render in dashboard header:
```
[ Today ▾ ] (dropdown: Today | Yesterday | This Week | This Month | Custom)
```
Custom → opens a date-range picker (two date inputs + Apply button).
On selection: calls `refreshDashboard(startDate, endDate)`.
Active filter label shown persistently.

`refreshDashboard(start, end)` calls all widget-specific data fetch functions and re-renders.

Two widgets are NEVER filtered:
- Revenue Trend Chart: always fetches last 30 calendar days
- Upcoming Birthdays: always fetches today + 7 days

### 9.3 — KPI Cards

Each KPI card is a reusable component:
```javascript
function renderKPICard({ title, value, subLabel, wowIndicator, icon, onClick }) { ... }
// wowIndicator: { value: '+23%', direction: 'up' | 'down' | 'neutral' }
// onClick: opens drill-down slideover
```

**KPI Card HTML structure:**
```
.kpi-card (clickable)
  .kpi-icon  (SVG icon)
  .kpi-content
    .kpi-title    ("Today's Revenue")
    .kpi-value    ("₹12,400")
    .kpi-sub      ("12 New · 6 Returning") ← only for Customers Served
  .kpi-wow        ("↑ 23% WoW" in green or "↓ 8% WoW" in red)
```

**WoW Calculation per card:**

| KPI | WoW Logic |
|---|---|
| Today's Revenue | `(today_rev - same_weekday_last_week_rev) / same_weekday_last_week_rev * 100` |
| Customers Served | `customers_today - customers_same_weekday_last_week` (absolute) |
| ATV | `(today_atv - prior_atv) / prior_atv * 100` |
| Lapsed Count | Current count vs. count 7 days ago (net change, absolute) |
| Top Performer | No WoW; shows revenue + service count |

Show "—" if prior period had 0 (division-by-zero guard).

**KPI Drill-Down Slideovvers:**

| KPI Clicked | Slideover Content |
|---|---|
| Today's Revenue | Paid invoices table: invoice no · customer · services · amount · time |
| Customers Served | Customers table: name · invoice total · New/Returning badge |
| ATV | Per-customer ATV: name · total paid · ATV |
| Lapsed Customers | Lapsed list: name · phone (masked) · last visit · days inactive |
| Top Performer | That staff member's service log: service · customer · amount · time |

### 9.4 — Revenue Trend Chart

```javascript
// Chart.js bar chart — rolling last 30 days
const trendCtx = document.getElementById('revenue-trend-chart').getContext('2d');
const trendChart = new Chart(trendCtx, {
  type: 'bar',
  data: {
    labels: last30Days,          // ['May 19', 'May 20', ..., 'Jun 17']
    datasets: [{
      label: 'Revenue (₹)',
      data: revenuePerDay,        // array of daily sums
      backgroundColor: days.map((d, i) =>
        isToday(d) ? 'hsl(250,70%,55%)' : 'hsl(250,70%,80%)'
      ),
      borderRadius: 4
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { ... } },
    scales: { y: { beginAtZero: true, ticks: { callback: v => `₹${v}` } } }
  }
});
```

Note: This chart DOES NOT re-render on date range filter change. It always shows the rolling 30 days.

### 9.5 — Service Category Split (Doughnut)

```javascript
const splitCtx = document.getElementById('category-split-chart').getContext('2d');
const splitChart = new Chart(splitCtx, {
  type: 'doughnut',
  data: {
    labels: categories,          // ['Hair', 'Skin', 'Nails', 'Makeup', 'Other']
    datasets: [{ data: revenues, backgroundColor: [...5 colours] }]
  },
  options: {
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: (ctx) => `₹${ctx.parsed} (${pct}%)` } }
    },
    onClick: (event, elements) => {
      if (elements.length) openCategoryDrilldown(categories[elements[0].index]);
    }
  }
});
```

Re-renders on date filter change.

### 9.6 — Top 5 Services List

Rendered as a ranked list widget:
```
#  Service Name          Revenue    × Count
1  Haircut              ₹3,200       12×
2  Facial               ₹2,800        8×
...
```

Click row → slideover showing all invoices with that service in the selected range (paginated 20/page).

### 9.7 — Staff Leaderboard

Rendered as a ranked list:
```
#     Name        Revenue    Services
1 ★   Ravi        ₹4,200    9
2     Sunita      ₹3,800    7
3     Anita       ₹2,100    5
4 ↓   Priya         ₹600    2    ← bottom performer: red ↓
```

- ★ = gold star for top performer
- ↓ = red downward arrow for bottom performer
- Only shown when ≥ 2 active staff; if only 1 staff: no indicators
- Click row → that staff member's service list for the period in slideover

### 9.8 — Upcoming Birthdays Widget

```
🎂 Upcoming Birthdays
────────────────────────────────────
Today     Priya Sharma      XXXXX4210
Jun 19    Rahul Mehta       XXXXX1234
Jun 22    Anita Jain (3d)   XXXXX9988
────────────────────────────────────
```

- Today's birthdays in bold
- Masked phone number (XXXXX + last 4 digits)
- Click name → customer profile in new tab/modal
- If no birthdays: "No upcoming birthdays in the next 7 days."
- NEVER affected by date range filter

### 9.9 — Auto-Refresh

```javascript
let refreshInterval;

function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    if (navigator.onLine) refreshDashboard(currentStart, currentEnd);
  }, 5 * 60 * 1000); // 5 minutes
}

function stopAutoRefresh() {
  clearInterval(refreshInterval);
}
```

- Start on dashboard page load; stop on navigation away (router calls cleanup)
- Manual refresh button (↻) in header: calls `refreshDashboard()` immediately
- "Last updated: 14:32" timestamp in header, updated on each refresh

### 9.10 — Edge Case UI States

| Condition | UI Behaviour |
|---|---|
| No transactions in selected range | KPI cards show ₹0 / 0 / — Charts show "No data for this period." |
| ATV when 0 customers | Shows "—" not ₹0 |
| App offline | Offline banner shown; render from Dexie cache; refresh button shows "No network" |
| Only 1 active staff | Leaderboard shows 1 row; no ★ or ↓ indicators |
| No birthdays in 7 days | Birthday widget: "No upcoming birthdays." |
| WoW prior period = ₹0 | WoW indicator shows "—" not "+∞%" |

### 9.11 — M9 Testing Checkpoint

- [ ] Dashboard loads in < 300ms skeleton, < 2s full data
- [ ] Today's Revenue matches sum of paid invoices in Dexie for today
- [ ] "This Week" filter → all widgets re-render for correct date range
- [ ] Revenue Trend chart: always shows 30 days regardless of filter selected
- [ ] Birthday widget: always shows 7-day window regardless of filter
- [ ] WoW indicator shows "—" when prior period is empty
- [ ] ATV shows "—" when no customers today
- [ ] Click any KPI → slideover opens with correct records
- [ ] Click doughnut segment → slideover with services in that category
- [ ] Click staff leaderboard row → staff service list in slideover
- [ ] Auto-refresh fires after 5 minutes (verify with console log)
- [ ] Offline: dashboard renders from Dexie cache with offline banner
- [ ] Lapsed KPI count matches `getLapsedCustomers(45)` result

---

## Milestone M10 — Integration & End-to-End Testing

### 10.1 — Cross-Module Data Flow Tests

| Test Scenario | Expected Outcome |
|---|---|
| Create customer → bill → check visit history | Visit appears in customer profile with correct service, staff, amount |
| Bill customer → check Dashboard Today's Revenue | Revenue card updates on next refresh |
| Bill service → check Staff Leaderboard | Staff member's revenue and service count update |
| Bill with GST → check invoice totals | CGST + SGST calculated on post-discount amount |
| Change service price → bill same service | New price used in cart; old invoice shows old snapshotted price |
| Bill customer → refund → check Dashboard Revenue | Refunded amount excluded from revenue on next refresh |
| Bill customer → refund → check Staff Leaderboard | Staff revenue/commission excludes refunded line item |
| Deactivate staff mid-day → check billing picker | Deactivated staff no longer in professional dropdown |
| Deactivate service → check billing picker | Service no longer in service picker |
| Create user → log in → check RBAC | User sees only routes appropriate to their role |

### 10.2 — RBAC Testing Matrix

For each role, test direct URL access to every route:

| Route | OWNER | BILLING_PERSON | STAFF |
|---|---|---|---|
| #/dashboard | ✅ loads | ❌ redirect + toast | ❌ redirect + toast |
| #/billing | ✅ loads | ✅ loads | ❌ redirect + toast |
| #/customers | ✅ loads | ✅ loads | ❌ redirect + toast |
| #/catalog | ✅ full CRUD | ✅ read-only | ❌ redirect + toast |
| #/staff | ✅ loads | ❌ redirect + toast | ❌ redirect + toast |
| #/my-performance | ✅ loads (sees all) | ❌ redirect + toast | ✅ own data only |
| #/settings | ✅ loads | ❌ redirect + toast | ❌ redirect + toast |

### 10.3 — Offline Behaviour Testing

1. Open DevTools → Network → set to Offline
2. Verify offline banner appears
3. Create a customer (should succeed; syncStatus = PENDING in Dexie)
4. Create an invoice (should succeed; LOCAL invoice number assigned)
5. Check Dexie: all PENDING records have syncStatus = 'PENDING'
6. Set network back to Online
7. Verify offline banner disappears
8. Verify sync simulation runs (toast: "N record(s) synced")
9. Verify invoice numbers reconciled (in backend phase; for now LOCAL numbers remain)

### 10.4 — Browser Compatibility Testing

Test all features in:
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Edge (latest 2 versions)
- [ ] Chrome on Android tablet (functional check only)

### 10.5 — Performance Testing

| Scenario | Target |
|---|---|
| Customer phone search (10-digit) | < 500ms result |
| Invoice creation (Dexie write) | < 1 second |
| Dashboard full load (120 seeded invoices) | < 2 seconds |
| Staff performance report (365-day, 4 staff) | < 5 seconds |
| Page navigation (hash change) | < 300ms to skeleton |

### 10.6 — PRD Edge Case Verification

Run through every edge case listed in each PRD section and confirm the UI handles it as specified:

- [ ] Customer PRD: EC-01 through EC-10
- [ ] Invoicing PRD: EC-I-01 through EC-I-12
- [ ] Staff PRD: EC-01 through EC-10
- [ ] Dashboard PRD: EC-A1 through EC-A14
- [ ] Auth PRD: EC-B1 through EC-B8
- [ ] Catalog PRD: EC-C1 through EC-C7
- [ ] Settings PRD: Edge Cases 1–5

---

## Frontend Completion Checklist

Before declaring the frontend complete and moving to backend:

### Functionality
- [ ] All 7 modules fully functional
- [ ] All 15 user stories per module have passing acceptance criteria
- [ ] All RBAC rules enforced at route level
- [ ] Offline mode functional for all core workflows
- [ ] All edge cases handled as per PRD

### UI / UX
- [ ] Consistent use of CSS variables throughout
- [ ] Responsive to 1024px+ width; usable on tablets
- [ ] All forms have proper validation and error states
- [ ] All modals trap focus and close on Escape
- [ ] Toast notifications for all success/failure actions
- [ ] Loading states visible for all async operations

### Data Integrity
- [ ] Invoice snapshots: changing catalog/staff/settings doesn't alter past invoices
- [ ] Commission rate history: old invoices use historical rate, not current rate
- [ ] Soft deletes: no hard deletes except unused catalog services
- [ ] Refund exclusion: refunded amounts excluded from all revenue/commission totals

### Code Quality
- [ ] No global variable pollution (all state inside ES6 module scope)
- [ ] No `console.log` statements in production code
- [ ] All Dexie writes wrapped in try/catch with user-facing error toasts
- [ ] All chart instances destroyed before re-creating (prevent Chart.js memory leaks)
- [ ] Search inputs debounced (no unnecessary Dexie reads)

---

*Frontend Implementation Plan v1.0 — Salon Management Web App — June 2026*
*Next: Backend Implementation Plan → see implementation_plan_backend.md*
