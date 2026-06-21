# Invoicing & Billing — Product Requirements Document

**Module:** Invoicing & Billing
**Application:** Salon Management Web App (Single Salon, Billing Counter)
**Version:** V1
**Date:** 2026-06-17
**Status:** Draft — Ready for Review

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

The Invoicing & Billing module is the transactional engine of the salon management system. It is the primary workflow the **Billing Person** executes after every customer service: look up the customer, add services to a cart, tag the professional who performed each service, apply any discount, select a payment method, generate a GST-compliant invoice, and share it with the customer via WhatsApp.

Every invoice created here feeds directly into the Owner Dashboard (revenue, staff performance, top services) and the Customer Management module (visit history, lapsed status). It is the connective tissue of the entire product.

**Design Principle:** Speed at the counter is paramount. A walk-in customer standing at the counter while the billing person taps through the app has zero patience. Every action must be achievable in as few taps as possible. The checkout workflow targets completion in under 90 seconds for a standard 2-service invoice.

### 1.2 Scope

| In Scope | Out of Scope (V1) |
|---|---|
| Customer lookup and quick creation at billing | Split payments across multiple methods |
| Cart with multi-service, multi-professional line items | Tips collection |
| Price override per line item | Appointment-linked billing |
| Manual and predefined discounts | Package / combo session billing |
| GST (CGST + SGST) auto-calculation | Barcode / POS hardware scanning |
| Cash / UPI / Card single-method payment | Payment gateway integration (online payments) |
| Auto-sequential invoice numbering | Email invoice sharing |
| Invoice preview and WhatsApp sharing | Invoice PDF download (V1.5) |
| Full and partial refunds | Multiple partial refunds on one invoice |
| Invoice history with search and filter | Automated WhatsApp API sending |
| Offline billing with sync | |
| Refund console | |

### 1.3 Actors

| Actor | Role | Access |
|---|---|---|
| **Billing Person** | Primary operator; creates all invoices at the counter | Full cart, invoice creation, WhatsApp share, refunds, invoice history view |
| **Owner** | Reviews invoices; can also bill | All Billing Person access + invoice reports across date ranges |
| **Staff / Professional** | Tagged on line items; does not interact with billing directly | No billing access |

---

## 2. User Stories

### 2.1 Cart & Checkout

**US-I-01 — Customer Lookup at Billing**
> As a **Billing Person**, I want to look up a customer by their phone number before billing so that the invoice is linked to the correct customer profile.

**Acceptance Criteria:**
- Phone input field is the first element on the billing screen
- Real-time search begins from the 4th digit
- Matching profile displays: name, phone, last visit date, visit count
- If no match: "Create New Customer" inline form opens without leaving the billing screen
- Customer must be selected or created before the cart is activated

---

**US-I-02 — Add Services to the Cart**
> As a **Billing Person**, I want to search and add services from the catalog to the cart so that the bill reflects all services rendered.

**Acceptance Criteria:**
- Service search/picker shows only active catalog services
- Services are browsable by category (Hair, Skin, Nails, etc.)
- Selecting a service adds it as a new line item in the cart
- Multiple services can be added; no maximum limit in V1
- Each new line item defaults to the catalog price

---

**US-I-03 — Tag a Professional per Line Item**
> As a **Billing Person**, I want to tag the professional who performed each service so that performance data and commissions are correctly attributed.

**Acceptance Criteria:**
- Each line item has a mandatory "Professional" dropdown showing only active staff
- Different professionals can be tagged on different line items in the same invoice
- The same professional can appear on multiple line items
- Invoice cannot be generated until every line item has a professional tagged

---

**US-I-04 — Override Unit Price**
> As a **Billing Person**, I want to override the catalog price for a specific line item so that I can bill special pricing decided at the service level.

**Acceptance Criteria:**
- Each line item has an editable price field, defaulting to catalog price
- Editing the price marks the row with a "Price Override" badge
- Price cannot be negative; ₹0 is allowed (complimentary service)
- Overriding ₹0 shows a soft confirmation: "Setting this service to ₹0. Confirm?"
- Grand total recalculates in real time on any price change

---

**US-I-05 — Remove a Line Item**
> As a **Billing Person**, I want to remove a service line item from the cart so that billing errors can be corrected before generating the invoice.

**Acceptance Criteria:**
- Each cart row has a remove (✕) button
- Removing a row recalculates totals immediately
- If all rows are removed, cart returns to the empty state with a prompt to add services

---

