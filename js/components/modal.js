/**
 * modal.js — Reusable modal component.
 *
 * Usage:
 *   import { openModal, closeModal } from './modal.js';
 *
 *   openModal({
 *     title: 'Add Customer',
 *     size: 'md',          // sm | md | lg | xl
 *     bodyHTML: `<form>…</form>`,
 *     footerHTML: `<button class="btn btn--primary" id="modal-save">Save</button>`,
 *     onOpen: (modalEl) => { … wire events … },
 *     onClose: () => { … cleanup … },
 *   });
 */

let _currentOnClose = null;

export function openModal({ title, bodyHTML = '', footerHTML = '', size = 'md', onOpen, onClose } = {}) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  _currentOnClose = onClose ?? null;

  overlay.innerHTML = `
    <div class="modal modal--${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title" id="active-modal">
      <div class="modal__header">
        <h2 class="modal__title" id="modal-title">${_esc(title)}</h2>
        <button class="modal__close" id="modal-close-btn" aria-label="Close" type="button">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal__body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal__footer">${footerHTML}</div>` : ''}
    </div>
  `;

  overlay.hidden = false;
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  // Close button
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);

  // Click outside
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); }, { once: true });

  // Escape key
  document.addEventListener('keydown', _escHandler);

  // Focus trap
  const modalEl = document.getElementById('active-modal');
  _trapFocus(modalEl);

  if (onOpen && modalEl) onOpen(modalEl);
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.hidden = true;
  overlay.innerHTML = '';
  document.removeEventListener('keydown', _escHandler);
  if (_currentOnClose) { _currentOnClose(); _currentOnClose = null; }
}

/** Open a confirmation modal (danger variant) */
export function openConfirm({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  openModal({
    title,
    size: 'sm',
    bodyHTML: `
      <div class="modal--confirm" style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">
        <div class="modal__confirm-icon modal__confirm-icon--danger">
          <i data-lucide="alert-triangle"></i>
        </div>
        <p class="modal__confirm-text">${_esc(message)}</p>
      </div>
    `,
    footerHTML: `
      <button class="btn btn--secondary" id="modal-cancel-btn" type="button">Cancel</button>
      <button class="btn btn--danger"    id="modal-confirm-btn" type="button">${_esc(confirmLabel)}</button>
    `,
    onOpen: () => {
      document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
      });
      document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
      });
    },
  });
}

// ── Internal ─────────────────────────────────────────────────

function _escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function _trapFocus(el) {
  if (!el) return;
  const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  focusable[0].focus();

  el.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
