# 📋 Salon Management Web App — Master PRD
**Version:** 1.0 | **Status:** Draft — Ready for Review | **Date:** June 2026

---

## Product Summary

A browser-based salon management web application for **single salon owners**, operated at the billing counter. It digitises the three most painful manual workflows: customer visit tracking, staff performance & commission management, and GST-compliant invoicing — all in one unified product.

**Primary User:** Billing Person (at the counter)  
**Platform:** Web App (laptop/tablet, counter-based)  
**Target Market:** Single-location salons in India (Tier 1 & Tier 2 cities)  
**Offline Capability:** Full offline-first with background sync  

---

## Module Index

| # | Module | Primary User | Document |
|---|---|---|---|
| 1 | **Customer Management** | Billing Person, Owner | [prd_customer_management.md](./prd_customer_management.md) |
| 2 | **Staff Performance & Commission** | Owner, Staff | [prd_staff_performance.md](./prd_staff_performance.md) |
| 3 | **Invoicing & Billing** | Billing Person, Owner | [prd_invoicing.md](./prd_invoicing.md) |
| 4 | **Owner Dashboard** | Owner | [prd_dashboard_auth_catalog.md](./prd_dashboard_auth_catalog.md#section-a-owner-dashboard) |
| 5 | **Authentication & Role Management** | All Users | [prd_dashboard_auth_catalog.md](./prd_dashboard_auth_catalog.md#section-b-authentication--role-management) |
| 6 | **Service Catalog Management** | Owner | [prd_dashboard_auth_catalog.md](./prd_dashboard_auth_catalog.md#section-c-service-catalog-management) |
| 7 | **Settings & Configurations** | Owner | [prd_settings.md](./prd_settings.md) |

---

## Key Decisions Log

All product decisions made during the ideation and discovery phase, locked before PRD creation.

| Decision | Choice | Rationale |
|---|---|---|
| **Who bills** | Billing person at the counter | Primary operator; UX optimised for speed at checkout |
| **Branch scope** | Single salon only | Avoids multi-location complexity in V1 |
| **Platform** | Web app (browser-based) | No install friction; runs on counter laptop/tablet |
| **Customer identification** | Phone number first (primary key) | Prevents duplicates; standard in India |
| **Customer fields** | Name, Phone, Gender, DOB, Referral Source | Minimum viable for tracking + birthday alerts |
| **Multi-professional per bill** | ✅ Allowed | Reflects real salon workflow (Ravi does haircut, Sunita does facial) |
| **Payment methods** | Cash, UPI, Card (no split in V1) | 70%+ India transactions are UPI |
| **GST** | Optional toggle by owner | Not all small salons are GST registered |
| **Discounts** | Manual (% or ₹) + predefined offers | Covers both ad-hoc and standard promotions |
| **Refunds** | Full + partial against past invoice | Required for customer disputes |
| **Service catalog** | Owner manages; billing person picks only | Prevents pricing inconsistency |
| **Invoice header** | Salon name, address, phone, logo | Minimum professional invoice requirement |
| **Invoice sharing** | WhatsApp button (pre-filled number) | WhatsApp is primary communication in India |
| **Tips** | ❌ Not in scope | Out of scope V1 |
| **Login** | Each user has own credentials | Security on shared device |
| **Roles** | Owner / Billing Person / Staff | Least-privilege access |
| **Dashboard** | All KPIs on one screen | Owner needs 30-second pulse check |
| **Lapsed threshold** | 45 days of inactivity | Balanced between too-sensitive and too-lenient |
| **Performance period** | Custom date range picker | Maximum flexibility for owner |
| **Commission** | Fixed % per professional, auto-calculated | Solves the #1 staff dispute pain point |
| **Offline** | Full offline-first, sync on reconnect | Critical for India Tier 2/3 connectivity |
| **Pricing model** | Flat monthly fee | Simple GTM pricing, avoids friction of usage tracking |
| **Target geography** | India Tier 1 Cities | Mumbai, Bangalore, Delhi first to test product-market fit |
| **Onboarding type** | Sales-assisted | Bypasses self-serve setup complexity; local sales team configures |
| **Logo for invoice** | Plain-text title for V1 | Plain-text header name, avoids image storage/handling |
| **GSTIN validation** | Plain text field (15 char length) | Simplifies onboarding validation while ensuring compliance |
| **Settings Module** | Scoped in V1 | Added to manage business details, GST toggle, discounts, and users |

---

## Role Summary

| Role | Landing Screen | Access Summary |
|---|---|---|
| **Owner** | `/dashboard` | Full access to all modules |
| **Billing Person** | `/billing` | Customer lookup, invoice creation, refunds only |
| **Staff / Professional** | `/my-performance` | Own service history and commission only |

### Access Control Matrix

| Feature | Owner | Billing Person | Staff |
|---|---|---|---|
| Owner Dashboard | ✅ | ❌ | ❌ |
| Billing / Invoicing | ✅ | ✅ | ❌ |
| Service Catalog (view) | ✅ | 👁️ Read | ❌ |
| Service Catalog (manage) | ✅ | ❌ | ❌ |
| Customer Records | ✅ | ✅ | ❌ |
| Staff Management | ✅ | ❌ | ❌ |
| Commission Setup | ✅ | ❌ | ❌ |
| Performance Reports (all) | ✅ | ❌ | ❌ |
| My Performance (own) | ✅ | ❌ | ✅ |
| Settings | ✅ | ❌ | ❌ |
| Change Own Password | ✅ | ✅ | ✅ |

---

## Data Model — Entity Relationships

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│   Customer   │───────▶│     Invoice       │◀───────│     User     │
│──────────────│  1:N   │──────────────────│  M:1   │  (Billing    │
│ customer_id  │        │ invoice_id        │        │   Person)    │
│ name         │        │ invoice_number    │        └──────────────┘
│ phone        │        │ customer_id (FK)  │
│ gender       │        │ created_by (FK)   │        ┌──────────────┐
│ date_of_birth│        │ payment_method    │        │    Staff     │
│ referral_src │        │ grand_total       │        │──────────────│
│ notes        │        │ gst_enabled       │        │ staff_id     │
│ status       │        │ status            │        │ name         │
└──────────────┘        └──────────┬───────┘        │ designation  │
                                   │                 │ commission % │
                                   │ 1:N             │ status       │
                                   ▼                 └──────┬───────┘
                        ┌──────────────────┐               │
                        │ InvoiceLineItem   │◀──────────────┘
                        │──────────────────│   M:1 (tagged professional)
                        │ line_item_id      │
                        │ invoice_id (FK)   │        ┌──────────────┐
                        │ service_id (FK)   │        │   Service    │
                        │ service_name_snap │        │──────────────│
                        │ unit_price_snap   │        │ service_id   │
                        │ professional_id   │───────▶│ name         │
                        │ professional_snap │  M:1   │ category     │
                        └──────────────────┘        │ price        │
                                                     │ duration     │
                        ┌──────────────────┐         │ status       │
                        │     Refund        │         └──────────────┘
                        │──────────────────│
                        │ refund_id         │        ┌──────────────────────┐
                        │ invoice_id (FK)   │        │ CommissionRateHistory │
                        │ refund_number     │        │──────────────────────│
                        │ type (FULL/PART)  │        │ staff_id (FK)        │
                        │ refund_amount     │        │ commission_pct       │
                        │ reason            │        │ effective_from       │
                        └──────────────────┘        │ effective_to         │
                                                     └──────────────────────┘
```

---

## Non-Functional Requirements

### Performance
| Requirement | Target |
|---|---|
| Customer search response time | < 500ms (offline/cached) |
| Invoice creation (save to local) | < 1 second |
| Dashboard load (cached data) | < 300ms skeleton, < 2s full render |
| Service catalog search | < 300ms (local) |
| Report generation (365-day) | < 5 seconds; loading indicator if > 3s |

### Offline-First Architecture
| Requirement | Detail |
|---|---|
| Local storage | IndexedDB for all entities |
| Sync strategy | Last-write-wins at field level |
| Conflict handling | Conflicts logged; Owner notified |
| Offline indicator | Persistent banner when no connectivity |
| Sync on reconnect | Automatic within 30 seconds of reconnect |
| Invoice numbering | `LOCAL-<device>-<timestamp>` offline; reconciled to `SAL-YYYYMM-NNNN` on sync |

### Security
| Requirement | Detail |
|---|---|
| Authentication | Username + password (JWT in sessionStorage) |
| Session timeout | 30 minutes of inactivity |
| Account lockout | 5 failed attempts → 15 min lockout |
| RBAC enforcement | Both UI layer and API layer (HTTP 403) |
| Password policy | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit |
| Data deletion | Soft deletes only — all records preserved for audit |

### Platform & Browser Support
| Target | Requirement |
|---|---|
| Primary device | Counter laptop or tablet (desktop-first layout) |
| Browser support | Chrome, Firefox, Edge (latest 2 versions) |
| Mobile browser | Functional but not primary target |
| Screen resolution | Optimised for 1024px+ width |
| Internet | Offline-capable; 2G/3G tolerant for sync |

---

## MVP Priority Summary

### 🔴 Must Have — V1 Launch Blockers

| Feature | Module |
|---|---|
| Customer profile creation & phone-first lookup | Customer Management |
| Visit history per customer | Customer Management |
| Lapsed customer report (45-day threshold) | Customer Management |
| Staff profile management | Staff Performance |
| Fixed commission % setup per staff | Staff Performance |
| Staff performance report (custom date range) | Staff Performance |
| Commission auto-calculation with rate history | Staff Performance |
| Create invoice → add services → tag professionals | Invoicing |
| GST optional toggle (CGST/SGST) | Invoicing |
| Discount — manual (% or ₹) + predefined offers | Invoicing |
| Cash / UPI / Card payment tracking | Invoicing |
| Invoice sharing via WhatsApp | Invoicing |
| Full and partial refunds | Invoicing |
| Auto-sequential invoice numbering | Invoicing |
| Owner dashboard (revenue, customers, staff, services) | Dashboard |
| Login with role-based access | Auth |
| Service catalog management (Owner) | Service Catalog |
| Offline-first with background sync | All Modules |

### 🟠 High Priority — V1.5 (Shortly After Launch)

| Feature | Module |
|---|---|
| End-of-day cash reconciliation view (Cash vs UPI vs Card) | Invoicing |
| Lapsed customer list with WhatsApp manual share | Customer Management |
| Birthday alert widget (today + 7 days) | Customer Management |
| Referral source analytics report | Customer Management |
| Commission breakdown per service (itemised) | Staff Performance |
| Duplicate profile detection & merge tool | Customer Management |
| Invoice PDF download | Invoicing |

### 🟡 Nice to Have — V2

| Feature | Notes |
|---|---|
| Appointment / booking calendar | Walk-in first; bookings come later |
| Staff leaderboard / gamification | Retention and adoption driver |
| AI churn prediction | Differentiation in V2 |
| Inventory management | Separate module |
| WhatsApp automated reminders | Upgrade from manual share |
| Loyalty / membership programs | Retention tool |
| Package / combo billing | High demand; complex to build |
| CSV export of reports | Data structured for it; deferred |
| Multi-branch support | Architecture change required |

---

## Out of Scope — V1

- Online appointment booking / customer-facing booking portal
- Loyalty and rewards programs
- Inventory management
- Package / combo session tracking
- Payroll integration or salary disbursement
- Multi-branch / multi-location support
- Mobile app (native iOS or Android)
- Customer self-service portal
- Payment gateway integration (physical payment only in V1)
- SMS / WhatsApp automated campaign sending
- Email invoice sharing (WhatsApp only in V1)
- Barcode scanning / POS hardware integration
- Tips collection
- Hard delete of any record (soft delete only, always)

---

## Resolved Decisions Log

All initial open questions have been resolved and logged in the Key Decisions Log. No active open questions remain for the V1 MVP.

---

*Master PRD v1.0 · Salon Management Web App · June 2026*  
*Research Sources: G2, Capterra India, SoftwareSuggest, Reddit, product websites of Zenoti, DINGG, Fresha, MioSalon, Salonist*
