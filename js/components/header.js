/**
 * header.js — Top header bar.
 * Renders page title, search icon, notification bell placeholder, user avatar.
 */

import { escapeHtml, initials } from '../utils.js';

export function renderHeader(user) {
  const header = document.getElementById('top-header');
  if (!header) return;
  header.hidden = false;

  const avatar = initials(user?.name ?? 'U');

  header.innerHTML = `
    <!-- Left: page title (updated by router on each navigation) -->
    <div class="top-header__left">
      <span class="top-header__title" id="header-page-title">Dashboard</span>
      <span class="top-header__breadcrumb" id="header-breadcrumb"></span>
    </div>

    <!-- Right: icon buttons + avatar -->
    <div class="top-header__right">
      <button class="top-header__icon-btn" aria-label="Notifications" type="button">
        <i data-lucide="bell"></i>
      </button>
      <div class="sidebar__avatar top-header__avatar"
           style="width:32px;height:32px;font-size:12px;"
           aria-hidden="true"
           title="${escapeHtml(user?.name ?? '')}">
        ${avatar}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/** Called by router to update the page title in the header */
export function setHeaderTitle(title, breadcrumb = '') {
  const titleEl = document.getElementById('header-page-title');
  const bcEl    = document.getElementById('header-breadcrumb');
  if (titleEl) titleEl.textContent = title;
  if (bcEl)    bcEl.textContent    = breadcrumb;
}