**US-I-06 — Apply a Predefined Discount**
> As a **Billing Person**, I want to apply a predefined discount offer created by the owner so that standard promotions are applied consistently without manual calculation.

**Acceptance Criteria:**
- Discount section shows a dropdown of all active predefined offers (name + value)
- Selecting an offer auto-populates the discount line
- Only one discount per invoice (predefined or manual, not both simultaneously)
- Discount amount shown as a line item in the totals section
- Discount applied to pre-tax subtotal

---

**US-I-07 — Apply a Manual Discount**
> As a **Billing Person**, I want to enter a one-off discount (percentage or flat amount) so that I can handle ad-hoc price negotiations at the counter.

**Acceptance Criteria:**
- Toggle between "%" or "₹" discount type
- Numeric input for discount value
- Percentage discount: 0.01–100% allowed
- Flat discount: ₹1 minimum; cannot exceed the pre-tax subtotal
- Only one discount per invoice; selecting manual removes any predefined discount
- Real-time recalculation on every keystroke

---

**US-I-08 — View Running Totals in Real Time**
> As a **Billing Person**, I want to see the running subtotal, discount, tax, and grand total update as I build the cart so that I can confirm the amount before showing it to the customer.

**Acceptance Criteria:**
- Totals section always visible (sticky / fixed position in the layout)
- Shows: Subtotal → Discount (−) → Taxable Amount → CGST (9%) → SGST (9%) → **Grand Total**
- If GST is disabled in Settings, tax rows are hidden
- Grand Total displayed in large, prominent typography

---

**US-I-09 — Select Payment Method**
> As a **Billing Person**, I want to select how the customer paid (Cash / UPI / Card) so that daily cash reconciliation is accurate.

**Acceptance Criteria:**
- Three clearly labelled options: Cash · UPI · Card
- One must be selected before invoice can be generated
- Selection highlighted (active state)
- No split-payment in V1

---

**US-I-10 — Generate Invoice**
> As a **Billing Person**, I want to generate the invoice with a single click after confirming the cart so that the transaction is recorded instantly.

**Acceptance Criteria:**
- "Generate Invoice" button is prominent and enabled only when: customer selected, ≥1 line item, all line items have professional tagged, payment method selected
- Clicking generates an auto-sequential invoice number
- Invoice preview modal opens showing the full formatted invoice
- Invoice is saved to the database (and marked PENDING sync if offline)
- Cart is cleared after successful generation

---

**US-I-11 — Share Invoice via WhatsApp**
> As a **Billing Person**, I want to share the generated invoice with the customer on WhatsApp so that they have a digital record of their bill.

**Acceptance Criteria:**
- Invoice preview modal includes a "Share on WhatsApp" button
- Button opens WhatsApp (wa.me/<customer_phone>) pre-filled with a formatted text summary of the invoice
- Summary includes: Salon name, invoice number, date, services list, total, payment method, thank-you note
- Share is manual (user taps Send in WhatsApp); no auto-send
- Button remains accessible from past invoice detail view as well

---

### 2.2 Invoice History

**US-I-12 — View Past Invoices**
> As a **Billing Person** or **Owner**, I want to browse the list of all past invoices so that I can look up any transaction.

**Acceptance Criteria:**
- List sorted by date descending (newest first)
- Each row: invoice number · customer name · date · grand total · payment method · status badge (Paid / Refunded / Partially Refunded)
- Searchable by invoice number, customer name, or customer phone
- Filterable by date range, payment method, and status

---

**US-I-13 — View Invoice Detail**
> As a **Billing Person** or **Owner**, I want to open any past invoice and see the full breakdown so that I can answer customer queries or verify a transaction.

**Acceptance Criteria:**
- Full formatted invoice view (same as what was shared with the customer)
- Includes all line items, professional names, discounts, tax split, payment method
- "Share on WhatsApp" button available (re-shares the same invoice)
- Refund button visible if invoice status = PAID

---

### 2.3 Refunds

**US-I-14 — Process a Full Refund**
> As a **Billing Person** or **Owner**, I want to reverse a paid invoice entirely so that I can handle cases where the service was unsatisfactory or an error was made.

**Acceptance Criteria:**
- "Refund" action available on PAID invoices only
- Option: Full Refund
- Reason field: mandatory, free text, max 500 characters
- Confirmation modal before processing
- Invoice status changes to REFUNDED
- Refund number assigned (REF-YYYYMM-NNNN)
- Revenue, ATV, and staff performance totals update on next refresh (refunded invoice excluded)

