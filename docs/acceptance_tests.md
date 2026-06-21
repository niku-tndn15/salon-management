# Acceptance Tests — Salon Application V1

Run against the frontend with `seed/seed-data.json` loaded into IndexedDB.
Seed credentials: Owner = `owner / demo123`, Billing = `billing / demo123`, Staff = `anita / demo123`.

---

## AT-01 · Billing Happy Path

**Role:** Billing Person  
**Steps:**
1. Search customer by phone "9800000001" — Ria Sharma appears
2. Add "Haircut" (₹250) to cart, tag Anita as professional
3. Select payment method: Cash
4. Click Pay → invoice confirmation shown

**Expected:** Invoice saved in IndexedDB with `status: PAID`, `invoice_number` present, `line_items[0].professional_name_snap = "Anita"`, `line_items[0].commission_pct_snap = 10`

---

## AT-02 · GST Calculation

**Role:** Owner  
**Pre-condition:** Enable GST in Settings (provide GSTIN "29ABCDE1234F1Z5")  
**Steps:**
1. Create invoice: Facial ₹600, no discount
2. Open invoice preview

**Expected:**
- Taxable amount = ₹600
- CGST (9%) = ₹54, SGST (9%) = ₹54
- Grand Total = ₹708
- GSTIN "29ABCDE1234F1Z5" visible on invoice preview

---

## AT-03 · Predefined Discount Offer Application

**Role:** Billing Person  
**Steps:**
1. New invoice for cust-2, add Facial ₹600
2. Select offer "Monsoon Special 10%" from discount picker
3. Pay

**Expected:** Discount amount = ₹60, Grand Total = ₹540, `discount_offer_snap = "Monsoon Special 10%"` stored in invoice

---

## AT-04 · Manual Flat Discount

**Role:** Billing Person  
**Steps:**
1. New invoice, add Hair Colour ₹1200
2. Select manual discount type "Flat (₹)", enter 200
3. Pay

**Expected:** Discount amount = ₹200, Grand Total = ₹1000, `discount_offer_snap = null`

---

## AT-05 · Invoice Share via WhatsApp

**Role:** Billing Person  
**Steps:**
1. Open any PAID invoice detail
2. Click "Share via WhatsApp"

**Expected:** Browser opens `https://wa.me/` link with pre-filled customer phone and invoice summary text

---

## AT-06 · Partial Refund Flow

**Role:** Billing Person  
**Steps:**
1. Open invoice `inv-2` (Amit Kumar, Facial ₹600)
2. Click Initiate Refund → choose Partial → enter ₹100 → reason "Service not as expected" → Confirm

**Expected:** `invoice.status` updates to `PARTIALLY_REFUNDED`; refund record created with `amount: 100`

---

## AT-07 · Full Refund Flow

**Role:** Billing Person  
**Steps:**
1. Open invoice `inv-1` (Ria Sharma, Haircut ₹250)
2. Initiate full refund, enter reason → Confirm

**Expected:** `invoice.status` updates to `REFUNDED`; refund amount = ₹250

---

## AT-08 · Commission Calculation with Rate History

**Role:** Owner  
**Steps:**
1. Navigate to Staff Performance → select Anita → set date range 2026-01-01 to 2026-06-17
2. View commission report (seed includes inv-1 in May at rate 10%)

**Expected:**
- Invoice in April period (rate 8%) shows commission = service_amount × 8%
- Invoice in May period (rate 10%) shows commission = service_amount × 10%
- Rate change from 8% to 10% effective 2026-05-01 is respected

---

## AT-09 · Lapsed Customer Detection

**Role:** Owner  
**Steps:**
1. Navigate to Customer Management → Lapsed Customers tab

**Expected:** Sunita Mehta (cust-3, last visit 2026-04-25) appears in list with `days_inactive ≥ 45`; Ria Sharma and Amit Kumar do NOT appear (last visits < 45 days ago)

---

## AT-10 · Role-Based Access Control

**Role:** Billing Person (login as `billing`)  
**Steps:**
1. Attempt to navigate to `/settings`
2. Attempt to navigate to `/staff`
3. Attempt to navigate to `/dashboard`

**Expected:** All three routes blocked; "Access Denied" message shown; sidebar does not display these links for Billing Person role

---

## AT-11 · Staff Role Access

**Role:** Staff (login as `anita`)  
**Steps:**
1. Check which nav links are visible
2. Navigate to My Performance

**Expected:** Only "My Performance" link visible; /dashboard, /settings, /customers, /invoices all blocked; My Performance shows only Anita's own service history

---

## AT-12 · Offline Invoice Creation

> **Note:** Steps 1–4 are testable against the frontend-only build.
> Steps 5–6 (sync and server-assigned invoice number) require backend integration (M12).

**Steps:**
1. Disconnect network (DevTools → Offline)
2. Observe offline banner appears
3. Create a new invoice (customer + services + payment)
4. Verify invoice saved locally with `sync_status: PENDING` and `invoice_number` in `LOCAL-<device>-<ts>` format

**Steps 5–6 (requires backend — M12):**
5. Reconnect network
6. Observe sync completes within 30 seconds

**Expected (steps 1–4):**
- Offline banner visible during disconnected state
- Invoice has `sync_status: PENDING` and a `LOCAL-<device>-<ts>` invoice number

**Expected (steps 5–6, post-backend):**
- `sync_status` updates to `SYNCED`
- `invoice_number` is replaced with server-assigned `SAL-YYYYMM-NNNN`

---

## AT-13 · Session Timeout Warning

**Steps:**
1. Login, then leave app idle for 28 minutes
2. Observe warning modal appears ("Session expiring in 2 minutes")
3. Click "Stay logged in"
4. Leave idle for 30 minutes without responding to warning

**Expected:** Warning modal at 28 min; clicking "Stay logged in" resets timer; ignoring warning auto-logs out at 30 min and redirects to Login

---

## AT-14 · Account Lockout

**Steps:**
1. Logout, attempt login with wrong password 5 times

**Expected:** After 5th failure, login blocked with message "Account locked. Try again after 15 minutes."; 6th attempt also blocked within lockout window

---

## AT-15 · Password Change (All Roles)

**Role:** Any (test as Billing Person)  
**Steps:**
1. Go to profile / change password
2. Enter correct current password + new password meeting policy (8 chars, 1 upper, 1 lower, 1 digit)
3. Save

**Expected:** Password updated; re-login with new password succeeds; old password rejected

---

## AT-16 · Seed Import Verification

**Steps:**
1. Clear IndexedDB, load `seed/seed-data.json`
2. Open Dashboard

**Expected:**
- 3 customers, 4 services, 2 staff, 3 invoices, 1 refund, 2 discount offers in IndexedDB
- Dashboard KPIs reflect seeded invoice totals
- Lapsed customer count ≥ 1 (Sunita Mehta)
- Upcoming birthdays widget shows any customer with birthday within next 7 days of today
