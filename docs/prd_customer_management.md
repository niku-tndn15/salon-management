# Customer Management — Product Requirements Document

**Module:** Customer Management
**Application:** Salon Management Web App (Single Salon, Billing Counter)
**Version:** V1
**Last Updated:** 2026-06-14
**Status:** Draft

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

The Customer Management module is the foundational data layer of the Salon Management web application. Its primary purpose is to create, identify, and maintain accurate customer profiles so that every billing transaction, service history record, and communication is linked to a single, reliable customer identity. This module powers downstream workflows such as invoicing, loyalty tracking, and re-engagement campaigns.

### 1.2 Scope

This module covers:

- Customer profile creation and editing
- Phone-number-based customer identification at the billing counter
- Visit history and spend tracking per customer
- Lapsed customer detection (>= 45 days of inactivity)
- Birthday alerts for the current day and upcoming 7-day window
- Referral source tracking per customer
- Duplicate profile detection and merge capability
- Offline-first behavior with sync-on-reconnect

This module does NOT cover payment processing, appointment scheduling, service catalogue management, staff payroll, or inventory.

### 1.3 Actors

| Actor | Role Description | Access Level |
|---|---|---|
| **Owner** | Salon owner or manager; has full read/write/delete access across all customer data and reports | Full access |
| **Billing Person** | Staff member operating the billing counter; creates/edits profiles, runs lookups, and initiates transactions | Billing workflows + read access to customer data |
| **Staff / Professional** | Stylist or technician; can only view their own performance metrics linked to customers they served | Read-only, restricted to own records |

---

## 2. User Stories

### 2.1 Core Customer Operations

**US-01 - New Customer Creation**
> As a **Billing Person**, I want to create a new customer profile by entering their name, phone number, gender, date of birth, and referral source so that all their future visits and transactions are tracked under one identity.

**US-02 - Phone-Number Lookup Before Creation**
> As a **Billing Person**, I want the system to automatically search for an existing customer when I type a phone number so that I never accidentally create a duplicate profile for a returning customer.

**US-03 - Returning Customer Quick Lookup**
> As a **Billing Person**, I want to retrieve a customer full profile instantly by searching their phone number so that I can start billing without asking them to repeat their details every visit.

**US-04 - Edit Customer Profile**
> As a **Billing Person**, I want to update an existing customer name, date of birth, gender, or referral source so that the profile stays accurate if the customer provides corrected information.

**US-05 - View Customer Visit History**
> As a **Billing Person** or **Owner**, I want to view the complete chronological list of a customer past visits including date, services availed, staff who served them, and amount paid so that I can understand their preferences and service patterns.

### 2.2 Retention and Engagement

**US-06 - View Lapsed Customer Report**
> As an **Owner**, I want to see a list of all customers who have not visited in 45 or more days so that I can identify at-risk customers and plan re-engagement outreach.

**US-07 - Birthday Alerts**
> As a **Billing Person** or **Owner**, I want to see a list of customers whose birthdays fall today or within the next 7 days so that the salon can proactively reach out with a special offer or greeting.

**US-08 - Referral Source Tracking**
> As an **Owner**, I want to see which referral source is driving the most new customers so that I can make data-driven decisions about marketing spend.

### 2.3 Data Quality

**US-09 - Duplicate Profile Detection**
> As a **Billing Person**, I want the system to warn me if I try to create a new profile using a phone number that already exists so that I can avoid fragmented customer histories.

**US-10 - Merge Duplicate Profiles**
> As an **Owner**, I want to merge two customer profiles that belong to the same person combining their visit histories so that the data is consolidated into one accurate record.

**US-11 - Offline Customer Creation**
> As a **Billing Person**, I want to create and look up customer profiles even when the internet connection is unavailable so that billing counter operations are never disrupted.

**US-12 - Customer Notes**
> As a **Billing Person** or **Owner**, I want to add free-text notes to a customer profile so that the service team is aware of important preferences before each visit.

---

## 3. Detailed User Flows

### 3.1 Flow A - New Customer Creation