---

**US-I-15 — Process a Partial Refund**
> As a **Billing Person** or **Owner**, I want to refund part of an invoice so that I can compensate a customer for a specific service dispute without voiding the whole bill.

**Acceptance Criteria:**
- Option: Partial Refund with an amount input field
- Minimum partial refund: ₹1
- Maximum partial refund: invoice grand_total − ₹1 (if equal to grand_total, prompt to use Full Refund instead)
- Reason field: mandatory
- Invoice status changes to PARTIALLY_REFUNDED
- Only one refund event per invoice in V1; subsequent refund attempts on a PARTIALLY_REFUNDED invoice are blocked with: "A refund has already been processed for this invoice."

---

## 3. Detailed User Flows

### Flow A — Standard Billing Checkout

```
Billing Person opens /billing
  │
  ├─ Step 1: Customer Lookup
  │    → Types phone number (min 4 digits for live search)
  │    → Match found? → Customer card displays; proceed to cart
  │    → No match? → "Create New Customer" inline form (Name, Phone, Gender, DOB, Referral)
  │                  → Save → Customer created → Cart activated
  │
  ├─ Step 2: Build Cart
  │    → Click [+ Add Service]
  │    → Service picker (categorised list of active services)
  │    → Select service → Added as line item (default catalog price)
  │    → Per line item:
  │         - Edit price if needed (marks as override)
  │         - Select professional from dropdown
  │    → Repeat for all services
  │
  ├─ Step 3: Apply Discount (Optional)
  │    → Select predefined offer from dropdown  OR
  │    → Toggle to Manual, enter % or ₹ value
  │    → Totals recalculate instantly
  │
  ├─ Step 4: Select Payment Method
  │    → Tap: Cash | UPI | Card
  │
  ├─ Step 5: Generate Invoice
  │    → Click [Generate Invoice]
  │    → System validates: customer ✓ · line items ✓ · all professionals tagged ✓ · payment ✓
  │    → Invoice number assigned (SAL-YYYYMM-NNNN)
  │    → Invoice preview modal opens
  │    → Invoice saved to DB (PENDING sync if offline)
  │
  └─ Step 6: Share
       → Click [Share on WhatsApp] → WhatsApp opens with pre-filled summary
       → Or close modal; invoice now in history
```

### Flow B — Invoice History & Refund

```
Billing Person / Owner → Past Invoices
  │
  ├─ Browse list or search by number / name / phone
  ├─ Click invoice row → Full invoice detail view
  │
  ├─ Status = PAID?
  │    → [Refund] button visible
  │    → Click [Refund]
  │         → Choose: Full Refund | Partial Refund (+ amount field)
  │         → Enter mandatory reason
  │         → Confirmation modal: "Refund ₹X for Invoice SAL-YYYYMM-NNNN?"
  │         → Confirm → Refund processed
  │              → Invoice status updated
  │              → Refund record created (REF-YYYYMM-NNNN)
  │              → Toast: "Refund processed successfully"
  │              → Dashboard and staff reports updated on next refresh
  │
  └─ Status = REFUNDED or PARTIALLY_REFUNDED?
       → Refund button hidden; refund details shown inline
```

### Flow C — Offline Billing

```
Billing Person opens /billing while offline
  │
  ├─ Offline banner shown: "You are offline. Invoices will sync when reconnected."
  ├─ Customer lookup: from local IndexedDB cache
  ├─ Cart build: from cached catalog
  ├─ Invoice generated → invoice_number = LOCAL-<device_id>-<timestamp>
  │                    → sync_status = PENDING
  │
  ├─ WhatsApp share: pre-fills with LOCAL invoice number
  │
  └─ On reconnect (within 30 seconds):
       → PENDING invoices synced to server
       → Server assigns canonical number: SAL-YYYYMM-NNNN
       → Invoice record updated with final number
       → Toast: "N invoice(s) synced successfully"
```

### Flow D — Totals Calculation

```
Given: 2 line items, GST enabled, one predefined discount

  Service 1 (Haircut):    ₹400  tagged: Ravi
  Service 2 (Facial):     ₹600  tagged: Sunita
                         ──────
  Subtotal:               ₹1,000

  Predefined Discount (10%):  −₹100
                              ──────
  Taxable Amount:             ₹900

  CGST  (9% of ₹900):         ₹81
  SGST  (9% of ₹900):         ₹81
                              ──────
  Grand Total:                ₹1,062

  Payment Method: UPI
```

