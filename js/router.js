/**
 * router.js — Hash-based SPA router with RBAC guards.
 *
 * Routes: #/login | #/dashboard | #/billing | #/customers
 *         #/staff | #/catalog | #/my-performance | #/settings
 *
 * Each route has an async page loader. Loaders are registered
 * by page modules (added in M3+). M0 renders a placeholder.
 */

import { isLoggedIn, canAccessRoute, landingRoute, currentRole } from './auth.js';

/** Map of route path → async () => void (page render fn) */
const _routes = new Map();

/** Register a page loader for a route path (e.g. '/dashboard') */
export function registerRoute(path, loaderFn) {
  _routes.set(path, loaderFn);
}

/** Start listening to hash changes */
export function initRouter() {
  window.addEventListener('hashchange', _handleRoute);
  _handleRoute(); // handle initial load
}

/** Navigate programmatically */
export function navigate(hash) {
  window.location.hash = hash;
}

// ── Internal ─────────────────────────────────────────────────

async function _handleRoute() {
  const hash   = window.location.hash || '#/login';
  const path   = hash.replace('#', '') || '/login';
  const route  = path.split('?')[0]; // strip query params

  // Auth gate
  if (route === '/login') {
    _renderLoginShell();
    const loader = _routes.get('/login');
    if (loader) {
      await loader();
    } else {
      _renderDevLoginForm();
    }
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (!isLoggedIn()) {
    navigate('#/login');
    return;
  }

  // RBAC gate
  if (!canAccessRoute(route)) {
    _renderAccessDenied(route);
    return;
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar__nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });

  // Update header title
  _updateHeaderTitle(route);

  // Show app shell (in case we came from login)
  _showAppShell();

  // Run page loader or show placeholder
  const loader = _routes.get(route);
  const content = document.getElementById('page-content');
  if (!content) return;

  if (loader) {
    content.innerHTML = _loadingHTML();
    try {
      await loader();
    } catch (err) {
      console.error('Page load error:', err);
      content.innerHTML = _errorHTML(err);
    }
  } else {
    // Placeholder (M0: page modules not yet wired)
    content.innerHTML = _placeholderHTML(route);
  }

  // Re-initialise Lucide icons after DOM update
  if (window.lucide) window.lucide.createIcons();
}

function _renderLoginShell() {
  const sidebar = document.getElementById('sidebar');
  const header  = document.getElementById('top-header');
  const content = document.getElementById('page-content');
  if (sidebar) sidebar.hidden = true;
  if (header)  header.hidden  = true;
  // Keep app-shell as flex — hidden sidebar means main-wrapper fills full width
  if (content) { content.style.padding = '0'; content.style.height = '100%'; }
}

function _showAppShell() {
  const sidebar = document.getElementById('sidebar');
  const header  = document.getElementById('top-header');
  const content = document.getElementById('page-content');
  if (sidebar) sidebar.hidden = false;
  if (header)  header.hidden  = false;
  if (content) { content.style.padding = ''; content.style.height = ''; }
}

function _updateHeaderTitle(route) {
  const titles = {
    '/dashboard':      'Dashboard',
    '/billing':        'Billing',
    '/customers':      'Customers',
    '/staff':          'Staff',
    '/catalog':        'Service Catalog',
    '/my-performance': 'My Performance',
    '/settings':       'Settings',
  };
  const titleEl = document.querySelector('.top-header__title');
  if (titleEl) titleEl.textContent = titles[route] ?? '';
}

function _renderAccessDenied(route) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = `
    <div class="empty-state">
      <i data-lucide="lock"></i>
      <p class="empty-state__title">Access Denied</p>
      <p class="empty-state__desc">
        You don't have permission to view this page.
        <br>You are logged in as <strong>${currentRole()?.replace('_', ' ')}</strong>.
      </p>
      <a href="${landingRoute(currentRole())}" class="btn btn--primary" style="margin-top:8px">
        Go to my home
      </a>
    </div>`;
  if (window.lucide) window.lucide.createIcons();
}

function _loadingHTML() {
  return `<div class="page-loading"><div class="spinner"></div><span>Loading…</span></div>`;
}

function _placeholderHTML(route) {
  return `
    <div class="empty-state">
      <i data-lucide="construction"></i>
      <p class="empty-state__title">${_routeLabel(route)}</p>
      <p class="empty-state__desc">This page will be built in an upcoming milestone.</p>
    </div>`;
}

function _errorHTML(err) {
  return `
    <div class="empty-state">
      <i data-lucide="alert-triangle"></i>
      <p class="empty-state__title">Something went wrong</p>
      <p class="empty-state__desc">${err?.message ?? 'Unknown error'}</p>
    </div>`;
}

function _routeLabel(route) {
  return route.replace('/', '').replace('-', ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Dev-mode login form (used in M0 before login.js is built in M2) */
function _renderDevLoginForm() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div class="login-page">
      <div class="login-page__brand">
        <a class="login-page__logo" href="#">
          <div class="login-page__logo-icon">
            <i data-lucide="scissors"></i>
          </div>
          Salon Manager
        </a>
        <div class="login-page__tagline">
          <h1>Manage your salon smarter</h1>
          <p>Billing, staff performance, customer insights — all in one place.</p>
        </div>
        <p class="login-page__brand-footer">© 2026 Salon Manager</p>
      </div>

      <div class="login-page__form-panel">
        <form id="dev-login-form" class="login-form" novalidate>
          <div class="login-form__header">
            <h2 class="login-form__title">Welcome back</h2>
            <p class="login-form__subtitle">Sign in to continue</p>
          </div>
          <div class="login-form__fields">
            <div>
              <label for="dev-username" class="form-label">Username</label>
              <input id="dev-username" class="form-input" type="text"
                     autocomplete="username"
                     placeholder="Try: owner · billing · staff" />
            </div>
            <div>
              <label for="dev-password" class="form-label">Password</label>
              <input id="dev-password" class="form-input" type="password"
                     autocomplete="current-password" placeholder="Any password" />
            </div>
            <div id="dev-login-error" class="login-error" hidden>
              <i data-lucide="alert-circle"></i>
              <span id="dev-login-error-msg"></span>
            </div>
          </div>
          <button type="submit" class="btn btn--primary login-form__submit">Sign in</button>
          <p style="font-size:var(--text-xs);color:var(--clr-text-muted);text-align:center;margin-top:-8px;">
            Dev mode — username sets role
          </p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('dev-login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('dev-username')?.value.trim() ?? '';
    const errorEl  = document.getElementById('dev-login-error');
    const errorMsg = document.getElementById('dev-login-error-msg');

    if (!username) {
      if (errorEl)  errorEl.hidden = false;
      if (errorMsg) errorMsg.textContent = 'Please enter a username.';
      return;
    }

    let role = 'OWNER';
    let name = 'Priya Sharma';
    if (username === 'billing') { role = 'BILLING_PERSON'; name = 'Meena Patel'; }
    else if (username === 'staff') { role = 'STAFF'; name = 'Anita Singh'; }

    const user = { id: 1, name, username, role };
    // Write to sessionStorage in the same format auth.js expects
    sessionStorage.setItem('salon_session', JSON.stringify({ user, token: 'dev-token-m0' }));
    document.dispatchEvent(new CustomEvent('salon:login', { detail: { user } }));
    navigate(landingRoute(role));
  });
}