**Trigger:** A customer visits the salon for the first time.

    Step 1: Billing Person opens the "New Bill / Customer Lookup" screen.
    Step 2: Billing Person types the customer phone number into the primary search field.
    Step 3: System performs a real-time search (local cache first if offline, then server).
            - If a matching profile is found: System displays existing profile with prompt to use it.
            - If "No, create new": System blocks and shows error to prevent duplicates.
    Step 4: No matching profile found. System enables the "Create New Customer" form.
    Step 5: Billing Person fills in mandatory fields:
            - Full Name, Phone Number, Gender, Date of Birth, Referral Source
    Step 6: Billing Person optionally adds Notes.
    Step 7: Billing Person clicks [Save Customer]. System validates all fields.
    Step 8: Success confirmation shown. Profile is active and ready for billing.
    Step 9: Background sync to server if online; marked as pending sync if offline.

### 3.2 Flow B - Returning Customer Lookup

**Trigger:** A repeat customer arrives at the billing counter.

    Step 1: Billing Person opens the "Customer Lookup" screen.
    Step 2: Billing Person types the customer phone number (minimum 4 digits).
    Step 3: System shows real-time search results as the user types.
    Step 4: Billing Person selects the correct customer from results.
    Step 5: System opens Customer Profile view with all details, badges, and metrics.
    Step 6: Billing Person confirms identity and proceeds to billing.

### 3.3 Flow C - Viewing Customer History

**Trigger:** Owner or Billing Person wants to review a customer service history.

    Step 1: User navigates to the Customer Profile.
    Step 2: User clicks the [Visit History] tab.
    Step 3: System displays chronological list of all past visits (newest first).
            Each entry shows: Date, Services, Staff, Amount, Invoice link.
    Step 4: User can filter by date range, service category, or staff member.
    Step 5: User can click any visit row to open the full invoice detail.
    Step 6: Summary metrics show total visits, lifetime spend, average spend, favourite service and staff.

### 3.4 Flow D - Lapsed Customer Report

**Trigger:** Owner wants to review customers who have not visited in 45+ days.

    Step 1: Owner navigates to Reports > Customer Retention > Lapsed Customers.
    Step 2: System displays filtered list sorted by days inactive (descending).
    Step 3: Each row shows: Name, Phone, Last Visit Date, Days Inactive, Total Visits, Lifetime Spend.
    Step 4: Owner can filter by threshold (45/60/90/180 days), Gender, Referral Source.
    Step 5: Owner can export the list as CSV.
    Step 6: Owner can click a customer row to open their full profile.

---

## 4. Functional Requirements

### 4.1 Customer Search

| ID | Requirement |
|---|---|
| FR-001 | The system SHALL provide a phone number search field as the primary customer identification mechanism on the billing screen. |
| FR-002 | The system SHALL perform a real-time search and display matching results as the user types, beginning from the 4th digit. |
| FR-003 | The system SHALL search against the locally cached customer database when offline, returning results within 500ms. |
| FR-004 | Search results SHALL display: customer name, phone number, and last visit date. |
| FR-005 | If no customer matches, the system SHALL display a "No customer found" message and offer a "Create New Customer" action. |

### 4.2 Customer Creation

| ID | Requirement |
|---|---|
| FR-006 | The system SHALL require all five mandatory fields (Name, Phone, Gender, Date of Birth, Referral Source) before allowing a profile to be saved. |
| FR-007 | The system SHALL validate that the phone number is exactly 10 digits and contains only numeric characters. |
| FR-008 | The system SHALL validate that Date of Birth is a real calendar date and is not a future date. |
| FR-009 | The system SHALL prevent creation of a new profile if the entered phone number already exists and display an informative error message. |
| FR-010 | Upon successful creation, the system SHALL assign a unique customer_id (UUID) to the profile. |
| FR-011 | The system SHALL record the created_by (user ID) and created_at (timestamp) at the time of profile creation. |
| FR-012 | The system SHALL pre-fill the phone number field from the search input when transitioning to the Create Customer form. |

### 4.3 Customer Edit

| ID | Requirement |
|---|---|
| FR-013 | Billing Persons and Owners SHALL be able to edit: Name, Gender, Date of Birth, Referral Source, Notes. |
| FR-014 | The phone number field SHALL NOT be editable after profile creation; it is the permanent primary identifier. |
| FR-015 | All edits SHALL be recorded with an updated_by user ID and updated_at timestamp. |
| FR-016 | The system SHALL NOT allow a profile to be saved with any mandatory field left blank during an edit operation. |