---

## 4. Functional Requirements

### 4.1 Customer Identification

| ID | Requirement |
|---|---|
| FR-I-01 | System SHALL provide a phone number search field as the first element on the billing screen. Customer must be identified before the cart is usable. |
| FR-I-02 | System SHALL perform real-time search beginning from the 4th digit, querying local cache first (< 500 ms). |
| FR-I-03 | On customer match, system SHALL display: name, phone, last visit date, visit count. |
| FR-I-04 | On no match, system SHALL offer an inline "Create New Customer" form within the billing screen. Created customer is immediately attached to the current cart. |
| FR-I-05 | Pre-filling the phone number from the search input into the creation form is mandatory. |

### 4.2 Cart Management

| ID | Requirement |
|---|---|
| FR-I-06 | System SHALL allow adding multiple active catalog services to the cart. No maximum line item count in V1. |
| FR-I-07 | Only services with status = 'active' SHALL be available in the service picker. |
| FR-I-08 | Each line item SHALL have a mandatory "Professional" field; only active staff SHALL appear in the dropdown. |
| FR-I-09 | Multiple different professionals can be tagged across line items on the same invoice. |
| FR-I-10 | Billing Person SHALL be able to override the unit price of any line item. Override is tracked with `is_price_override = true`. |
| FR-I-11 | Price override to ₹0 SHALL require explicit confirmation before saving. |
| FR-I-12 | Billing Person SHALL be able to remove any line item. Totals recalculate immediately. |
| FR-I-13 | Cart state SHALL persist across tab switches and page refreshes (stored in localStorage) until invoice is generated or explicitly cleared. |

### 4.3 Discounts

| ID | Requirement |
|---|---|
| FR-I-14 | Only one discount may be applied per invoice: either a predefined offer OR a manual entry. Selecting one clears the other. |
| FR-I-15 | Predefined discount picker SHALL show only active offers. |
| FR-I-16 | Manual discount SHALL support two modes: Percentage (%) or Flat Amount (₹), selectable via a toggle. |
| FR-I-17 | Percentage discount SHALL be validated: 0.01% minimum, 100% maximum. |
| FR-I-18 | Flat discount SHALL be validated: ₹1 minimum; SHALL NOT exceed the pre-tax subtotal. |
| FR-I-19 | Discount is applied to the pre-tax subtotal. GST is calculated on the post-discount (taxable) amount only. |

### 4.4 Tax Calculation

| ID | Requirement |
|---|---|
| FR-I-20 | If GST is enabled in Settings, system SHALL automatically calculate CGST (9%) and SGST (9%) on the taxable amount. |
| FR-I-21 | Tax fields SHALL NOT be editable by the Billing Person. They are system-derived. |
| FR-I-22 | If GST is disabled, CGST, SGST, and tax-related rows SHALL be hidden from the cart and the invoice. |
| FR-I-23 | GST status at the time of invoice generation is snapshotted on the invoice (`gst_enabled` field). |

### 4.5 Real-Time Totals

| ID | Requirement |
|---|---|
| FR-I-24 | System SHALL display in a sticky totals panel: Subtotal · Discount · Taxable Amount · CGST · SGST · Grand Total. |
| FR-I-25 | All values SHALL update in real time on every cart change (add/remove item, price override, discount change). |
| FR-I-26 | If GST is disabled, totals panel shows: Subtotal · Discount · Grand Total only. |

### 4.6 Payment Method

| ID | Requirement |
|---|---|
| FR-I-27 | System SHALL present three payment method options: Cash · UPI · Card. |
| FR-I-28 | Payment method is mandatory before invoice generation. |
| FR-I-29 | No split-payment across multiple methods in V1. |

### 4.7 Invoice Generation

| ID | Requirement |
|---|---|
| FR-I-30 | "Generate Invoice" button SHALL be enabled only when: customer selected AND ≥1 line item exists AND all line items have a professional tagged AND payment method is selected. |
| FR-I-31 | System SHALL assign a sequential invoice number on generation: format `SAL-YYYYMM-NNNN`. Offline format: `LOCAL-<device_id>-<unix_timestamp>`. |
| FR-I-32 | Invoice number is system-assigned. Billing Person cannot set or modify it. |
| FR-I-33 | Invoice preview modal SHALL display the full formatted invoice (see A.7.2 Invoice Layout). |
| FR-I-34 | Invoice is immutable once generated. Edits are not permitted. Only refunds are allowed post-generation. |
| FR-I-35 | Cart SHALL be cleared automatically after successful invoice generation. |
| FR-I-36 | System SHALL record: invoice_date (server time), created_by (user ID), and all snapshot fields at time of generation. |

