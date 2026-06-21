# ⚙️ Salon Management Web App — Settings Module PRD
**Version:** 1.0 | **Status:** Draft — Ready for Review | **Date:** June 2026

---

## 1. Module Overview

The **Settings Module** serves as the administrative control panel for the Salon Owner. It governs system-wide configurations that directly dictate the behavior of other modules (specifically Invoicing & Billing and Authentication). Since onboarding for V1 is **sales-assisted**, the initial system setup is completed by an external sales/support representative, after which the Owner uses this module to manage ongoing salon details, tax compliance, predefined discount offers, and team accounts.

### Key Capabilities in V1:
1. **Salon Profile Setup:** Plain-text business details (Name, Address, Contact details) displayed on invoices.
2. **Taxation Config (GST):** Easy toggle to enable/disable GST, with a plain-text field for the salon's 15-character GSTIN.
3. **Predefined Discount Offers:** Creation and management of reusable discounts (flat or percentage-based) that the Billing Person can select during checkout.
4. **Staff/User Management:** Owner's tool to add, edit, or deactivate logins for Billing Persons and Professionals.

### Actors:
- **Owner:** Full Read and Write access to all settings, configurations, and user management.
- **Billing Person / Staff:** No access to this module (restricted by Role-Based Access Control).

---

## 2. User Stories

### Salon Profile & GST Configuration
*   **US-SET-01:** *As an Owner, I want to edit my salon's name, address, and phone number, so that the correct contact details appear on the invoice headers.*
*   **US-SET-02:** *As an Owner, I want to toggle GST on or off, so that I don't charge taxes if my salon falls below the registration threshold.*
*   **US-SET-03:** *As an Owner, I want to input my GSTIN in a text field when GST is enabled, so that it is printed on all customer invoices for tax compliance.*

### Predefined Discount Offers
*   **US-SET-04:** *As an Owner, I want to create a percentage-based discount offer (e.g., "Monsoon Special 10%"), so that it can be quickly applied during billing.*
*   **US-SET-05:** *As an Owner, I want to create a flat amount discount offer (e.g., "Flat ₹200 Off"), so that we can run fixed-value promotions.*
*   **US-SET-06:** *As an Owner, I want to view a list of all active and inactive discount offers, so that I can monitor my ongoing promotions.*
*   **US-SET-07:** *As an Owner, I want to deactivate a discount offer, so that billing staff can no longer apply it to new invoices.*

### Team & User Account Management
*   **US-SET-08:** *As an Owner, I want to create login credentials (username, password, role) for new staff members, so they can access the application according to their responsibilities.*
*   **US-SET-09:** *As an Owner, I want to reset a staff member's password, so that they can regain access to the system if they forget it.*
*   **US-SET-10:** *As an Owner, I want to deactivate a staff member's login account (soft delete), so that they can no longer access the system after leaving the salon, while preserving their historical performance data.*

---

## 3. Detailed User Flows

### Flow A: Configuring Salon Details & GST Settings
1.  **Entry Point:** Owner logs in and navigates to the **Settings** page from the sidebar menu.
2.  **View Current Info:** The system loads the current salon profile details (Salon Name, Address, Phone Number) and GST status.
3.  **Edit Fields:** Owner edits the text fields.
4.  **GST Configuration:**
    *   If Owner toggles GST **ON**: The system expands a text input field for **GSTIN** (GST Identification Number). Owner types in the GSTIN.
    *   If Owner toggles GST **OFF**: The GSTIN text input field is hidden and cleared.
5.  **Save:** Owner clicks "Save Changes".
6.  **Validation & Sync:** System validates that the required fields are filled. It updates the local storage (IndexedDB) and triggers background synchronization with the server. A success notification is shown.

### Flow B: Creating a Predefined Discount Offer
1.  **Entry Point:** Owner navigates to **Settings > Discount Offers**.
2.  **View List:** Owner views a data table listing all existing offers, displaying Name, Discount Type, Discount Value, and Status (Active/Inactive).
3.  **Trigger Create:** Owner clicks "+ Add Discount Offer". A modal form opens.
4.  **Fill Details:**
    *   **Offer Name:** (e.g., "Summer Glow Up")
    *   **Type:** Dropdown selection: `Percentage (%)` or `Flat Amount (₹)`
    *   **Value:** Numeric input (e.g., `15` or `150`)
5.  **Save Offer:** Owner clicks "Create Offer".
6.  **System Verification:**
    *   Verifies Name is unique among active offers.
    *   Verifies value is greater than 0.
    *   Verifies percentage value is not greater than 100%.
7.  **Success:** Modal closes. The new offer appears in the list and is immediately available in the billing catalog picker.

---

## 4. Functional Requirements

### FR-SET-1.1: Salon Profile Configuration
- **FR-SET-1.1.1:** The system shall allow the Owner to update the following text-based fields: Salon Name, Salon Address, and Primary Contact Phone.
- **FR-SET-1.1.2:** All Salon Profile fields shall be validated as non-empty before saving.
- **FR-SET-1.1.3:** Changes to the Salon Profile shall immediately reflect on all *newly generated* invoices (past invoices remain unchanged).

