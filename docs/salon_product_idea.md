# 💇 Salon Management Product — Idea Summary

## Problem Statement

Salon business owners today operate with **zero digital infrastructure**. Everything — customer visits, staff performance, and billing — is handled through manual bookkeeping. This leads to:

- No visibility into customer history or retention
- No way to measure individual staff contribution
- Billing that is disconnected from who actually performed the service

---

## Core Pain Points (Scope: MVP)

### 1. 👤 Customer Management
**Current Pain:** Salon owners have no record of which customers visited, how often, and what services they availed. Everything lives in memory or a paper register.

**What we solve:**
- Digital customer profiles (name, contact, visit history)
- Track every visit — date, services taken, amount paid
- View customer frequency (weekly, monthly, custom period)
- Identify loyal vs. at-risk (lapsed) customers at a glance

---

### 2. 💼 Staff Performance & Service Tracking
**Current Pain:** There is no way for owners to know which professional did how many services in a day or across a period. Staff accountability is zero.

**What we solve:**
- Each professional has a profile in the system
- Every service logged is tagged to a specific professional
- Owner can view:
  - Services done by each staff member — per day, per week, per month
  - Volume of work (number of services)
  - Revenue generated per professional
- Helps with fair commission calculation and performance reviews

---

### 3. 🧾 Invoicing with Professional Tagging
**Current Pain:** Billing is done manually (paper bills or mental calculation), with no linkage to which staff member performed which service.

**What we solve:**
- Create a digital invoice per customer visit
- Each line item on the invoice is tagged to the professional who performed it
  - e.g., *Haircut — ₹300 — by Ravi*
  - e.g., *Facial — ₹600 — by Sunita*
- Invoice shows total amount, services breakdown, and staff attribution
- Invoice can be shared with the customer (WhatsApp / print)
- All invoices are stored and searchable

---

## How the 3 Modules Connect

```
Customer walks in
        ↓
New Visit is created → Linked to Customer Profile
        ↓
Services are added to the Visit → Each tagged to a Professional
        ↓
Invoice is generated → Shared with Customer
        ↓
Data flows into:
   ├── Customer History (Customer Management)
   └── Staff Performance Dashboard (Staff Tracking)
```

---

## Key Actors

| Actor | Role |
|---|---|
| **Salon Owner** | Views dashboards, manages staff profiles, reviews invoices |
| **Billing Person (at counter)** | The primary operator — creates visits, adds services, tags professionals, generates invoices |
| **Professional (Stylist)** | Tagged on services; does NOT need to interact with the system directly |

> The **billing person** is the single most important user in this system. The entire UX must be optimised for their speed and ease — they handle this *after* the service is done, while the customer is at the counter.

---

## Product Constraints & Decisions

| Dimension | Decision | Implication |
|---|---|---|
| **Who bills** | Staff at the shop counter | UI must be fast, minimal clicks, no customer self-serve needed |
| **Branch scope** | Single salon only | No multi-location complexity, simpler data model |
| **Platform** | Web app | Works on a laptop or tablet at the counter; no app install needed |

---

## MVP Feature List

| Feature | Priority |
|---|---|
| Customer profile creation & visit history | 🔴 Must Have |
| Staff / professional profile management | 🔴 Must Have |
| Service catalog (list of services + prices) | 🔴 Must Have |
| Create visit → add services → tag professional | 🔴 Must Have |
| Invoice generation with professional tagging | 🔴 Must Have |
| Staff performance view (by day / period) | 🔴 Must Have |
| Customer visit frequency report | 🟠 High Priority |
| Invoice sharing via WhatsApp | 🟠 High Priority |
| Dashboard — revenue, top services, top staff | 🟡 Nice to Have |

---

## What This Is NOT (Out of Scope for Now)
- Inventory management
- Online appointment booking / customer-facing booking portal
- Loyalty / rewards program
- Multi-branch management
- Mobile app
- Customer self-service

---

*Version 1.1 — Constraints Locked | June 2026*