### 4.8 Invoice Layout (Printed / Preview)

The invoice SHALL display the following sections in order:

```
[Salon Name]
[Address]    |   Phone: [phone]
GSTIN: [GSTIN]   (only if GST enabled)
─────────────────────────────────
Invoice No: SAL-202607-0042
Date: 17 Jun 2026
─────────────────────────────────
Customer: [Name]   Phone: [Phone]
─────────────────────────────────
# | Service          | By        | Price
1 | Haircut          | Ravi      | ₹400
2 | Facial           | Sunita    | ₹600
─────────────────────────────────
Subtotal:                  ₹1,000
Discount (Monsoon 10%):    −₹100
Taxable Amount:              ₹900
CGST (9%):                   ₹81
SGST (9%):                   ₹81
─────────────────────────────────
GRAND TOTAL:               ₹1,062
Payment: UPI
─────────────────────────────────
Thank you for visiting [Salon Name]!
```

### 4.9 WhatsApp Sharing

| ID | Requirement |
|---|---|
| FR-I-37 | Invoice preview modal SHALL include a prominent "Share on WhatsApp" button. |
| FR-I-38 | Button SHALL open `wa.me/<customer_phone>?text=<encoded_summary>` in a new tab. |
| FR-I-39 | Pre-filled text summary SHALL include: Salon name, invoice number, date, itemised service list (service + professional), discount line, grand total, payment method, and a thank-you message. |
| FR-I-40 | WhatsApp sharing is manual. The billing person taps Send in WhatsApp. No auto-send. |
| FR-I-41 | "Share on WhatsApp" SHALL also be available from the Invoice Detail view in history. |

### 4.10 Invoice History

| ID | Requirement |
|---|---|
| FR-I-42 | System SHALL provide an Invoice History view accessible to Billing Person and Owner. |
| FR-I-43 | List SHALL be sorted newest-first by default. |
| FR-I-44 | Each row SHALL display: invoice number · customer name · date · grand total · payment method · status badge. |
| FR-I-45 | System SHALL support search by invoice number, customer name, or customer phone. |
| FR-I-46 | System SHALL support filtering by: date range · payment method · status (Paid / Refunded / Partially Refunded). |
| FR-I-47 | Clicking a row opens the full Invoice Detail view. |

### 4.11 Refunds

| ID | Requirement |
|---|---|
| FR-I-48 | Refund option SHALL be available only on invoices with status = PAID. |
| FR-I-49 | Two refund types SHALL be supported: Full Refund and Partial Refund. |
| FR-I-50 | Partial refund amount: ₹1 minimum; less than grand_total. If amount = grand_total, system SHALL prompt: "This equals the full amount. Use Full Refund instead?" |
| FR-I-51 | Reason field is mandatory for all refund types; max 500 characters. |
| FR-I-52 | Confirmation modal SHALL show the refund amount and invoice number before processing. |
| FR-I-53 | Upon processing: invoice status updates; refund record created with auto-assigned refund number `REF-YYYYMM-NNNN`. |
| FR-I-54 | Only one refund event per invoice in V1. Subsequent refund attempts on REFUNDED or PARTIALLY_REFUNDED invoices are blocked. |
| FR-I-55 | Refunded amounts are excluded from revenue, ATV, staff performance, and dashboard calculations. |
| FR-I-56 | A refund does NOT update the customer's last_visit_date (the original visit still counts as a visit). |

### 4.12 Offline Behaviour

| ID | Requirement |
|---|---|
| FR-I-57 | Full billing workflow SHALL be available offline using local IndexedDB cache. |
| FR-I-58 | Offline invoices SHALL use LOCAL format invoice numbers; reconciled to SAL format on sync. |
| FR-I-59 | WhatsApp share from an offline invoice SHALL use the LOCAL number; it does not block sharing. |
| FR-I-60 | On reconnect, PENDING invoices SHALL sync within 30 seconds; canonical numbers assigned. |
| FR-I-61 | Persistent offline banner SHALL be shown during offline operation on the billing screen. |

---

## 5. Data Model

### 5.1 Invoice Entity

