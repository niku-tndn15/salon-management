/**
 * staff.js — Staff Management (OWNER) + My Performance (STAFF / OWNER self-view)
 * Routes: /staff  →  owner full management + performance reports
 *         /my-performance  →  personal dashboard (STAFF role)
 */

import { registerRoute } from '../router.js';
import db, { createStaffMember, getStaffDirectory, getStaffPerformance, getCommissionRateOnDate, updateStaffStatus } from '../db.js';
import { currentUser } from '../auth.js';
import toast from '../components/toast.js';

registerRoute('/staff',          _renderStaff);
registerRoute('/my-performance', _renderMyPerformance);

// ── Module state (owner views) ─────────────────────────────────────────────────
let _tab          = 'directory';
let _allStaff     = [];
let _reportStaffId = null;
let _reportFrom   = '';
let _reportTo     = '';
let _compFrom     = '';
let _compTo       = '';
let _compInactive = false;
let _compRows     = [];
let _compSort     = { col: 'revenue', dir: 'desc' };

// ── /staff — Owner view ────────────────────────────────────────────────────────
async function _renderStaff() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;
  _allStaff = await getStaffDirectory();
  _tab = 'directory';

  content.innerHTML = `
    <div class="page-tabs" id="staff-tabs" style="margin-bottom:var(--sp-5);">
      <button class="page-tab active" data-tab="directory">Staff Directory</button>
      <button class="page-tab" data-tab="individual">Individual Report</button>
      <button class="page-tab" data-tab="comparative">Comparative Report</button>
    </div>
    <div id="staff-view"></div>
  `;

  document.getElementById('staff-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    _tab = btn.dataset.tab;
    document.querySelectorAll('#staff-tabs .page-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === _tab));
    _renderView();
  });

  _renderView();
}

function _renderView() {
  const v = document.getElementById('staff-view');
  if (!v) return;
  if (_tab === 'directory')   _renderDirectory(v);
  else if (_tab === 'individual')  _renderIndividual(v);
  else _renderComparative(v);
}