### FR-SET-1.2: GST Setup
- **FR-SET-1.2.1:** The system shall provide a binary toggle (ON/OFF) for GST enabled status.
- **FR-SET-1.2.2:** When GST is toggled ON, a text input field for "GSTIN" shall be displayed and marked as mandatory.
- **FR-SET-1.2.3:** The GSTIN field shall be a simple text input accepting alphanumeric characters (validated length: 15 characters, standard India GSTIN format).
- **FR-SET-1.2.4:** When GST is toggled OFF, the GST calculations in the Billing Module shall be disabled, and the GSTIN field will be hidden and excluded from invoice headers.

### FR-SET-1.3: Predefined Discount Offers
- **FR-SET-1.3.1:** The system shall allow the Owner to create, read, update, and deactivate discount offers.
- **FR-SET-1.3.2:** Each offer must require an Offer Name, Discount Type (`PERCENTAGE` or `FLAT`), and a numeric Discount Value.
- **FR-SET-1.3.3:** The system shall prevent saving percentage-based discounts with values greater than 100.
- **FR-SET-1.3.4:** Deactivating an offer shall make it unavailable for selection on the checkout page, but it shall NOT affect any historical invoices that previously applied this offer.
- **FR-SET-1.3.5:** Offers cannot be hard-deleted; they can only be toggled to `INACTIVE` state.

### FR-SET-1.4: Staff Account Management (CRUD)
- **FR-SET-1.4.1:** The system shall allow the Owner to create system users by providing Name, Username, Password, and designating a Role (`OWNER`, `BILLING_PERSON`, `STAFF`).
- **FR-SET-1.4.2:** User deactivation (soft delete) must be supported. Deactivating a user immediately invalidates their active sessions and blocks new login attempts.
- **FR-SET-1.4.3:** The system shall allow the Owner to reset any user's password.

---

## 5. Data Model

### SalonProfile Entity
```json
{
  "salon_id": "String (UUID, PK)",
  "name": "String (Required)",
  "address": "String (Required)",
  "phone": "String (Required)",
  "gst_enabled": "Boolean (Default: false)",
  "gstin": "String (Optional, required if gst_enabled is true)",
  "updated_at": "Timestamp"
}
```

### PredefinedDiscountOffer Entity
```json
{
  "offer_id": "String (UUID, PK)",
  "name": "String (Required, unique)",
  "discount_type": "Enum (PERCENTAGE, FLAT) (Required)",
  "discount_value": "Decimal (Required)",
  "status": "Enum (ACTIVE, INACTIVE) (Default: ACTIVE)",
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

## 6. Business Rules

1.  **GST Toggle Behavior:** By default, GST is set to `OFF`. If toggled ON, the CGST + SGST tax calculation (split equally) is applied to all service item subtotals during billing.
2.  **No Retroactive Alterations:** Changing salon details, GSTIN, or deactivating a discount offer applies strictly to *future* transactions. Past invoices must serve as static audit records.
3.  **Active Discount Uniqueness:** No two active discount offers can share the exact same Name.
4.  **Sales-Assisted Setup Flag:** The database contains an initial bootstrap script that creates the primary Owner account during provisioning. Self-signup is disabled at the application tier.

---

## 7. Edge Cases & Handling

| # | Edge Case | Expected System Behavior |
|---|---|---|
| 1 | Owner deactivates a discount offer *while* a Billing Person is in the middle of check-out applying it. | The checkout process will check validity upon clicking "Pay". If the discount was deactivated in the background, a warning dialog appears: *"This discount offer is no longer active. Please choose another offer."* |
| 2 | GST is toggled OFF after having been active for months. | All past invoices retain their GST splits, tax details, and GSTIN snap. All invoices generated from that second onward will exclude GST calculations. |
| 3 | Owner changes the commission % of a staff member mid-day. | All services on the change date (including those logged earlier that same day) retain the prior commission rate. The new rate takes effect from the **following calendar day** only. This avoids intra-day split calculations and aligns with the `CommissionRateHistory` effective_from logic. |
| 4 | Owner attempts to deactivate their own account. | The system blocks the operation and displays an error: *"An Owner cannot deactivate their own account. Please contact support."* |
| 5 | Network offline when Owner edits settings. | Changes are saved locally to IndexedDB with a dirty flag. The settings page displays: *"Offline: Changes will sync once connection is restored."* Invoices generated offline on this device will immediately start using the new configurations. |

---

## 8. Out of Scope for V1

-   Logo image file upload & cropping (Plain text headers only in V1).
-   Multiple tax brackets/slabs per service (Fixed flat GST rate globally across services when GST is enabled).
-   Custom permission override (Role boundaries are static: Owner, Billing, Staff).
-   Automated scheduled discount promotions (e.g., active only between 2 PM and 5 PM).