| Field | Type | Required | Notes |
|---|---|---|---|
| `invoice_id` | UUID | Yes (auto) | Primary key |
| `invoice_number` | String | Yes (auto) | `SAL-YYYYMM-NNNN` online; `LOCAL-<device>-<ts>` offline, reconciled on sync |
| `customer_id` | UUID (FK → Customer) | Yes | Linked customer |
| `created_by` | UUID (FK → User) | Yes | Billing Person user ID |
| `invoice_date` | Date | Yes (auto) | Server date at generation time |
| `created_at` | Timestamp | Yes (auto) | UTC timestamp |
| `payment_method` | ENUM(CASH, UPI, CARD) | Yes | Single method per invoice |
| `subtotal` | DECIMAL(10,2) | Yes | SUM of all line item unit_price_snap values |
| `discount_type` | ENUM(NONE, PERCENTAGE, FLAT) | Yes | Default: NONE |
| `discount_value` | DECIMAL(10,2) | Yes | 0 if no discount |
| `discount_offer_id` | UUID (FK → PredefinedDiscountOffer) | No | Populated only if predefined offer used |
| `taxable_amount` | DECIMAL(10,2) | Yes | subtotal − discount_value |
| `gst_enabled` | Boolean | Yes | Snapshot of GST setting at generation time |
| `cgst_amount` | DECIMAL(10,2) | Yes | 0 if gst_enabled = false |
| `sgst_amount` | DECIMAL(10,2) | Yes | 0 if gst_enabled = false |
| `grand_total` | DECIMAL(10,2) | Yes | taxable_amount + cgst + sgst |
| `status` | ENUM(PAID, REFUNDED, PARTIALLY_REFUNDED) | Yes | Default: PAID |
| `gstin_snap` | String | No | Snapshot of GSTIN at generation; null if GST disabled |
| `salon_name_snap` | String | Yes | Snapshot of salon name |
| `salon_address_snap` | String | Yes | Snapshot of salon address |
| `salon_phone_snap` | String | Yes | Snapshot of salon phone |
| `sync_status` | ENUM(SYNCED, PENDING, CONFLICT) | Yes (auto) | |

### 5.2 InvoiceLineItem Entity

| Field | Type | Required | Notes |
|---|---|---|---|
| `line_item_id` | UUID | Yes (auto) | Primary key |
| `invoice_id` | UUID (FK → Invoice) | Yes | Parent invoice |
| `service_id` | UUID (FK → Service) | No | Nullable if service is later permanently deleted |
| `service_name_snap` | String | Yes | Snapshot of service name at billing time |
| `unit_price_snap` | DECIMAL(10,2) | Yes | Catalog price or override price at billing time |
| `is_price_override` | Boolean | Yes | true if billing person changed from catalog price |
| `professional_id` | UUID (FK → Staff) | Yes | Tagged professional |
| `professional_name_snap` | String | Yes | Snapshot of professional's name at billing time |

### 5.3 Refund Entity

| Field | Type | Required | Notes |
|---|---|---|---|
| `refund_id` | UUID | Yes (auto) | Primary key |
| `refund_number` | String | Yes (auto) | `REF-YYYYMM-NNNN` |
| `invoice_id` | UUID (FK → Invoice) | Yes | The invoice being refunded |
| `refund_type` | ENUM(FULL, PARTIAL) | Yes | |
| `refund_amount` | DECIMAL(10,2) | Yes | Full: equals invoice grand_total; Partial: ≥ ₹1 and < grand_total |
| `reason` | String | Yes | Free text; max 500 characters |
| `processed_by` | UUID (FK → User) | Yes | User who processed the refund |
| `processed_at` | Timestamp | Yes (auto) | UTC timestamp |
| `sync_status` | ENUM(SYNCED, PENDING) | Yes (auto) | |

---

## 6. Business Rules

