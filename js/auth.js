/**
 * auth.js — Session management
 * JWT stored in sessionStorage (clears on tab close per PRD).
 * Inactivity timer: 30 minutes → auto-logout.
 */

const SESSION_KEY  = 'salon_session';
const TOKEN_KEY    = 'salon_token';
const INACTIVITY_MS = 30 * 60 * 1000;   // 30 minutes
const WARN_BEFORE_MS = 2 * 60 * 1000;   // warn 2 minutes before

let _inactivityTimer = null;
let _warnTimer       = null;
let _onLogoutCb      = null;

// ── Session read / write ─────────────────────────────────────

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user, token) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
  if (token && token !== 'local') sessionStorage.setItem(TOKEN_KEY, token);
  _resetInactivityTimer();
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  _clearTimers();
}

export function isLoggedIn() {
  return getSession() !== null;
}

export function currentUser() {
  return getSession()?.user ?? null;
}

export function currentRole() {
  return currentUser()?.role ?? null;
}

export function hasRole(...roles) {
  const role = currentRole();
  return role !== null && roles.includes(role);
}

// ── Inactivity timeout ───────────────────────────────────────

export function initInactivityTimer(onLogout) {
  _onLogoutCb = onLogout;
  const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
  events.forEach(e => document.addEventListener(e, _resetInactivityTimer, { passive: true }));
  _resetInactivityTimer();
}

function _resetInactivityTimer() {
  _clearTimers();
  if (!isLoggedIn()) return;

  _warnTimer = setTimeout(() => {
    _showInactivityWarning();
  }, INACTIVITY_MS - WARN_BEFORE_MS);

  _inactivityTimer = setTimeout(() => {
    clearSession();
    if (_onLogoutCb) _onLogoutCb('timeout');
  }, INACTIVITY_MS);
}

function _clearTimers() {
  clearTimeout(_inactivityTimer);
  clearTimeout(_warnTimer);
  _inactivityTimer = null;
  _warnTimer       = null;
}

function _showInactivityWarning() {
  // Emits a custom event; the modal component listens in M3
  document.dispatchEvent(new CustomEvent('salon:inactivity-warning', {
    detail: { expiresInMs: WARN_BEFORE_MS }
  }));
}

// ── Role constants (mirrors backend enums) ────────────────────
export const ROLES = {
  OWNER:          'OWNER',
  BILLING_PERSON: 'BILLING_PERSON',
  STAFF:          'STAFF',
};

// ── Role → landing route mapping ─────────────────────────────
export function landingRoute(role) {
  switch (role) {
    case ROLES.OWNER:          return '#/dashboard';
    case ROLES.BILLING_PERSON: return '#/billing';
    case ROLES.STAFF:          return '#/my-performance';
    default:                   return '#/login';
  }
}

// ── Route access control ─────────────────────────────────────
const ROUTE_ROLES = {
  '/dashboard':      [ROLES.OWNER],
  '/billing':        [ROLES.OWNER, ROLES.BILLING_PERSON],
  '/customers':      [ROLES.OWNER, ROLES.BILLING_PERSON],
  '/staff':          [ROLES.OWNER],
  '/catalog':        [ROLES.OWNER, ROLES.BILLING_PERSON],
  '/my-performance': [ROLES.OWNER, ROLES.STAFF],
  '/settings':       [ROLES.OWNER],
};

export function canAccessRoute(route) {
  const allowed = ROUTE_ROLES[route];
  if (!allowed) return false;
  return hasRole(...allowed);
}

// ── Password hashing (djb2 — frontend simulation; replaced by bcrypt in backend phase) ──

export function hashPassword(plain) {
  let h = 5381;
  for (let i = 0; i < plain.length; i++) h = Math.imul(h, 33) ^ plain.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function verifyPassword(plain, storedHash) {
  return hashPassword(plain) === storedHash;
}

// ── Account lockout (persisted in localStorage across page reloads) ───────────

const LOCKOUT_STORE  = 'salon_lockouts';
const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 15 * 60 * 1000; // 15 minutes

function _getLockouts() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_STORE)) ?? {}; }
  catch { return {}; }
}

export function checkLockout(username) {
  const entry = _getLockouts()[username];
  if (!entry?.lockedUntil) return { locked: false, remaining: 0 };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, remaining: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, remaining: 0 };
}

export function recordFailedAttempt(username) {
  const data  = _getLockouts();
  const entry = data[username] ?? { attempts: 0, lockedUntil: null };
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.attempts    = 0;
  }
  data[username] = entry;
  localStorage.setItem(LOCKOUT_STORE, JSON.stringify(data));
  return entry.lockedUntil
    ? { locked: true, attemptsLeft: 0 }
    : { locked: false, attemptsLeft: MAX_ATTEMPTS - entry.attempts };
}

export function resetLockout(username) {
  const data = _getLockouts();
  delete data[username];
  localStorage.setItem(LOCKOUT_STORE, JSON.stringify(data));
}