// ── Staff Directory ────────────────────────────────────────────────────────────
async function _renderDirectory(container) {
  const rateMap = {};
  for (const s of _allStaff) {
    const rates = await db.commissionRateHistory.where('staffId').equals(s.id).toArray();
    const current = rates.find(r => !r.effectiveTo) ?? rates.sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    rateMap[s.id] = current?.commissionPct ?? 0;
  }

  const active   = _allStaff.filter(s => s.status === 'ACTIVE');
  const inactive = _allStaff.filter(s => s.status !== 'ACTIVE');

  container.innerHTML = `
    <div class="staff-page">
      <div class="table-toolbar">
        <div class="table-toolbar__left">
          <span style="font-size:var(--text-sm);color:var(--clr-text-muted);">
            ${active.length} active · ${inactive.length} inactive
          </span>
        </div>
        <div class="table-toolbar__right">
          <button class="btn btn--primary btn--sm" id="add-staff-btn">
            <i data-lucide="user-plus"></i> Add Staff
          </button>
        </div>
      </div>

      <div class="staff-grid" id="staff-grid">
        ${_allStaff.map(s => _staffCardHTML(s, rateMap[s.id] ?? 0)).join('')}
      </div>
      ${!_allStaff.length ? `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No staff members yet.</p>` : ''}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  document.getElementById('add-staff-btn')?.addEventListener('click', () => _openAddStaffModal());

  document.getElementById('staff-grid')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const s = _allStaff.find(x => String(x.id) === editBtn.dataset.edit);
      if (s) {
        const rates = await db.commissionRateHistory.where('staffId').equals(s.id).toArray();
        _openEditStaffModal(s, rates);
      }
      return;
    }
    const togBtn = e.target.closest('[data-toggle]');
    if (togBtn) {
      const s = _allStaff.find(x => String(x.id) === togBtn.dataset.toggle);
      if (s) _openToggleModal(s);
    }
  });
}

function _staffCardHTML(s, commPct) {
  const isActive = s.status === 'ACTIVE';
  const joined   = s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
  return `
    <div class="staff-card">
      <div class="staff-card__header">
        <div class="staff-card__avatar">${_initials(s.name)}</div>
        <div class="staff-card__info">
          <div class="staff-card__name">${_esc(s.name)}</div>
          <div class="staff-card__designation">${_esc(s.designation ?? '—')}</div>
        </div>
        <span class="badge badge--no-dot ${isActive ? 'badge--active' : 'badge--inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="staff-card__stats">
        <div class="staff-stat">
          <div class="staff-stat__label">Commission</div>
          <div class="staff-stat__value">${commPct}%</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Joined</div>
          <div class="staff-stat__value" style="font-size:var(--text-sm);">${joined}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Phone</div>
          <div class="staff-stat__value" style="font-size:var(--text-sm);">${_esc(s.phone)}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Status</div>
          <div class="staff-stat__value" style="font-size:var(--text-sm);">${isActive ? 'Active' : 'Inactive'}</div>
        </div>
      </div>
      <div class="staff-card__actions">
        <button class="btn btn--sm btn--ghost" data-edit="${s.id}">
          <i data-lucide="pencil"></i> Edit
        </button>
        <button class="btn btn--sm ${isActive ? 'btn--ghost' : 'btn--primary'}" data-toggle="${s.id}"
                style="${isActive ? 'color:var(--clr-danger);border-color:var(--clr-danger);' : ''}">
          ${isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  `;
}

// ── Add Staff Modal ────────────────────────────────────────────────────────────
function _openAddStaffModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">Add Staff Member</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input class="form-input" id="ns-name" type="text" placeholder="e.g. Pooja Rao" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone <span class="required">*</span></label>
          <input class="form-input" id="ns-phone" type="tel" placeholder="10-digit mobile" maxlength="10" />
        </div>
        <div class="form-group">
          <label class="form-label">Designation <span class="required">*</span></label>
          <input class="form-input" id="ns-desig" type="text" placeholder="e.g. Senior Stylist" list="desig-list" />
          <datalist id="desig-list">
            ${['Senior Stylist','Stylist','Nail Technician','Makeup Artist','Trainee','Receptionist'].map(d=>`<option value="${d}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Commission % <span class="required">*</span></label>
          <input class="form-input" id="ns-comm" type="number" min="0" max="100" step="0.01" placeholder="e.g. 10" />
        </div>
        <div class="form-group">
          <label class="form-label">Join Date <span class="required">*</span></label>
          <input class="form-input" id="ns-join" type="date" max="${_today()}" value="${_today()}" />
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="ns-cancel">Cancel</button>
        <button class="btn btn--primary" id="ns-save">Add Staff</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });
  document.getElementById('ns-name')?.focus();

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#ns-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#ns-save').addEventListener('click', async () => {
    const name  = document.getElementById('ns-name').value.trim();
    const phone = document.getElementById('ns-phone').value.trim();
    const desig = document.getElementById('ns-desig').value.trim();
    const comm  = parseFloat(document.getElementById('ns-comm').value);
    const join  = document.getElementById('ns-join').value;

    if (!name)                     { toast.error('Name is required.'); return; }
    if (!/^\d{10}$/.test(phone))   { toast.error('Enter a valid 10-digit phone.'); return; }
    if (!desig)                    { toast.error('Designation is required.'); return; }
    if (isNaN(comm) || comm < 0 || comm > 100) { toast.error('Commission must be 0–100.'); return; }
    if (!join)                     { toast.error('Join date is required.'); return; }
    if (join > _today())           { toast.error('Join date cannot be in the future.'); return; }

    const existing = await db.staff.where('phone').equals(phone).first();
    if (existing)  { toast.error('A staff member with this phone already exists.'); return; }

    const btn = overlay.querySelector('#ns-save');
    btn.disabled = true;

    try {
      const result = await createStaffMember({
        name,
        phone,
        designation: desig,
        commissionPct: comm,
        joinDate: join,
      });
      _allStaff = await getStaffDirectory();
      close();
      _openCredsModal(name, result.credentials.username, result.credentials.temporaryPassword);
      const view = document.getElementById('staff-view');
      if (view) _renderDirectory(view);

    } catch (err) {
      console.error('Failed to add staff member:', err);
      toast.error(err?.message || 'Failed to add staff member.');
      btn.disabled = false;
    }
  });
}