### 4.4 Customer Profile View

| ID | Requirement |
|---|---|
| FR-017 | The customer profile SHALL display: name, phone, gender, DOB, age (auto-calculated), referral source, notes, total visits, lifetime spend, last visit date, and days since last visit. |
| FR-018 | The system SHALL display a "LAPSED" badge on a customer profile if they have not visited in >= 45 days. |
| FR-019 | The system SHALL display a "BIRTHDAY" badge if the customer birthday falls on today or within the next 7 days. |

### 4.5 Visit History

| ID | Requirement |
|---|---|
| FR-020 | The customer profile SHALL include a Visit History tab showing all past transactions linked to that customer. |
| FR-021 | Visit history records SHALL display: date, services, staff, total amount, and a link to the invoice. |
| FR-022 | The visit history SHALL be sortable by date and filterable by date range and service category. |

### 4.6 Lapsed Customer Detection

| ID | Requirement |
|---|---|
| FR-023 | The system SHALL automatically flag a customer as lapsed when their last visit date is >= 45 calendar days before the current date. |
| FR-024 | The lapsed flag SHALL be re-evaluated in real time each time a customer profile is loaded. |
| FR-025 | The Owner role SHALL have access to a dedicated Lapsed Customers report. |
| FR-026 | The Lapsed Customers report SHALL support filtering by inactivity threshold and CSV export. |
| FR-027 | Newly created customers SHALL NOT appear in the lapsed report until after their first completed visit. |

### 4.7 Birthday Flagging

| ID | Requirement |
|---|---|
| FR-028 | The system SHALL display an "Upcoming Birthdays" widget on Owner and Billing Person dashboards for the next 7 days inclusive of today. |
| FR-029 | Birthday matching SHALL be based on day and month of date_of_birth only, ignoring the year. |
| FR-030 | The birthday list SHALL be sorted by closest upcoming birthday first. |

### 4.8 Referral Source Tracking

| ID | Requirement |
|---|---|
| FR-031 | The referral source field SHALL be a fixed dropdown: Walk-in, Friend Referral, Instagram, Google, Facebook, Other. |
| FR-032 | The system SHALL provide an aggregated Referral Source report for Owners showing count and percentage per source. |

### 4.9 Duplicate Detection and Merge

| ID | Requirement |
|---|---|
| FR-033 | On profile creation, the system SHALL check for an existing record with an identical phone number and prevent creation if found. |
| FR-034 | The Owner role SHALL have access to a Merge Profiles tool allowing two profiles to be merged into one. |
| FR-035 | During a merge, the system SHALL retain the older profile customer_id as the canonical record. |
| FR-036 | During a merge, all visit history, invoices, and transactions from the secondary profile SHALL be re-linked to the primary profile. |
| FR-037 | The secondary merged profile SHALL be marked status MERGED and SHALL NOT appear in normal search results. |

### 4.10 Offline Behavior

| ID | Requirement |
|---|---|
| FR-038 | The system SHALL cache all customer profiles in IndexedDB so that search, view, and create operations work without internet. |
| FR-039 | Records created or edited while offline SHALL be tagged with sync_status PENDING. |
| FR-040 | When connectivity is restored, the system SHALL automatically sync all PENDING records within 30 seconds. |
| FR-041 | The system SHALL display an offline indicator in the UI when operating without internet access. |
| FR-042 | The system SHALL display a sync confirmation when all pending records have been successfully synced. |
| FR-043 | Merge operations SHALL be queued offline and executed server-side upon reconnection with conflict resolution policy applied. |

---

## 5. Data Model

### 5.1 Customer Entity