| Rule ID | Rule | Rationale |
|---|---|---|
| **BR-I-01** | An invoice must have at least one line item before it can be generated. | An empty invoice has no meaning. |
| **BR-I-02** | Every line item must have a professional tagged. Invoice generation is blocked until all line items are assigned. | Commission and performance attribution require professional linkage on every service. |
| **BR-I-03** | Only active catalog services can be added to the cart. | Prevents billing for discontinued services. |
| **BR-I-04** | Price overrides are allowed but flagged (`is_price_override = true`) for audit purposes. | Enables pricing flexibility without obscuring catalog integrity. |
| **BR-I-05** | Only one discount per invoice: predefined offer OR manual entry. Selecting one type clears the other. | Prevents double-discounting. |
| **BR-I-06** | Discount is applied to the pre-tax subtotal. GST is calculated on the taxable amount (post-discount) only. | Standard Indian GST compliance: tax is on the discounted base. |
| **BR-I-07** | A flat manual discount cannot exceed the pre-tax subtotal. A % discount cannot exceed 100%. | Prevents negative or nonsensical invoice totals. |
| **BR-I-08** | Payment method is single per invoice in V1 (no split payments). | Simplifies reconciliation; covers the vast majority of actual transactions. |
| **BR-I-09** | **Snapshot Principle:** At invoice generation, the following are captured as point-in-time snapshots and stored on the invoice: service name, unit price, professional name, salon name, address, phone, GSTIN, GST status. Any subsequent change to catalog, staff, or settings does NOT alter existing invoices. | Financial records must be immutable post-generation. |
| **BR-I-10** | Invoice numbers are system-assigned and sequential. Billing Person cannot set, view the counter, or skip numbers. | Ensures audit traceability and prevents gaps in the invoice register. |
| **BR-I-11** | An invoice is immutable once generated. Line items, prices, discounts, and payment method cannot be edited. Only a refund is permitted. | Preserves financial integrity and audit trail. |
| **BR-I-12** | Refunds are only available on invoices with status = PAID. | REFUNDED and PARTIALLY_REFUNDED invoices cannot be refunded again in V1. |
| **BR-I-13** | Only one refund event per invoice in V1. Once a refund (full or partial) is processed, no further refunds on that invoice are permitted. | Simplifies V1 implementation; covers the vast majority of refund scenarios. |
| **BR-I-14** | A reason is mandatory for all refunds. | Protects against fraudulent or arbitrary refunds; creates an audit record. |
| **BR-I-15** | Refunded invoice amounts are excluded from revenue, ATV, staff performance revenue, staff commission, and Owner Dashboard calculations. The refund correction is visible in the period in which the refund was processed, not retroactively applied to the original invoice date. | Accurate financial reporting requires refund exclusion; retroactive correction would distort historical data. |
| **BR-I-16** | A customer's `last_visit_date` is determined by their most recent PAID invoice. A refund does NOT remove the visit from the customer's history; the customer still visited. | Lapsed calculation should reflect whether the customer visited, not whether they ultimately paid. |
| **BR-I-17** | Invoice numbering sequence is per-salon and does not reset monthly. The YYYYMM in `SAL-YYYYMM-NNNN` is the month of creation for readability only; the NNNN counter is cumulative and does not restart each month. | Prevents number collisions when filtering by month. |

---

## 7. Edge Cases

### EC-I-01 — Customer Not Found, Cart Already Partially Built
**Scenario:** Billing Person starts adding services before selecting a customer, then can't find the customer's phone.
**Handling:** Cart is locked (greyed out) until a customer is selected or created. Services cannot be added without a customer. Cart state is preserved while the billing person creates the customer profile inline.

---

### EC-I-02 — Service Deactivated While in Cart
**Scenario:** The Owner deactivates a service in the catalog while a Billing Person has that service in an open cart.
**Handling:** The item remains in the current cart session (it was added when active). On invoice generation, validation passes — the service is snapshotted by name and price at the moment it was added to the cart. The deactivated service will not appear in future billing sessions.

---

### EC-I-03 — Staff Deactivated While Tagged in Cart
**Scenario:** A staff member is deactivated mid-session while tagged on a line item in an open cart.
**Handling:** On attempting to generate the invoice, validation detects the professional is inactive. Inline error on the affected row: "Staff member [Name] is no longer active. Please re-assign this service to an active professional." Invoice generation is blocked until resolved.

---

### EC-I-04 — Price Override Set to ₹0 (Complimentary Service)
**Scenario:** Billing Person sets a service price to ₹0 for a complimentary touch-up.
**Handling:** System shows soft confirmation: "Setting [Service Name] to ₹0. Is this intentional?" On confirm, line item saved at ₹0. Grand total recalculates. Invoice generates normally. The ₹0 line item appears in staff performance reports with ₹0 revenue and ₹0 commission for that service.

---

### EC-I-05 — Manual Discount Exceeds Subtotal
**Scenario:** Billing Person tries to enter a flat discount of ₹2,000 when the subtotal is ₹1,500.
**Handling:** Inline validation: "Discount cannot exceed the subtotal of ₹1,500." Generate Invoice button remains disabled.

---

