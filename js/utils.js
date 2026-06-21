/**
 * utils.js — Shared helpers used across all page modules.
 * No imports required (pure functions only).
 */

// ── Currency ─────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees.
 * e.g. 1234.5 → "₹1,234.50"
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Format a compact number for KPI cards.
 * e.g. 123456 → "₹1.23L"
 */
export function formatCurrencyCompact(amount) {
  const n = Number(amount) || 0;
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
}

// ── GST ──────────────────────────────────────────────────────

const GST_RATE = 0.09; // 9% each CGST + SGST

/**
 * Calculate GST breakdown on a taxable amount.
 * @returns {{ cgst: number, sgst: number, total: number }}
 */
export function calculateGST(taxableAmount) {
  const cgst = round2(taxableAmount * GST_RATE);
  const sgst = round2(taxableAmount * GST_RATE);
  return { cgst, sgst, total: cgst + sgst };
}

// ── Discount ─────────────────────────────────────────────────

/**
 * Compute resolved discount amount.
 * @param {'PERCENTAGE'|'FLAT'} type
 * @param {number} value - % or flat ₹
 * @param {number} subtotal
 * @returns {number} resolved ₹ discount
 */
export function calculateDiscount(type, value, subtotal) {
  if (!value || value <= 0) return 0;
  if (type === 'PERCENTAGE') {
    const pct = Math.min(value, 100);
    return round2(subtotal * (pct / 100));
  }
  return round2(Math.min(value, subtotal));
}

// ── Invoice totals ────────────────────────────────────────────

/**
 * Compute full invoice totals from line items + discount + GST flag.
 */
export function computeInvoiceTotals({ lineItems = [], discountType, discountValue, gstEnabled }) {
  const subtotal       = round2(lineItems.reduce((s, li) => s + li.unit_price_snap * (li.quantity || 1), 0));
  const discountAmount = calculateDiscount(discountType, discountValue, subtotal);
  const taxableAmount  = round2(subtotal - discountAmount);
  const { cgst, sgst } = gstEnabled ? calculateGST(taxableAmount) : { cgst: 0, sgst: 0 };
  const grandTotal     = round2(taxableAmount + cgst + sgst);
  return { subtotal, discountAmount, taxableAmount, cgst, sgst, grandTotal };
}

// ── Dates ────────────────────────────────────────────────────

/**
 * Format an ISO date string to locale-friendly display.
 * e.g. "2026-06-17" → "17 Jun 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Format an ISO datetime string to "17 Jun 2026, 2:30 PM"
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

/**
 * Number of days since a given date (ISO string or Date).
 */
export function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Returns true if a customer is lapsed (no visit in threshold days).
 */
export function isLapsed(lastVisitDate, thresholdDays = 45) {
  return daysSince(lastVisitDate) > thresholdDays;
}

/**
 * Returns true if a birthday falls within the next `daysAhead` days.
 * Compares month + day only (year-agnostic).
 */
export function isBirthdayUpcoming(dobStr, daysAhead = 7) {
  if (!dobStr) return false;
  const today   = new Date();
  const dob     = new Date(dobStr);
  const thisYear = today.getFullYear();

  let next = new Date(thisYear, dob.getMonth(), dob.getDate());
  if (next < today) next = new Date(thisYear + 1, dob.getMonth(), dob.getDate());

  const diff = (next - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= daysAhead;
}

/**
 * Get start-of-day for a Date (midnight).
 */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get a Date N days ago from today.
 */
export function daysAgoDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO date string for today: "2026-06-17" */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Invoice numbering ────────────────────────────────────────

/**
 * Generate a LOCAL invoice number for offline use.
 * Format: LOCAL-<deviceId>-<timestamp>
 */
export function localInvoiceNumber() {
  const deviceId = _getDeviceId();
  return `LOCAL-${deviceId}-${Date.now()}`;
}

function _getDeviceId() {
  let id = localStorage.getItem('salon_device_id');
  if (!id) {
    id = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    localStorage.setItem('salon_device_id', id);
  }
  return id;
}

// ── WoW delta ────────────────────────────────────────────────

/**
 * Calculate week-over-week percentage change.
 * @returns {{ pct: number, direction: 'up'|'down'|'flat' }}
 */
export function wowDelta(thisWeek, lastWeek) {
  if (!lastWeek || lastWeek === 0) {
    return { pct: thisWeek > 0 ? 100 : 0, direction: thisWeek > 0 ? 'up' : 'flat' };
  }
  const pct = round2(((thisWeek - lastWeek) / lastWeek) * 100);
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  };
}

/**
 * Render a WoW delta HTML chip.
 */
export function renderDelta({ pct, direction }) {
  const icons = { up: '↑', down: '↓', flat: '—' };
  const cls   = `kpi-card__delta kpi-card__delta--${direction}`;
  return `<span class="${cls}">${icons[direction]} ${pct}%</span>`;
}

// ── DOM helpers ───────────────────────────────────────────────

/** Select a single element; throws if not found */
export function qs(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

/** Select a single element; returns null if not found */
export function qsMaybe(selector, root = document) {
  return root.querySelector(selector);
}

/** Select all matching elements as an array */
export function qsAll(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/** Create an element with optional className and innerHTML */
export function el(tag, { className, html, text, attrs = {} } = {}) {
  const elem = document.createElement(tag);
  if (className) elem.className = className;
  if (html !== undefined) elem.innerHTML = html;
  if (text !== undefined) elem.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
}

/** Escape user input before rendering as HTML */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Initials from a name string. "Ravi Kumar" → "RK" */
export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/** WhatsApp share URL */
export function whatsappUrl(phone, message) {
  const cleaned = phone.replace(/\D/g, '');
  const number  = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// ── Internal helpers ──────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100; }
