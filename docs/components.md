# Component Inventory — Salon Application V1

Canonical list of UI components. All components are vanilla JS + CSS; no framework.
Token file: `design/tokens.css`

---

## Atoms

### Button
- Variants: `primary`, `ghost`, `danger`
- Props: `disabled`, `size` (sm / md)
- States: default, hover, disabled, loading (spinner inline)

### Input
- Variants: text, phone, number, date, password
- Phone: digits only; triggers customer lookup from 4th digit onward
- Required indicator: red asterisk via CSS `[required]` selector

### Select
- Variants: single, searchable (custom dropdown with filter input)
- Used for: payment method, discount type, professional picker

### Badge / Status Chip
- Variants: `paid` (green), `refunded` (red), `partially-refunded` (amber), `offline` (grey), `lapsed` (red), `active` (green), `inactive` (muted)
- Size: always `--text-xs`, `--radius-full`, pill shape

### Toggle
- Used for: GST on/off in Settings; sidebar collapse
- Accessible: `role="switch"` with `aria-checked`

### WoW Delta Indicator
- Displays week-over-week % change on KPI cards
- Arrow up (green) for positive, arrow down (red) for negative, dash for 0
- Format: `▲ 12.4%` or `▼ 3.1%`

---

## Molecules

### KPI Card
- Elements: label, primary value (--text-xl), WoW delta indicator
- Used in: Owner Dashboard KPI strip (4 cards in a row)
- Loading state: skeleton shimmer

### Toast / Notification
- Variants: `success`, `error`, `warning`, `info`
- Auto-dismiss after 4 seconds; stacks bottom-right
- Dismiss on click

### Modal
- Overlay with focus trap; returns focus to trigger on close
- Dismiss on Escape key and backdrop click
- Used for: Add/Edit forms (customer, service, offer, user), confirm actions

### Slideover
- Width: 40% from right edge; used for invoice detail preview
- Same focus-trap rules as Modal

### Date Range Picker
- Two date inputs (From / To) with calendar popover
- Validates: `from` ≤ `to`; cannot select future dates for reports
- Used in: Staff Performance report, Invoice History filter

### Offline Banner
- Persistent amber strip pinned at the top (below topbar)
- Text: "You are offline — changes will sync when connection is restored."
- Shown/hidden via `navigator.onLine` event listeners
- z-index: `--z-topbar + 1`

### Session Timeout Warner
- Modal shown 2 minutes before 30-minute inactivity cutoff
- "Stay logged in" resets timer; otherwise auto-logout at 30 min

---

## Organisms

### Sidebar
- Width: `--sidebar-width` (collapsible to `--sidebar-width-collapsed`)
- Role-filtered nav links (hidden if role lacks access)
- Bottom: logged-in user name + role badge + logout button
- Active link highlighted with `--color-primary` left border

### Billing Cart
- Line item rows: service name (read-only snap) | unit price | override price field | professional dropdown | remove icon
- Discount row: predefined offer picker OR manual (% / ₹) toggle + value input
- GST rows (shown only if `gst_enabled`): CGST 9% and SGST 9% rows with computed amounts
- Footer summary: Subtotal → Discount (−) → Taxable Amount → CGST → SGST → **Grand Total**
- Grand Total displayed large (`--text-xl`, bold)

### Customer Lookup
- Phone number input; live search from 4th digit
- Dropdown list: name + phone + last visit date
- "New Customer" quick-create action at bottom of dropdown if no match
- Clears and resets when billing cart is finalised

### Invoice Preview
- Read-only formatted invoice inside a Modal or Slideover
- Header: salon name, address, phone, GSTIN (if GST enabled)
- Line items table: service | professional | price
- Totals block matching Billing Cart footer
- Footer actions: "Share via WhatsApp" (wa.me pre-filled), "Print" (window.print)

### Lapsed Customer List
- Table: name | phone | last visit date | days inactive
- Per-row "Share on WhatsApp" button (pre-filled number only, no message template)
- Filter: shows only customers inactive > 45 days

---

## Charts (Chart.js)

### Revenue Trend
- Type: bar chart, daily buckets
- Period: always 30-day rolling — **unaffected by dashboard date range filter**
- Token: `--chart-1`

### Service Category Split
- Type: doughnut chart
- Segments per category (Hair, Skin, Nails, …)
- Tokens: `--chart-1` through `--chart-5`

### Staff Leaderboard
- Type: horizontal bar chart or sortable table (prefer table for accessibility)
- Columns: staff name | services count | revenue | commission earned

---

## Screens → Component Mapping

| Screen | Key organisms used |
|---|---|
| Login | Input, Button |
| Dashboard | KPI Card ×4, Revenue Trend, Service Category Split, Lapsed teaser, Upcoming Birthdays |
| Customer List | Customer Lookup, Table, Badge |
| Customer Profile | Timeline list, Invoice rows, Badge |
| Create Invoice | Customer Lookup, Billing Cart, Select, Modal (invoice preview) |
| Invoice History | Date Range Picker, Table, Badge, Slideover |
| Invoice Detail | Invoice Preview (Slideover), Button (refund trigger) |
| Refund | Modal, Input (amount), Select (type) |
| Service Catalog | Table, Modal (add/edit service), Badge, Toggle (status) |
| Staff List | Table, Badge, Modal (add staff) |
| Staff Performance Report | Date Range Picker, Staff Leaderboard chart, Table |
| My Performance | Date Range Picker, Table |
| Settings — Salon Profile | Input, Toggle (GST), Button |
| Settings — Discount Offers | Table, Modal (add offer), Badge, Toggle |
| Settings — User Management | Table, Modal (add/reset user), Badge |

---

## Accessibility Baseline

- All interactive controls: visible focus ring (`outline: 2px solid var(--color-primary)`)
- Modals and Slideovers: focus trap, Escape to close, return focus to opener
- Form inputs: `<label>` explicitly associated via `for`/`id`
- Status badges: `aria-label` with full text (not just colour)
- Offline Banner: `role="status"` so screen readers announce it
- Charts: `aria-label` describing chart type and period

---

## File Organisation

```
src/
  components/      # atomic and molecule components (JS + CSS per component)
  organisms/       # sidebar, billing-cart, customer-lookup, invoice-preview
  pages/           # page-level modules that orchestrate components
  lib/
    db.js          # Dexie.js wrapper and store definitions
    money.js       # formatCurrency, calculateGST, calculateDiscount
    date.js        # formatDate, daysSince, isLapsed(date, threshold=45)
    router.js      # client-side hash or pushState router
    sync.js        # online/offline detection and sync queue
```
