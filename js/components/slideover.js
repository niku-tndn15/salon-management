/**
 * slideover.js — Right-side slide-over panel.
 *
 * Usage:
 *   import { openSlideover, closeSlideover } from './slideover.js';
 *
 *   openSlideover({
 *     title: 'Invoice #SAL-202606-0001',
 *     bodyHTML: `…invoice detail HTML…`,
 *     footerHTML: `<button …>Share on WhatsApp</button>`,
 *     onOpen: (panelEl) => { … },
 *     onClose: () => { … },
 *   });
 */

let _backdrop    = null;
let _onCloseCb   = null;

export function openSlideover({ title, bodyHTML = '', footerHTML = '', onOpen, onClose } = {}) {
  const panel = document.getElementById('slideover-panel');
  if (!panel) return;

  _onCloseCb = onClose ?? null;

  panel.innerHTML = `
    <div class="slideover__header">
      <h2 class="slideover__title">${_esc(title)}</h2>
      <button class="slideover__close" id="slideover-close-btn" aria-label="Close panel" type="button">
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="slideover__body">${bodyHTML}</div>
    ${footerHTML ? `<div class="slideover__footer">${footerHTML}</div>` : ''}
  `;

  panel.hidden = false;
  // Trigger CSS transition
  requestAnimationFrame(() => panel.classList.add('open'));

  // Backdrop
  _backdrop = document.createElement('div');
  _backdrop.className = 'slideover-backdrop';
  _backdrop.addEventListener('click', closeSlideover);
  document.body.appendChild(_backdrop);

  // Escape key
  document.addEventListener('keydown', _escHandler);

  // Close button
  document.getElementById('slideover-close-btn')?.addEventListener('click', closeSlideover);

  if (window.lucide) window.lucide.createIcons({ nodes: [panel] });
  if (onOpen) onOpen(panel);
}

export function closeSlideover() {
  const panel = document.getElementById('slideover-panel');
  if (!panel) return;

  panel.classList.remove('open');
  panel.addEventListener('transitionend', () => {
    panel.hidden = true;
    panel.innerHTML = '';
  }, { once: true });

  if (_backdrop) { _backdrop.remove(); _backdrop = null; }
  document.removeEventListener('keydown', _escHandler);

  if (_onCloseCb) { _onCloseCb(); _onCloseCb = null; }
}

function _escHandler(e) {
  if (e.key === 'Escape') closeSlideover();
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
