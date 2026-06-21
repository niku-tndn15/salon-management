/**
 * catalog.js — Service Catalog page.
 * Features: category filter chips, service card grid, add/edit modal, status toggle.
 */

import { registerRoute } from '../router.js';
import db, { updateServiceStatus } from '../db.js';
import toast            from '../components/toast.js';
import { hasRole }      from '../auth.js';

registerRoute('/catalog', _renderCatalog);

let _categories   = [];
let _services     = [];
let _activeFilter = 'all';
let _isOwner      = false;

// ── Page render ───────────────────────────────────────────────────────────────

async function _renderCatalog() {
  const content = document.getElementById('page-content');
  if (!content) return;

  _activeFilter = 'all';
  _isOwner      = hasRole('OWNER');
  content.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;

  [_categories, _services] = await Promise.all([
    db.serviceCategories.toArray(),
    db.services.toArray(),
  ]);

  content.innerHTML = `
    <div class="catalog-page">
      <div class="table-toolbar">
        <div class="table-toolbar__left">
          <div class="catalog-categories" id="cat-filter">
            <button class="btn btn--sm btn--primary" data-cat="all">All</button>
            ${_categories.map(c => `
              <button class="btn btn--sm btn--ghost" data-cat="${c.id}">${_esc(c.name)}</button>
            `).join('')}
          </div>
        </div>
        ${_isOwner ? `<div class="table-toolbar__right">
          <button class="btn btn--primary btn--sm" id="add-service-btn">
            <i data-lucide="plus"></i> Add Service
          </button>
        </div>` : ''}
      </div>
      <div class="catalog-grid" id="catalog-grid"></div>
    </div>
  `;

  // Category filter
  document.getElementById('cat-filter')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    _activeFilter = btn.dataset.cat;
    document.querySelectorAll('#cat-filter [data-cat]').forEach(b => {
      b.className = `btn btn--sm ${b.dataset.cat === _activeFilter ? 'btn--primary' : 'btn--ghost'}`;
    });
    _renderGrid();
  });

  // Add service (owner only)
  if (_isOwner) document.getElementById('add-service-btn')?.addEventListener('click', () => _openModal());

  // Grid action delegation — persists across _renderGrid() innerHTML replacements
  document.getElementById('catalog-grid')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const svc = _services.find(s => String(s.id) === editBtn.dataset.edit);
      if (svc) _openModal(svc);
      return;
    }
    const toggleBtn = e.target.closest('[data-toggle]');
    if (toggleBtn) {
      const id   = toggleBtn.dataset.toggle;
      const next = toggleBtn.dataset.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      try {
        const updated = await updateServiceStatus(id, next);
        const idx = _services.findIndex(s => String(s.id) === String(id));
        if (idx !== -1) _services[idx] = { ..._services[idx], ...(updated || {}), status: next };
        toast.success(next === 'ACTIVE' ? 'Service activated.' : 'Service deactivated.');
        _renderGrid();
      } catch {
        toast.error('Failed to update service status.');
      }
    }
  });

  _renderGrid();
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function _renderGrid() {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const filtered = _activeFilter === 'all'
    ? _services
    : _services.filter(s => String(s.categoryId) === String(_activeFilter));

  if (!filtered.length) {
    grid.innerHTML = `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No services in this category.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const cat      = _categories.find(c => c.id === s.categoryId);
    const isActive = s.status !== 'INACTIVE';
    return `
      <div class="catalog-card${isActive ? '' : ' inactive'}">
        <div class="catalog-card__header">
          <div>
            <div class="catalog-card__name">${_esc(s.name)}</div>
            <div class="catalog-card__category">${_esc(cat?.name ?? '')}</div>
          </div>
          <span class="badge ${isActive ? 'badge--active' : 'badge--inactive'} badge--no-dot">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="catalog-card__price">${_fmt(s.price)}</div>
        <div class="catalog-card__meta">
          <i data-lucide="clock"></i> ${s.durationMin ?? '—'} min
        </div>
        ${_isOwner ? `<div class="catalog-card__actions">
          <button class="btn btn--sm btn--ghost" data-edit="${s.id}">
            <i data-lucide="pencil"></i> Edit
          </button>
          <button class="btn btn--sm ${isActive ? 'btn--ghost' : 'btn--primary'}"
                  data-toggle="${s.id}" data-status="${s.status}">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>` : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons({ nodes: [grid] });
}

// ── Service modal ─────────────────────────────────────────────────────────────

function _openModal(service = null) {
  const isEdit  = !!service;
  const catOpts = _categories.map(c => `
    <option value="${c.id}" ${service?.categoryId === c.id ? 'selected' : ''}>${_esc(c.name)}</option>
  `).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Edit Service' : 'Add Service'}</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label class="form-label">Name <span class="required">*</span></label>
          <input class="form-input" id="svc-name" type="text"
                 value="${_esc(service?.name ?? '')}"
                 placeholder="e.g. Deep Conditioning" />
        </div>
        <div class="form-group">
          <label class="form-label">Category <span class="required">*</span></label>
          <select class="form-select" id="svc-cat">${catOpts}</select>
        </div>
        <div class="service-form__price-row">
          <div class="form-group">
            <label class="form-label">Price (₹) <span class="required">*</span></label>
            <input class="form-input" id="svc-price" type="number"
                   min="0" step="1" value="${service?.price ?? ''}"
                   placeholder="e.g. 500" />
          </div>
          <div class="form-group">
            <label class="form-label">Duration (min)</label>
            <input class="form-input" id="svc-dur" type="number"
                   min="5" step="5" value="${service?.durationMin ?? ''}"
                   placeholder="e.g. 30" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="svc-cancel">Cancel</button>
        <button class="btn btn--primary" id="svc-save">${isEdit ? 'Save Changes' : 'Add Service'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#svc-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#svc-save').addEventListener('click', async () => {
    const name  = document.getElementById('svc-name').value.trim();
    const catId = document.getElementById('svc-cat').value;
    const price = Number(document.getElementById('svc-price').value);
    const dur   = Number(document.getElementById('svc-dur').value) || 30;

    if (!name)         { toast.error('Service name is required.'); return; }
    if (!price || price < 0) { toast.error('Enter a valid price.'); return; }

    const btn = overlay.querySelector('#svc-save');
    btn.disabled = true;
    try {
      if (isEdit) {
        await db.services.update(service.id, { name, categoryId: catId, price, durationMin: dur });
        const idx = _services.findIndex(s => s.id === service.id);
        if (idx !== -1) _services[idx] = { ..._services[idx], name, categoryId: catId, price, durationMin: dur };
        toast.success('Service updated.');
      } else {
        const id = await db.services.add({ name, categoryId: catId, price, durationMin: dur, status: 'ACTIVE' });
        _services.push({ id, name, categoryId: catId, price, durationMin: dur, status: 'ACTIVE' });
        toast.success('Service added.');
      }
      close();
      _renderGrid();
    } catch {
      toast.error('Failed to save service. Please try again.');
      btn.disabled = false;
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _fmt(n) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
