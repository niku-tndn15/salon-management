/**
 * sidebar.js — Renders role-filtered navigation sidebar.
 * Called once on login; re-called if role changes.
 */

import { ROLES } from '../auth.js';
import { escapeHtml } from '../utils.js';

const NAV_ITEMS = [
  {
    href:  '#/dashboard',
    label: 'Dashboard',
    icon:  'layout-dashboard',
    roles: [ROLES.OWNER],
  },
  {
    href:  '#/billing',
    label: 'Billing',
    icon:  'receipt',
    roles: [ROLES.OWNER, ROLES.BILLING_PERSON],
  },
  {
    href:  '#/customers',
    label: 'Customers',
    icon:  'users',
    roles: [ROLES.OWNER, ROLES.BILLING_PERSON],
  },
  {
    href:  '#/staff',
    label: 'Staff',
    icon:  'user-check',
    roles: [ROLES.OWNER],
  },
  {
    href:  '#/catalog',
    label: 'Services',
    icon:  'scissors',
    roles: [ROLES.OWNER],
  },
  {
    href:  '#/my-performance',
    label: 'My Performance',
    icon:  'bar-chart-2',
    roles: [ROLES.OWNER, ROLES.STAFF],
  },
  {
    href:  '#/settings',
    label: 'Settings',
    icon:  'settings',
    roles: [ROLES.OWNER],
  },
];

export function renderSidebar(user) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.hidden = false;

  const role        = user?.role ?? '';
  const activeHash  = window.location.hash || '#/login';
  const filtered    = NAV_ITEMS.filter(item => item.roles.includes(role));
  const avatarText  = _initials(user?.name ?? 'U');
  const roleLabel   = _roleLabel(role);

  sidebar.innerHTML = `
    <!-- Brand -->
    <a href="#/dashboard" class="sidebar__brand" aria-label="Salon home">
      <span class="sidebar__brand-icon">
        <i data-lucide="scissors"></i>
      </span>
      <span class="sidebar__brand-name">Salon.</span>
    </a>

    <!-- Navigation -->
    <nav aria-label="Main navigation">
      <ul class="sidebar__nav" role="list">
        ${filtered.map(item => `
          <li class="sidebar__nav-item" role="listitem">
            <a href="${item.href}"
               class="sidebar__nav-link ${activeHash === item.href ? 'active' : ''}"
               aria-current="${activeHash === item.href ? 'page' : 'false'}">
              <i data-lucide="${item.icon}"></i>
              <span class="sidebar__nav-link-label">${escapeHtml(item.label)}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>

    <!-- Footer: user info + logout -->
    <div class="sidebar__footer">
      <div class="sidebar__user">
        <div class="sidebar__avatar" aria-hidden="true">${avatarText}</div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name">${escapeHtml(user?.name ?? 'User')}</div>
          <div class="sidebar__user-role">${roleLabel}</div>
        </div>
      </div>
      <button
        class="btn--logout"
        id="sidebar-logout-btn"
        type="button"
        aria-label="Logout">
        <i data-lucide="log-out"></i>
        Logout
      </button>
    </div>
  `;

  // Wire logout button
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      document.dispatchEvent(new Event('salon:logout'));
    });
  }

  // Update active link on hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    sidebar.querySelectorAll('.sidebar__nav-link').forEach(a => {
      const isActive = a.getAttribute('href') === hash;
      a.classList.toggle('active', isActive);
      a.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function _initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function _roleLabel(role) {
  switch (role) {
    case ROLES.OWNER:          return 'Owner';
    case ROLES.BILLING_PERSON: return 'Billing Person';
    case ROLES.STAFF:          return 'Staff';
    default:                   return role;
  }
}