// ── Credentials Modal ──────────────────────────────────────────────────────────
function _openCredsModal(name, username, password) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">Staff Account Created</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <p style="font-size:var(--text-sm);color:var(--clr-text-secondary);margin-bottom:var(--sp-4);">
          Share these credentials with <strong>${_esc(name)}</strong>. The password should be changed after first login.
        </p>
        <div class="form-group">
          <label class="form-label">Username</label>
          <div style="display:flex;gap:var(--sp-2);">
            <input class="form-input" id="cred-user" type="text" value="${_esc(username)}" readonly style="flex:1;background:var(--clr-bg);" />
            <button class="btn btn--ghost btn--sm" data-copy="cred-user"><i data-lucide="copy"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Temporary Password</label>
          <div style="display:flex;gap:var(--sp-2);">
            <input class="form-input" id="cred-pwd" type="text" value="${_esc(password)}" readonly style="flex:1;background:var(--clr-bg);" />
            <button class="btn btn--ghost btn--sm" data-copy="cred-pwd"><i data-lucide="copy"></i></button>
          </div>
        </div>
        <div style="background:hsl(38,90%,94%);border:1px solid hsl(38,70%,80%);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);font-size:var(--text-xs);color:hsl(38,60%,30%);">
          <i data-lucide="alert-triangle" style="width:12px;height:12px;vertical-align:middle;"></i>
          Save these credentials now — the password cannot be retrieved later.
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--primary" id="cred-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => {
    if (!overlay.isConnected) return;
    overlay.remove();
    toast.success('Staff member added successfully.');
  };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#cred-done').addEventListener('click', close);
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.copy);
      if (inp) {
        navigator.clipboard?.writeText(inp.value).then(() => toast.success('Copied!')).catch(() => {
          inp.select(); document.execCommand('copy'); toast.success('Copied!');
        });
      }
    });
  });
}

