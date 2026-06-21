/**
 * toast.js — Global toast notification system.
 * Usage: toast.success('Saved!') | toast.error('Failed') | toast.info('…')
 * Auto-dismisses after 4 seconds.
 */

const DISMISS_MS = 4000;

let _container = null;

export function initToast() {
  _container = document.getElementById('toast-container');
}

const toast = {
  success: (title, message) => _show('success', title, message, 'check-circle'),
  error:   (title, message) => _show('error',   title, message, 'x-circle'),
  warning: (title, message) => _show('warning', title, message, 'alert-triangle'),
  info:    (title, message) => _show('info',    title, message, 'info'),
};

export default toast;

// ── Internal ─────────────────────────────────────────────────

function _show(type, title, message, icon) {
  if (!_container) {
    _container = document.getElementById('toast-container');
    if (!_container) return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast__icon"><i data-lucide="${icon}"></i></span>
    <div class="toast__content">
      <div class="toast__title">${_esc(title)}</div>
      ${message ? `<div class="toast__message">${_esc(message)}</div>` : ''}
    </div>
    <button class="toast__close" aria-label="Dismiss notification" type="button">
      <i data-lucide="x"></i>
    </button>
  `;

  _container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ nodes: [toast] });

  // Dismiss button
  toast.querySelector('.toast__close').addEventListener('click', () => _dismiss(toast));

  // Auto-dismiss
  const timer = setTimeout(() => _dismiss(toast), DISMISS_MS);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));

  return toast;
}

function _dismiss(toastEl) {
  if (toastEl._dismissing) return;
  toastEl._dismissing = true;
  toastEl.classList.add('hiding');
  const remove = () => toastEl.remove();
  toastEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 300); // fallback if animationend doesn't fire
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