### EC-I-06 — Invoice Generated Offline, Then WhatsApp Shared
**Scenario:** App is offline. Invoice is generated with LOCAL number. Customer asks for WhatsApp receipt immediately.
**Handling:** "Share on WhatsApp" button is available. Pre-filled text includes the LOCAL invoice number with a note: "Invoice: LOCAL-ABC123 (number will update when online)." Once synced, the canonical SAL number is assigned but the already-shared WhatsApp message is not retroactively updated (no mechanism to do so).

---

### EC-I-07 — Same Customer Billed Twice Rapidly
**Scenario:** Two billing devices create invoices for the same customer within seconds of each other (both offline).
**Handling:** Both invoices are valid — same customer, two separate transactions. Both sync and receive sequential invoice numbers. No conflict. Customers can receive multiple services in one visit or come back immediately.

---

### EC-I-08 — Partial Refund Amount = Grand Total
**Scenario:** Billing Person selects Partial Refund and enters an amount equal to the grand total.
**Handling:** System detects partial refund amount = grand_total. Prompt shown: "This equals the full invoice amount. Would you like to switch to a Full Refund instead?" Two options: [Switch to Full Refund] or [Keep as Partial]. If partial is kept, invoice status = PARTIALLY_REFUNDED (not REFUNDED) — both are valid outcomes.

---

### EC-I-09 — Refund Attempted on Offline Pending Invoice
**Scenario:** An invoice is generated offline (sync_status = PENDING) and someone tries to refund it before it syncs.
**Handling:** Refund option is disabled on PENDING invoices. Tooltip: "This invoice is pending sync. Refunds are available once the invoice is confirmed online." No refund processing until sync completes and canonical invoice number is assigned.

---

### EC-I-10 — Cart Session Abandoned (Customer Leaves Mid-Billing)
**Scenario:** Billing person builds a full cart, customer changes their mind and leaves. Cart is open with no invoice generated.
**Handling:** A "Clear Cart" button is always visible. Cart state persists in localStorage across refreshes. On next session start, if a cart is found in localStorage, system prompts: "You have an unsaved cart for [Customer Name]. Resume or discard?" No invoice was generated, so no record is created.

---

### EC-I-11 — GST Toggled Off Between Two Bills on the Same Day
**Scenario:** GST is enabled for the first bill, then the owner disables GST in Settings. The next bill has no GST.
**Handling:** Each invoice snapshots GST status at generation time. Invoice 1 shows CGST/SGST. Invoice 2 does not. Both are correct and independent. Past Invoice 1 is not affected by the settings change.

---

### EC-I-12 — Invoice Number Gap After Offline Sync
**Scenario:** Three invoices are generated offline (LOCAL-001, LOCAL-002, LOCAL-003). On sync, they receive SAL-202607-0040, 0041, 0042. Meanwhile, another device had already issued 0038 and 0039 online.
**Handling:** Server assigns next available numbers in the sequence. No gaps beyond normal usage. No two invoices ever share a number. LOCAL numbers are discarded once canonical numbers are assigned.

---

## 8. Out of Scope for V1

| Feature | Reason Deferred |
|---|---|
| Split payments (e.g., ₹500 Cash + ₹300 UPI) | Complicates reconciliation; covers <15% of transactions; planned for V1.5 |
| Invoice PDF download / print | Requires PDF generation library; WhatsApp share covers primary need; V1.5 |
| Tips collection | Cash-based; no POS hardware; out of scope |
| Package / combo billing (multi-session packages) | Requires session tracking across visits; complex data model; V2 |
| Email invoice sharing | No email infrastructure in V1; WhatsApp is primary channel |
| Barcode / POS hardware scanning | Requires hardware integration; counter tablet only |
| Payment gateway (online payments) | Physical payment only at counter; no online payment flow |
| Multiple partial refunds on one invoice | One refund event per invoice simplifies V1; V2 if needed |
| Appointment-linked billing (pre-scheduled invoice) | Walk-in first; appointments are V2 |
| Customer self-service bill view | No customer portal in V1 |
| Automated WhatsApp API sending | Manual share only; WhatsApp Business API is V2 |
| GST per-service tax rate (different HSN codes) | Single GST rate globally in V1; per-service rates in V2 |
| End-of-day cash reconciliation report | V1.5 feature — planned for shortly after launch |
| Invoice export to CSV / Excel | Data structured for it; V2 |

---

*End of Invoicing & Billing PRD — V1*

**Document Author:** AI Product Assistant
**Reviewed By:** —
**Approved By:** —

*Last Updated: 2026-06-17*
