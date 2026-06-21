/**
 * app.js — Entry point
 * Initialises: DB → Auth → Offline banner → Sidebar → Header → Router
 */

import { initRouter }            from './router.js';
import { isLoggedIn, currentUser, currentRole, initInactivityTimer, clearSession, landingRoute } from './auth.js';
import { renderSidebar }         from './components/sidebar.js';
import { renderHeader }          from './components/header.js';
import { initOfflineBanner }     from './components/offline-banner.js';
import { initToast }             from './components/toast.js';

// Page modules — importing registers their routes with the router before initRouter() runs
import './pages/login.js';
import './pages/dashboard.js';
import './pages/settings.js';
import './pages/catalog.js';
import './pages/customers.js';
import './pages/billing.js';
import './pages/staff.js';

async function boot() {
  // 1. Initialise DB (M1 will add Dexie setup; stub for M0)
  try {
    const { initDB } = await import('./db.js').catch(() => ({ initDB: () => Promise.resolve() }));
    await initDB();
  } catch (e) {
    console.warn('DB init skipped (M0):', e.message);
  }

  // 2. Toast system (must be before any error can occur)
  initToast();

  // 3. Offline banner
  initOfflineBanner();

  // 4. If logged in, render shell chrome
  if (isLoggedIn()) {
    renderSidebar(currentUser());
    renderHeader(currentUser());
    initInactivityTimer(_handleInactivityLogout);
  } else {
    // Hide sidebar + header until login succeeds
    const sidebar = document.getElementById('sidebar');
    const header  = document.getElementById('top-header');
    if (sidebar) sidebar.hidden = true;
    if (header)  header.hidden  = true;
  }

  // 5. Listen for login / logout events from page modules
  document.addEventListener('salon:login', e => {
    renderSidebar(e.detail.user);
    renderHeader(e.detail.user);
    initInactivityTimer(_handleInactivityLogout);
  });

  document.addEventListener('salon:logout', () => {
    clearSession();
    window.location.hash = '#/login';
    // Re-hide shell chrome
    const sidebar = document.getElementById('sidebar');
    const header  = document.getElementById('top-header');
    if (sidebar) { sidebar.hidden = true; sidebar.innerHTML = ''; }
    if (header)  { header.hidden  = true; header.innerHTML  = ''; }
  });

  // 6. Start router (handles hash routing + RBAC)
  initRouter();

  // 7. Replace Lucide placeholder icons
  if (window.lucide) window.lucide.createIcons();
}

function _handleInactivityLogout(reason) {
  if (reason === 'timeout') {
    document.dispatchEvent(new Event('salon:logout'));
  }
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