// ── Edit Staff Modal ───────────────────────────────────────────────────────────
function _openEditStaffModal(staff, rates) {
  const current = rates.find(r => !r.effectiveTo)
    ?? rates.sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const currentPct = current?.commissionPct ?? 0;

  const histHTML = rates
    .sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .map(r => {
      const from  = _fmtDate(r.effectiveFrom);
      const to    = r.effectiveTo ? _fmtDate(r.effectiveTo) : 'Present';
      const isCur = !r.effectiveTo;
      return `
        <div class="rate-row${isCur ? ' rate-row--current' : ''}">
          <div class="rate-row__pct">${r.commissionPct}%</div>
          <div class="rate-row__period">${from} – ${to}</div>
          ${isCur ? `<span class="badge badge--active badge--no-dot" style="font-size:10px;">Current</span>` : ''}
        </div>`;
    }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">Edit Staff — ${_esc(staff.name)}</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input class="form-input" id="es-name" type="text" value="${_esc(staff.name)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" type="tel" value="${_esc(staff.phone)}" readonly
                 style="background:var(--clr-bg);color:var(--clr-text-muted);" />
        </div>
        <div class="form-group">
          <label class="form-label">Designation <span class="required">*</span></label>
          <input class="form-input" id="es-desig" type="text" value="${_esc(staff.designation ?? '')}" list="es-desig-list" />
          <datalist id="es-desig-list">
            ${['Senior Stylist','Stylist','Nail Technician','Makeup Artist','Trainee','Receptionist'].map(d=>`<option value="${d}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Commission %
            <span style="font-size:var(--text-xs);color:var(--clr-text-muted);font-weight:400;margin-left:4px;">
              (current: ${currentPct}%)
            </span>
          </label>
          <input class="form-input" id="es-comm" type="number" min="0" max="100" step="0.01"
                 value="${currentPct}" />
          <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-top:4px;">
            If changed, new rate takes effect from tomorrow.
          </div>
        </div>
        ${rates.length ? `
          <div class="form-group">
            <label class="form-label" style="margin-bottom:var(--sp-2);">Commission Rate History</label>
            <div class="rate-history">${histHTML}</div>
          </div>` : ''}
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="es-cancel">Cancel</button>
        <button class="btn btn--primary" id="es-save">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#es-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#es-save').addEventListener('click', async () => {
    const name  = document.getElementById('es-name').value.trim();
    const desig = document.getElementById('es-desig').value.trim();
    const newPct = parseFloat(document.getElementById('es-comm').value);

    if (!name)                       { toast.error('Name is required.'); return; }
    if (!desig)                      { toast.error('Designation is required.'); return; }
    if (isNaN(newPct) || newPct < 0 || newPct > 100) { toast.error('Commission must be 0–100.'); return; }

    const btn = overlay.querySelector('#es-save');
    btn.disabled = true;

    try {
      await db.staff.update(staff.id, { name, designation: desig, syncStatus: 'PENDING' });

      if (newPct !== currentPct) {
        const today    = _today();
        const tomorrow = _addDays(today, 1);

        if (current) {
          await db.commissionRateHistory.update(current.id, { effectiveTo: today });
        }
        await db.commissionRateHistory.add({
          staffId: staff.id, commissionPct: newPct,
          effectiveFrom: tomorrow, effectiveTo: null,
        });

        toast.success(`Commission updated. New rate (${newPct}%) effective from ${_fmtDate(tomorrow)}.`);
      } else {
        toast.success('Staff details updated.');
      }

      _allStaff = await getStaffDirectory();
      close();
      const view = document.getElementById('staff-view');
      if (view) _renderDirectory(view);

    } catch {
      toast.error('Failed to update staff member.');
      btn.disabled = false;
    }
  });
}

// ── Deactivate / Reactivate Modal ──────────────────────────────────────────────
function _openToggleModal(staff) {
  const isActive  = staff.status === 'ACTIVE';
  const action    = isActive ? 'Deactivate' : 'Reactivate';
  const overlay   = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">${action} ${_esc(staff.name)}?</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <p style="font-size:var(--text-sm);color:var(--clr-text-secondary);">
          ${isActive
            ? `${_esc(staff.name)} will be removed from the billing staff dropdown and will no longer be able to log in.`
            : `${_esc(staff.name)} will be reactivated and can log in again.`}
        </p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="tog-cancel">Cancel</button>
        <button class="btn btn--primary" id="tog-confirm"
                style="${isActive ? 'background:var(--clr-danger);border-color:var(--clr-danger);' : ''}">
          ${action}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#tog-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#tog-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#tog-confirm');
    btn.disabled = true;
    try {
      const newStatus = isActive ? 'INACTIVE' : 'ACTIVE';
      const payload = isActive
        ? { deactivation_date: _today(), deactivation_reason: 'Deactivated from staff directory' }
        : {};
      await updateStaffStatus(staff.id, newStatus, payload);

      _allStaff = await getStaffDirectory();
      toast.success(`${staff.name} ${newStatus === 'ACTIVE' ? 'reactivated' : 'deactivated'}.`);
      close();
      const view = document.getElementById('staff-view');
      if (view) _renderDirectory(view);
    } catch {
      toast.error('Failed to update status.');
      btn.disabled = false;
    }
  });
}

// ── Individual Performance Report ──────────────────────────────────────────────
function _renderIndividual(container) {
  const defaultFrom = _addDays(_today(), -30);
  const defaultTo   = _today();
  if (!_reportStaffId && _allStaff.length) _reportStaffId = _allStaff[0].id;
  if (!_reportFrom) _reportFrom = defaultFrom;
  if (!_reportTo)   _reportTo   = defaultTo;

  const staffOpts = _allStaff.map(s =>
    `<option value="${s.id}"${String(_reportStaffId)===String(s.id)?' selected':''}>${_esc(s.name)} (${_esc(s.designation??'')})</option>`
  ).join('');

  container.innerHTML = `
    <div class="section-card">
      <div class="section-card__header">
        <div class="section-card__title">Individual Performance Report</div>
      </div>
      <div class="section-card__body">
        <div class="performance-header">
          <div class="form-group" style="margin:0;flex:1;max-width:260px;">
            <label class="form-label">Staff Member</label>
            <select class="form-select" id="ind-staff">${staffOpts}</select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">From</label>
            <input class="form-input" id="ind-from" type="date" value="${_reportFrom}" max="${_today()}" style="width:140px;" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">To</label>
            <input class="form-input" id="ind-to" type="date" value="${_reportTo}" max="${_today()}" style="width:140px;" />
          </div>
          <div class="form-group" style="margin:0;align-self:flex-end;">
            <button class="btn btn--primary" id="ind-gen">Generate Report</button>
          </div>
        </div>
        <div id="ind-results" style="margin-top:var(--sp-5);"></div>
      </div>
    </div>
  `;

  document.getElementById('ind-gen')?.addEventListener('click', async () => {
    _reportStaffId = document.getElementById('ind-staff').value;
    _reportFrom    = document.getElementById('ind-from').value;
    _reportTo      = document.getElementById('ind-to').value;

    if (!_reportFrom || !_reportTo)        { toast.error('Select a date range.'); return; }
    if (_reportFrom > _reportTo)           { toast.error('Start date must be before end date.'); return; }

    const btn = document.getElementById('ind-gen');
    btn.disabled = true; btn.textContent = 'Generating…';

    try {
      await _showIndividualResults(_reportStaffId, _reportFrom, _reportTo);
    } finally {
      btn.disabled = false; btn.textContent = 'Generate Report';
    }
  });

  // Auto-generate on load if we have a staff member
  if (_reportStaffId) _showIndividualResults(_reportStaffId, _reportFrom, _reportTo);
}

async function _showIndividualResults(staffId, from, to) {
  const resultsEl = document.getElementById('ind-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = `<div class="skeleton" style="height:200px;border-radius:var(--radius-md);"></div>`;

  const staff = _allStaff.find(s => String(s.id) === String(staffId));
  if (!staff) { resultsEl.innerHTML = `<p style="color:var(--clr-text-muted);">Staff member not found.</p>`; return; }

  let lineItems = [], totalRevenue = 0, totalCommission = 0, serviceCount = 0;
  try {
    ({ lineItems, totalRevenue, totalCommission, serviceCount } = await getStaffPerformance(staffId, from, to));
  } catch (err) {
    console.error('Failed to load staff performance:', err);
    resultsEl.innerHTML = `<p style="color:var(--clr-danger);font-size:var(--text-sm);">Failed to load performance for this staff member. Please try again.</p>`;
    return;
  }

  const days    = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86_400_000) + 1);
  const avgPerDay = (serviceCount / days).toFixed(1);

  // Commission rate segments during this period
  const rates = await db.commissionRateHistory.where('staffId').equals(staffId).toArray();
  const fallbackRate = rates.length ? null : await getCommissionRateOnDate(staffId, to);
  const segments = rates.length ? rates
    .filter(r => r.effectiveFrom <= to && (!r.effectiveTo || r.effectiveTo >= from))
    .sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    : [{ commissionPct: fallbackRate, effectiveFrom: from, effectiveTo: null }];

  const segmentHTML = segments.length > 1
    ? `<div style="margin-top:var(--sp-4);">
        <div style="font-size:var(--text-xs);font-weight:600;color:var(--clr-text-secondary);margin-bottom:var(--sp-2);text-transform:uppercase;letter-spacing:.5px;">Commission Rate Segments</div>
        ${segments.map(r => {
          const segFrom  = r.effectiveFrom > from ? r.effectiveFrom : from;
          const segTo    = (!r.effectiveTo || r.effectiveTo > to) ? to : r.effectiveTo;
          const segItems = lineItems.filter(li => {
            const d = li.invoice.invoiceDate.split('T')[0];
            return d >= segFrom && d <= segTo;
          });
          const segComm = segItems.reduce((s,li) => s + li.commission, 0);
          return `<div class="rate-row">
            <div class="rate-row__pct">${r.commissionPct}%</div>
            <div class="rate-row__period">${_fmtDate(segFrom)} – ${_fmtDate(segTo)}</div>
            <div style="font-weight:600;">${_fmt(segComm)}</div>
          </div>`;
        }).join('')}
      </div>`
    : '';

  const tableRows = lineItems
    .sort((a,b) => a.invoice.invoiceDate.localeCompare(b.invoice.invoiceDate))
    .map(li => `
      <tr>
        <td>${_fmtDate(li.invoice.invoiceDate.split('T')[0])}</td>
        <td>${_esc(li.serviceNameSnap)}</td>
        <td>${_esc(li.professionalNameSnap)}</td>
        <td style="font-weight:500;">${_fmt(li.revenue)}</td>
        <td>${li.commissionPctSnap}%</td>
        <td style="color:var(--clr-primary);font-weight:600;">${_fmt(li.commission)}</td>
      </tr>`).join('');

  resultsEl.innerHTML = `
    <div class="performance-report">
      <div style="font-size:var(--text-md);font-weight:600;color:var(--clr-text-primary);">
        ${_esc(staff.name)} — ${_esc(staff.designation ?? '')}
        <span style="font-size:var(--text-sm);font-weight:400;color:var(--clr-text-muted);margin-left:8px;">
          ${_fmtDate(from)} – ${_fmtDate(to)}
        </span>
      </div>
      <div class="performance-summary">
        <div class="staff-stat">
          <div class="staff-stat__label">Total Services</div>
          <div class="staff-stat__value">${serviceCount}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Total Revenue</div>
          <div class="staff-stat__value">${_fmt(totalRevenue)}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Commission Earned</div>
          <div class="staff-stat__value" style="color:var(--clr-primary);">${_fmt(totalCommission)}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Avg Services/Day</div>
          <div class="staff-stat__value">${avgPerDay}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Avg Revenue/Service</div>
          <div class="staff-stat__value">${serviceCount ? _fmt(totalRevenue / serviceCount) : '—'}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Commission Rate</div>
          <div class="staff-stat__value">${segments.length === 1 ? segments[0].commissionPct + '%' : 'Multiple'}</div>
        </div>
      </div>
      ${segmentHTML}
      ${lineItems.length ? `
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>Date</th><th>Service</th><th>By</th><th>Amount</th><th>Rate</th><th>Commission</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>` : `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No services found in this period.</p>`}
    </div>
  `;
}

// ── Comparative Report ─────────────────────────────────────────────────────────
function _renderComparative(container) {
  if (!_compFrom) _compFrom = _addDays(_today(), -30);
  if (!_compTo)   _compTo   = _today();

  container.innerHTML = `
    <div class="section-card">
      <div class="section-card__header">
        <div class="section-card__title">Comparative Staff Report</div>
      </div>
      <div class="section-card__body">
        <div class="performance-header">
          <div class="form-group" style="margin:0;">
            <label class="form-label">From</label>
            <input class="form-input" id="cmp-from" type="date" value="${_compFrom}" max="${_today()}" style="width:140px;" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">To</label>
            <input class="form-input" id="cmp-to" type="date" value="${_compTo}" max="${_today()}" style="width:140px;" />
          </div>
          <div class="form-group" style="margin:0;align-self:flex-end;">
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;font-size:var(--text-sm);color:var(--clr-text-secondary);font-weight:400;">
              <input type="checkbox" id="cmp-inactive" ${_compInactive?'checked':''} /> Include Inactive
            </label>
          </div>
          <div class="form-group" style="margin:0;align-self:flex-end;">
            <button class="btn btn--primary" id="cmp-gen">Generate Report</button>
          </div>
        </div>
        <div id="cmp-results" style="margin-top:var(--sp-5);"></div>
      </div>
    </div>
  `;

  document.getElementById('cmp-gen')?.addEventListener('click', async () => {
    _compFrom     = document.getElementById('cmp-from').value;
    _compTo       = document.getElementById('cmp-to').value;
    _compInactive = document.getElementById('cmp-inactive').checked;

    if (!_compFrom || !_compTo)  { toast.error('Select a date range.'); return; }
    if (_compFrom > _compTo)     { toast.error('Start date must be before end date.'); return; }

    const btn = document.getElementById('cmp-gen');
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      await _showComparativeResults();
    } finally {
      btn.disabled = false; btn.textContent = 'Generate Report';
    }
  });
}

async function _showComparativeResults() {
  const resultsEl = document.getElementById('cmp-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div class="skeleton" style="height:200px;border-radius:var(--radius-md);"></div>`;

  const staffList = _compInactive ? _allStaff : _allStaff.filter(s => s.status === 'ACTIVE');

  const rows = await Promise.all(staffList.map(async s => {
    try {
      const perf = await getStaffPerformance(s.id, _compFrom, _compTo);
      const rates = await db.commissionRateHistory.where('staffId').equals(s.id).toArray();
      const curr = rates.find(r => !r.effectiveTo)?.commissionPct
        ?? await getCommissionRateOnDate(s.id, _compTo)
        ?? s.commissionPct
        ?? 0;
      return { ...s, ...perf, currentRate: curr };
    } catch (err) {
      console.error('Failed to load comparative staff row:', s, err);
      return { ...s, lineItems: [], totalRevenue: 0, totalCommission: 0, serviceCount: 0, currentRate: s.commissionPct ?? 0, loadError: true };
    }
  }));

  _compRows = rows;

  _renderCompTable(resultsEl);
}

function _renderCompTable(resultsEl) {
  if (!_compRows.length) {
    resultsEl.innerHTML = `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No staff found.</p>`;
    return;
  }

  const sorted = [..._compRows].sort((a, b) => {
    const av = a[_compSort.col === 'revenue' ? 'totalRevenue' : _compSort.col === 'commission' ? 'totalCommission' : _compSort.col === 'services' ? 'serviceCount' : 'totalRevenue'];
    const bv = b[_compSort.col === 'revenue' ? 'totalRevenue' : _compSort.col === 'commission' ? 'totalCommission' : _compSort.col === 'services' ? 'serviceCount' : 'totalRevenue'];
    return _compSort.dir === 'desc' ? bv - av : av - bv;
  });

  const minRevenue = Math.min(...sorted.map(r => r.totalRevenue));
  const sortIcon   = col => {
    if (_compSort.col !== col) return '';
    return _compSort.dir === 'desc' ? ' ↓' : ' ↑';
  };
  const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap;';

  const rows = sorted.map(r => {
    const isBottom = r.serviceCount > 0 && r.totalRevenue === minRevenue && sorted.filter(x => x.serviceCount > 0).length > 1;
    return `<tr${isBottom ? ' style="background:hsl(0,90%,97%);"' : ''}>
      <td>${_esc(r.name)}${isBottom ? ' <span title="Bottom performer" style="color:var(--clr-danger);">↓</span>' : ''}</td>
      <td>${_esc(r.designation ?? '—')}</td>
      <td style="text-align:right;">${r.serviceCount}</td>
      <td style="text-align:right;font-weight:600;">${_fmt(r.totalRevenue)}</td>
      <td style="text-align:right;">${r.currentRate}%</td>
      <td style="text-align:right;color:var(--clr-primary);font-weight:600;">${_fmt(r.totalCommission)}</td>
      <td><span class="badge badge--no-dot ${r.status==='ACTIVE'?'badge--active':'badge--inactive'}">${r.status==='ACTIVE'?'Active':'Inactive'}</span></td>
    </tr>`;
  }).join('');

  const mkTh = (col, label, align = 'left') =>
    `<th data-sort="${col}" style="${thStyle}text-align:${align};">${label}${sortIcon(col)}</th>`;

  resultsEl.innerHTML = `
    <div class="table-wrapper">
      <table class="table" id="cmp-table">
        <thead><tr>
          ${mkTh('name','Name')}
          ${mkTh('designation','Designation')}
          ${mkTh('services','Services','right')}
          ${mkTh('revenue','Revenue','right')}
          <th style="text-align:right;">Rate</th>
          ${mkTh('commission','Commission','right')}
          <th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  document.getElementById('cmp-table')?.querySelector('thead')?.addEventListener('click', e => {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    const col = th.dataset.sort;
    if (_compSort.col === col) {
      _compSort.dir = _compSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      _compSort = { col, dir: 'desc' };
    }
    _renderCompTable(resultsEl);
  });
}

// ── /my-performance — Staff self-view ─────────────────────────────────────────
async function _renderMyPerformance() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;

  const sessionUser = currentUser();
  if (!sessionUser) return;

  // Resolve staff record: check staffId field on user record, fallback to name match
  const userRecord = await db.users.get(sessionUser.id);
  let staffRecord = null;
  if (userRecord?.staffId) {
    staffRecord = await db.staff.get(userRecord.staffId);
  }
  if (!staffRecord) {
    staffRecord = await db.staff.filter(s => s.name === sessionUser.name).first();
  }

  if (!staffRecord) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="user-x"></i>
        <p class="empty-state__title">Staff profile not found</p>
        <p class="empty-state__desc">Your account is not linked to a staff record. Contact the owner.</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Get current commission rate
  const rates   = await db.commissionRateHistory.where('staffId').equals(staffRecord.id).toArray();
  const current = rates.find(r => !r.effectiveTo)
    ?? rates.sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const commPct = current?.commissionPct ?? 0;

  content.innerHTML = `
    <div class="my-performance-page">
      <div class="my-performance-hero">
        <div class="my-performance-hero__avatar">${_initials(staffRecord.name)}</div>
        <div>
          <div class="my-performance-hero__name">${_esc(staffRecord.name)}</div>
          <div class="my-performance-hero__title">${_esc(staffRecord.designation ?? '')} · Commission: ${commPct}%</div>
        </div>
      </div>

      <div class="page-tabs" id="perf-tabs">
        <button class="page-tab active" data-period="today">Today</button>
        <button class="page-tab" data-period="month">This Month</button>
        <button class="page-tab" data-period="custom">Custom Range</button>
      </div>

      <div id="perf-custom" style="display:none;padding:var(--sp-4) 0;">
        <div style="display:flex;gap:var(--sp-3);align-items:flex-end;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">From</label>
            <input class="form-input" id="perf-from" type="date" value="${_addDays(_today(),-30)}" max="${_today()}" style="width:140px;" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">To</label>
            <input class="form-input" id="perf-to" type="date" value="${_today()}" max="${_today()}" style="width:140px;" />
          </div>
          <button class="btn btn--primary" id="perf-apply">Apply</button>
        </div>
      </div>

      <div id="perf-results"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [content] });

  let _period = 'today';
  const loadPeriod = async () => {
    let from, to;
    const today = _today();
    if (_period === 'today') {
      from = today; to = today;
    } else if (_period === 'month') {
      from = today.slice(0,7) + '-01'; to = today;
    } else {
      from = document.getElementById('perf-from')?.value ?? _addDays(today,-30);
      to   = document.getElementById('perf-to')?.value ?? today;
      if (from > to) { toast.error('Start date must be before end date.'); return; }
    }
    await _showMyPerformance(staffRecord, commPct, from, to);
  };

  document.getElementById('perf-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    _period = btn.dataset.period;
    document.querySelectorAll('#perf-tabs .page-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.period === _period));
    const customDiv = document.getElementById('perf-custom');
    if (customDiv) customDiv.style.display = _period === 'custom' ? '' : 'none';
    if (_period !== 'custom') loadPeriod();
  });

  document.getElementById('perf-apply')?.addEventListener('click', loadPeriod);

  await loadPeriod();
}

async function _showMyPerformance(staff, commPct, from, to) {
  const resultsEl = document.getElementById('perf-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div class="skeleton" style="height:200px;border-radius:var(--radius-md);margin-top:var(--sp-4);"></div>`;

  const { lineItems, totalRevenue, totalCommission, serviceCount } = await getStaffPerformance(staff.id, from, to);

  const tableRows = lineItems
    .sort((a,b) => a.invoice.invoiceDate.localeCompare(b.invoice.invoiceDate))
    .map(li => `
      <tr>
        <td>${_fmtDate(li.invoice.invoiceDate.split('T')[0])}</td>
        <td>${_esc(li.serviceNameSnap)}</td>
        <td style="font-weight:500;">${_fmt(li.revenue)}</td>
        <td style="color:var(--clr-primary);font-weight:600;">${_fmt(li.commission)}</td>
      </tr>`).join('');

  resultsEl.innerHTML = `
    <div class="performance-report" style="margin-top:var(--sp-4);">
      <div class="performance-summary">
        <div class="staff-stat">
          <div class="staff-stat__label">Services Performed</div>
          <div class="staff-stat__value">${serviceCount}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Revenue Generated</div>
          <div class="staff-stat__value">${_fmt(totalRevenue)}</div>
        </div>
        <div class="staff-stat">
          <div class="staff-stat__label">Commission Earned</div>
          <div class="staff-stat__value" style="color:var(--clr-primary);">${_fmt(totalCommission)}</div>
        </div>
      </div>

      ${lineItems.length ? `
        <div class="table-wrapper">
          <table class="table">
            <thead><tr>
              <th>Date</th><th>Service</th><th>Amount</th><th>Commission (${commPct}%)</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
            <tfoot><tr style="font-weight:700;border-top:2px solid var(--clr-border);">
              <td colspan="2">Total</td>
              <td>${_fmt(totalRevenue)}</td>
              <td style="color:var(--clr-primary);">${_fmt(totalCommission)}</td>
            </tfoot>
          </table>
        </div>` :
        `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No services in this period.</p>`}
    </div>
  `;
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function _fmt(n) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _initials(name) {
  return String(name ?? '').trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function _today() {
  return new Date().toISOString().split('T')[0];
}

function _addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function _fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