| Field Name | Type | Required | Validation Rules |
|---|---|---|---|
| customer_id | UUID | Yes - auto-generated | Globally unique; assigned by system on creation |
| name | String | Yes | 2-100 characters; alphanumeric + spaces + hyphens |
| phone | String | Yes - Primary Key | Exactly 10 numeric digits; unique across all non-MERGED records |
| gender | Enum | Yes | One of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| date_of_birth | Date (ISO 8601) | Yes | Valid calendar date; must be <= today; age range 1-110 years |
| referral_source | Enum | Yes | One of: WALK_IN, FRIEND_REFERRAL, INSTAGRAM, GOOGLE, FACEBOOK, OTHER |
| notes | String | No | Max 1,000 characters; free text |
| status | Enum | Yes - auto-managed | One of: ACTIVE, MERGED, DELETED; default ACTIVE |
| created_at | DateTime (ISO 8601) | Yes - auto-generated | UTC timestamp; set on creation; immutable |
| created_by | UUID (FK to User) | Yes - auto-generated | User ID of the billing person who created the record |
| updated_at | DateTime (ISO 8601) | No | UTC timestamp; updated on every edit |
| updated_by | UUID (FK to User) | No | User ID of the last person to edit the profile |
| sync_status | Enum | Yes - auto-managed | One of: SYNCED, PENDING, CONFLICT |
| merged_into_id | UUID (FK to Customer) | No | Populated only when status = MERGED |

### 5.2 Derived / Computed Fields (calculated at runtime, not stored)

| Computed Field | Calculation |
|---|---|
| age | Current year minus year of date_of_birth, adjusted for whether birthday has passed |
| total_visits | COUNT of invoices linked to this customer_id |
| lifetime_spend | SUM of invoice totals linked to this customer_id |
| average_spend | lifetime_spend divided by total_visits |
| last_visit_date | MAX(invoice_date) from invoices linked to this customer_id |
| days_since_last_visit | Today minus last_visit_date in calendar days |
| is_lapsed | days_since_last_visit >= 45 AND total_visits > 0 |
| birthday_upcoming | date_of_birth day/month falls within today + 7 days (ignoring year) |

---

## 6. Business Rules

| Rule ID | Rule | Rationale |
|---|---|---|
| BR-01 | Phone number is the primary identifier for all customer lookups. Every search MUST begin with phone number. | Ensures single source of truth; avoids name-based ambiguity. |
| BR-02 | Phone number MUST be unique across all ACTIVE and PENDING customer records. | Prevents duplicate profiles for the same individual. |
| BR-03 | A customer is classified as lapsed when days_since_last_visit >= 45 AND they have at least 1 completed visit on record. | New customers with zero visits are not lapsed. |
| BR-04 | The lapsed threshold of 45 days is configurable by the Owner at the account level (default: 45). | Allows the salon to tune retention sensitivity over time. |
| BR-05 | Date of Birth is mandatory and must be a valid non-future date. Age is calculated automatically and never entered manually. | Prevents data entry errors and powers birthday alerts accurately. |
| BR-06 | Referral Source must be selected from a fixed list at the time of profile creation; it CANNOT be left blank. | Ensures consistent, reportable marketing attribution data. |
| BR-07 | Phone numbers of MERGED profiles are released for re-use only after Owner approval. | Prevents confusion if a number is reassigned to a different person. |
| BR-08 | The older profile (lower created_at) is always retained in a merge. The newer profile is marked MERGED. | Preserves the longer history as the canonical identity. |
| BR-09 | A Staff/Professional role CANNOT search for, view, create, or edit any customer profile directly. | Least-privilege access; protects customer PII. |
| BR-10 | Offline-created records sync using last-write-wins for non-conflicting fields. Phone conflicts are flagged as CONFLICT for Owner resolution. | Maintains data integrity across multiple devices. |
| BR-11 | Soft delete only: customer profiles are NEVER permanently deleted in V1. status = DELETED removes them from search but retains transaction history. | Ensures financial audit trail is never broken. |

---

## 7. Edge Cases

### EC-01 - Phone Number Entered Without Country Code
**Scenario:** User enters 11 or 12 digits starting with 0 or 91.
**Handling:** System strips leading 0 or 91 and validates the remaining 10 digits. If match found, existing profile is returned. If not, cleaned number is pre-filled in create form with notice: "Phone number normalised to 10 digits."

### EC-02 - Customer Visits Again on the Day of Creation
**Scenario:** A new customer is created during the morning visit and visits again in the evening.
**Handling:** The system uses live total_visits count from saved invoices. After the first invoice is saved, count becomes 1. The second lookup correctly shows 1 prior visit.

### EC-03 - Two Billing Devices Create the Same Customer Simultaneously While Offline
**Scenario:** Two staff members at different devices both create a profile for the same phone number while offline.
**Handling:** Sync engine detects phone number collision. First record to reach server is accepted as ACTIVE. Second is rejected and flagged as CONFLICT. Owner receives an alert in the Conflict Resolution queue.

### EC-04 - Customer Provides Wrong Date of Birth and Asks to Correct It Later
**Scenario:** A customer gave an incorrect DOB at first visit and wants it corrected.
**Handling:** A Billing Person or Owner can edit date_of_birth at any time. Edit is logged. Age and birthday alerts recalculate immediately.

### EC-05 - Lapsed Customer Returns After Long Absence
**Scenario:** A lapsed customer walks in and a new invoice is generated.
**Handling:** Once the new invoice is saved, last_visit_date updates to today. On next profile load, is_lapsed recalculates to false. LAPSED badge is removed and customer disappears from Lapsed Report on next refresh.

### EC-06 - Birthday Spans the Year Boundary (Dec 31 / Jan 1)
**Scenario:** A customer birthday is January 1st. The 7-day lookahead from December 28th crosses the year boundary.
**Handling:** Birthday match logic compares only day and month values, iterating day-by-day for the 7-day window. It correctly wraps around from December 31 to January 1.

### EC-07 - Merge Attempt on a Customer Who Has No Visits
**Scenario:** Owner tries to merge two profiles; one has no visit history.
**Handling:** Merge is allowed. Profile with visits is always retained (even if newer). If neither has visits, the older record (lower created_at) is retained.

### EC-08 - Referral Source Not Known at Time of Walk-In
**Scenario:** A customer cannot or does not want to share how they heard about the salon.
**Handling:** Billing Person selects "Walk-in" (most conservative) or "Other." There is no option to leave this field blank, by design to maintain clean attribution data.

### EC-09 - Searching With Only a Customer Name (No Phone)
**Scenario:** A returning customer has forgotten their phone number.
**Handling:** The system provides a secondary search by name (contains match, case-insensitive). Results show name, partial phone (last 4 digits visible), and last visit date. Phone-first is mandated, but name fallback is supported.

### EC-10 - Attempt to Delete a Customer Who Has Linked Invoices
**Scenario:** An Owner tries to delete a customer profile that has invoices associated with it.
**Handling:** System sets status = DELETED (soft delete) but retains all invoice records intact. Customer no longer appears in search results. Invoices remain fully auditable. Hard delete is blocked and not available in V1.

---

## 8. Out of Scope for V1

| # | Feature | Reason Deferred |
|---|---|---|
| 1 | Loyalty Points / Rewards Program | Requires a separate reward engine and redemption workflow; planned for V2. |
| 2 | SMS / WhatsApp Re-engagement Campaigns | Requires integration with a messaging provider; out of scope for V1 launch. |
| 3 | Customer-facing Self-Service Portal / App | Customers cannot log in, view history, or book appointments in V1. |
| 4 | Multi-branch Customer Sharing | Application is scoped to a single salon; no cross-branch data model included. |
| 5 | Automated Lapsed Customer Notifications | Report exists but automated outreach is not triggered; manual follow-up only. |
| 6 | Advanced Customer Segmentation | No RFM scoring or dynamic segments in V1. |
| 7 | Photo / ID upload on Customer Profile | Profile photos or ID document uploads are not supported in V1. |
| 8 | Customer Feedback / Rating Capture | Post-visit satisfaction surveys are not included in V1. |
| 9 | GDPR / Data Deletion (Hard Delete) Requests | Legal compliance workflows for data erasure are deferred pending legal review. |
| 10 | Customer Tags / Custom Labels | Free-form tagging (e.g., "VIP", "Corporate") is a V2 enhancement. |
| 11 | Import from External Sources | Bulk CSV import of existing customer records is not included in V1 onboarding. |

---

*End of Customer Management PRD Section - V1*

**Document Author:** AI Product Assistant
**Reviewed By:** -
**Approved By:** -
