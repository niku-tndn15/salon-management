/**
 * customers.js — Customer Management page.
 * Tabs: All Customers | Lapsed | Upcoming Birthdays
 */

import { registerRoute } from '../router.js';
import db, {
  findCustomerByPhone,
  getActiveCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerWithStats,
  getLapsedCustomers,
  getUpcomingBirthdays,
  getInvoicesByCustomer,
} from '../db.js';
import { hasRole } from '../auth.js';
import toast from '../components/toast.js';

registerRoute('/customers', _renderCustomers);

const BIRTHDAY_DAYS_AHEAD = 10;

let _activeTab    = 'all';
let _allCustomers = [];

// ── Page render ───────────────────────────────────────────────────────────────

async function _renderCustomers() {
  const content = document.getElementById('page-content');
  if (!content) return;

  _activeTab    = 'all';
  _allCustomers = await getActiveCustomers();

  content.innerHTML = `
    <div class="customers-page">
      <div class="page-tabs" id="cust-tabs">
        <button class="page-tab active" data-tab="all">
          All Customers
          <span class="page-tab__count">${_allCustomers.length}</span>
        </button>
        <button class="page-tab" data-tab="lapsed">
          Lapsed
          <span class="page-tab__count" id="lapsed-count">—</span>
        </button>
        <button class="page-tab" data-tab="birthdays">
          Upcoming Birthdays
          <span class="page-tab__count" id="bday-count">—</span>
        </button>
      </div>
      <div id="tab-content"></div>
    </div>
  `;

  // Pre-load tab counts asynchronously (non-blocking)
  Promise.all([getLapsedCustomers(45), getUpcomingBirthdays(BIRTHDAY_DAYS_AHEAD)]).then(([lapsed, bdays]) => {
    const lc = document.getElementById('lapsed-count');
    const bc = document.getElementById('bday-count');
    if (lc) lc.textContent = lapsed.length;
    if (bc) bc.textContent = bdays.length;
  });

  document.getElementById('cust-tabs')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn || btn.dataset.tab === _activeTab) return;
    _activeTab = btn.dataset.tab;
    document.querySelectorAll('.page-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === _activeTab)
    );
    await _renderTab();
  });

  await _renderTab();
}

async function _renderTab() {
  const container = document.getElementById('tab-content');
  if (!container) return;
  container.innerHTML = `<div class="skeleton" style="height:240px;border-radius:var(--radius-lg);margin-top:var(--sp-5);"></div>`;
  if (_activeTab === 'all')         await _renderAllTab(container);
  else if (_activeTab === 'lapsed') await _renderLapsedTab(container);
  else                              await _renderBirthdaysTab(container);
}

// ── All Customers tab ─────────────────────────────────────────────────────────

async function _renderAllTab(container) {
  _allCustomers = await getActiveCustomers();

  // Keep tab count in sync
  const allCount = document.querySelector('[data-tab="all"] .page-tab__count');
  if (allCount) allCount.textContent = _allCustomers.length;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--sp-5);padding-top:var(--sp-5);">
      <div class="table-toolbar">
        <div class="table-toolbar__left">
          <div class="search-input-wrapper">
            <span class="input-icon"><i data-lucide="search"></i></span>
            <input class="form-input" id="cust-search" type="search"
                   placeholder="Search by name or phone…" style="width:280px;" />
          </div>
        </div>
        <div class="table-toolbar__right">
          <button class="btn btn--primary btn--sm" id="add-cust-btn">
            <i data-lucide="user-plus"></i> Add Customer
          </button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="cust-tbody">
            ${_buildCustomerRows(_allCustomers)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });

  // Live search — only replaces tbody innerHTML, listener on tbody persists
  document.getElementById('cust-search')?.addEventListener('input', e => {
    const q        = e.target.value.trim().toLowerCase();
    const filtered = q
      ? _allCustomers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      : _allCustomers;
    const tbody = document.getElementById('cust-tbody');
    if (tbody) {
      tbody.innerHTML = _buildCustomerRows(filtered);
      if (window.lucide) window.lucide.createIcons({ nodes: [tbody] });
    }
  });

  // Row click → profile (delegation on tbody, persists through search replaces).
  // Edit/Delete action buttons are handled first and stop the row navigation.
  document.getElementById('cust-tbody')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('[data-cust-edit]');
    if (editBtn) {
      const cust = _allCustomers.find(c => String(c.id) === editBtn.dataset.custEdit);
      if (cust) _openEditCustomerModal(container, cust);
      return;
    }
    const delBtn = e.target.closest('[data-cust-delete]');
    if (delBtn) {
      const cust = _allCustomers.find(c => String(c.id) === delBtn.dataset.custDelete);
      if (cust) await _confirmDeleteCustomer(container, cust);
      return;
    }
    const row = e.target.closest('[data-cust-id]');
    if (row) await _renderProfile(container, row.dataset.custId);
  });

  document.getElementById('add-cust-btn')?.addEventListener('click', () =>
    _openAddCustomerModal(container)
  );
}

function _buildCustomerRows(customers) {
  if (!customers.length) {
    return `<tr><td colspan="5" style="text-align:center;color:var(--clr-text-muted);padding:var(--sp-8);">No customers found.</td></tr>`;
  }
  const canDelete = hasRole('OWNER');
  return customers.map(c => `
    <tr style="cursor:pointer;" data-cust-id="${c.id}">
      <td>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--clr-primary);color:#fff;
               display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);
               font-weight:700;flex-shrink:0;text-transform:uppercase;">${_initials(c.name)}</div>
          <span style="font-weight:var(--font-medium);">${_esc(c.name)}</span>
        </div>
      </td>
      <td class="col-mono">${_esc(c.phone)}</td>
      <td>${_esc(c.gender ?? '—')}</td>
      <td>${_esc(c.referralSource ?? '—')}</td>
      <td>
        <div style="display:flex;gap:var(--sp-2);">
          <button class="btn btn--ghost btn--sm" data-cust-edit="${c.id}">
            <i data-lucide="pencil"></i> Edit
          </button>
          ${canDelete ? `<button class="btn btn--ghost btn--sm" data-cust-delete="${c.id}"
                  style="color:var(--clr-danger);border-color:var(--clr-danger);">
            <i data-lucide="trash-2"></i> Delete
          </button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Customer profile view ─────────────────────────────────────────────────────

async function _renderProfile(container, custId) {
  container.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);margin-top:var(--sp-5);"></div>`;

  const [stats, invoices] = await Promise.all([
    getCustomerWithStats(custId),
    getInvoicesByCustomer(custId),
  ]);

  if (!stats) {
    container.innerHTML = `<p style="color:var(--clr-text-muted);margin-top:var(--sp-5);">Customer not found.</p>`;
    return;
  }

  // Enrich each invoice with service names from line items
  const visits = await Promise.all(invoices.map(async inv => {
    const items = await db.invoiceLineItems.where('invoiceId').equals(inv.id).toArray();
    return { ...inv, serviceNames: items.map(i => i.serviceNameSnap).join(', ') };
  }));

  const lastVisitStr = stats.lastVisit
    ? new Date(stats.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  container.innerHTML = `
    <div style="padding-top:var(--sp-5);">
      <button class="btn btn--ghost btn--sm" id="back-to-list" style="margin-bottom:var(--sp-4);">
        <i data-lucide="arrow-left"></i> Back to Customers
      </button>

      <div class="customer-profile-layout">

        <!-- Left: profile card -->
        <div class="section-card customer-profile-card">
          <div class="customer-profile-card__avatar">${_initials(stats.name)}</div>
          <div>
            <div class="customer-profile-card__name">${_esc(stats.name)}</div>
            <div class="customer-profile-card__phone">${_esc(stats.phone)}</div>
          </div>

          <div class="customer-stats-grid">
            <div class="customer-stat">
              <div class="customer-stat__value">${_fmt(stats.totalSpend)}</div>
              <div class="customer-stat__label">Total Spent</div>
            </div>
            <div class="customer-stat">
              <div class="customer-stat__value">${stats.visitCount}</div>
              <div class="customer-stat__label">Visits</div>
            </div>
            <div class="customer-stat">
              <div class="customer-stat__value">${_fmt(stats.avgSpend)}</div>
              <div class="customer-stat__label">Avg / Visit</div>
            </div>
            <div class="customer-stat">
              <div class="customer-stat__value" style="font-size:var(--text-md);">${lastVisitStr}</div>
              <div class="customer-stat__label">Last Visit</div>
            </div>
          </div>

          <div style="width:100%;text-align:left;font-size:var(--text-sm);
               display:flex;flex-direction:column;gap:var(--sp-2);">
            <div><span style="color:var(--clr-text-muted);">Gender:</span> ${_esc(stats.gender ?? '—')}</div>
            <div><span style="color:var(--clr-text-muted);">DOB:</span> ${stats.dateOfBirth ? _esc(stats.dateOfBirth) : '—'}</div>
            <div><span style="color:var(--clr-text-muted);">Source:</span> ${_esc(stats.referralSource ?? '—')}</div>
            ${stats.notes ? `<div><span style="color:var(--clr-text-muted);">Notes:</span> ${_esc(stats.notes)}</div>` : ''}
          </div>
        </div>

        <!-- Right: visit history -->
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__title">Visit History</div>
            <div class="section-card__meta">${visits.length} visit${visits.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="section-card__body">
            ${visits.length ? `
              <div class="visit-history">
                ${visits.map(v => {
                  const pmBadge     = `<span class="badge badge--${(v.paymentMethod ?? 'cash').toLowerCase()} badge--no-dot">${_esc(v.paymentMethod ?? '')}</span>`;
                  const statusBadge = v.status === 'REFUNDED'
                    ? `<span class="badge badge--refunded badge--no-dot" style="margin-left:4px;">Refunded</span>`
                    : v.status === 'PARTIALLY_REFUNDED'
                    ? `<span class="badge badge--partially-refunded badge--no-dot" style="margin-left:4px;">Partial Refund</span>`
                    : '';
                  return `
                    <div class="visit-card">
                      <div class="visit-card__date">
                        ${new Date(v.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div class="visit-card__body">
                        <div class="visit-card__services">${_esc(v.serviceNames)}</div>
                        <div class="visit-card__meta">
                          ${_esc(v.invoiceNumber)} · ${pmBadge}${statusBadge}
                        </div>
                      </div>
                      <div class="visit-card__amount">${_fmt(v.grandTotal)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `<p style="font-size:var(--text-sm);color:var(--clr-text-muted);">No visits recorded yet.</p>`}
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('back-to-list')?.addEventListener('click', () => _renderAllTab(container));
  if (window.lucide) window.lucide.createIcons({ nodes: [container] });
}

// ── Lapsed Customers tab ──────────────────────────────────────────────────────

async function _renderLapsedTab(container) {
  const lapsed = await getLapsedCustomers(45);

  const lc = document.getElementById('lapsed-count');
  if (lc) lc.textContent = lapsed.length;

  container.innerHTML = `<div style="padding-top:var(--sp-5);">${
    lapsed.length
      ? `<div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Last Visit</th>
                <th>Days Since Visit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${lapsed.map(c => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:var(--sp-3);">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--clr-primary);color:#fff;
                           display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);
                           font-weight:700;flex-shrink:0;text-transform:uppercase;">${_initials(c.name)}</div>
                      <span style="font-weight:var(--font-medium);">${_esc(c.name)}</span>
                    </div>
                  </td>
                  <td class="col-mono">${_esc(c.phone)}</td>
                  <td>${new Date(c.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td><span class="badge badge--lapsed badge--no-dot">${c.daysSince} days</span></td>
                  <td>
                    <button class="lapsed-row__whatsapp"
                            data-phone="${_esc(c.phone)}" data-name="${_esc(c.name)}">
                      <i data-lucide="message-circle"></i> WhatsApp
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : `<div class="empty-state">
          <i data-lucide="check-circle"></i>
          <p class="empty-state__title">No lapsed customers</p>
          <p class="empty-state__desc">Everyone's been visiting regularly — great retention!</p>
        </div>`
  }</div>`;

  // WhatsApp click delegation on freshly-created tbody (no accumulation)
  container.querySelector('tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-phone][data-name]');
    if (!btn) return;
    const phone = btn.dataset.phone.replace(/\D/g, '');
    const name  = btn.dataset.name;
    const msg   = encodeURIComponent(
      `Hi ${name}! We miss you at our salon. It's been a while since your last visit — book your appointment today! 💇`
    );
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank', 'noopener');
  });

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });
}

// ── Upcoming Birthdays tab ────────────────────────────────────────────────────

async function _renderBirthdaysTab(container) {
  const bdays = await getUpcomingBirthdays(BIRTHDAY_DAYS_AHEAD);

  const bc = document.getElementById('bday-count');
  if (bc) bc.textContent = bdays.length;

  container.innerHTML = `<div style="padding-top:var(--sp-5);">${
    bdays.length
      ? `<div class="section-card">
          <div class="section-card__header">
            <div class="section-card__title">Upcoming Birthdays</div>
            <div class="section-card__meta">Next ${BIRTHDAY_DAYS_AHEAD} days</div>
          </div>
          <div class="section-card__body">
            ${bdays.map(c => {
              const label = c.daysUntilBirthday === 0
                ? `<span class="badge badge--birthday">Today!</span>`
                : `In ${c.daysUntilBirthday} day${c.daysUntilBirthday !== 1 ? 's' : ''}`;
              return `
                <div class="birthday-row">
                  <div class="birthday-avatar">${_initials(c.name)}</div>
                  <div class="birthday-row__info">
                    <div class="birthday-row__name">${_esc(c.name)}</div>
                    <div class="birthday-row__date">${label}</div>
                  </div>
                  <span class="birthday-row__phone">${_esc(c.phone)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>`
      : `<div class="empty-state">
          <i data-lucide="cake"></i>
          <p class="empty-state__title">No upcoming birthdays</p>
          <p class="empty-state__desc">No customers have birthdays in the next ${BIRTHDAY_DAYS_AHEAD} days.</p>
        </div>`
  }</div>`;

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });
}

// ── Add Customer modal ────────────────────────────────────────────────────────

function _openAddCustomerModal(container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <div class="modal__title">Add Customer</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input class="form-input" id="nc-name" type="text" placeholder="e.g. Priya Sharma" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone <span class="required">*</span></label>
            <input class="form-input" id="nc-phone" type="tel" maxlength="10"
                   placeholder="10-digit mobile number" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-select" id="nc-gender">
              <option value="">Select…</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth</label>
            <input class="form-input" id="nc-dob" type="date" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Referral Source</label>
          <select class="form-select" id="nc-ref">
            <option value="">Select…</option>
            <option>Walk-in</option>
            <option>Friend Referral</option>
            <option>Instagram</option>
            <option>Google</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" id="nc-notes"
                    placeholder="Any preferences or special notes…"></textarea>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="nc-cancel">Cancel</button>
        <button class="btn btn--primary" id="nc-save">Add Customer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#nc-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#nc-save').addEventListener('click', async () => {
    const name  = document.getElementById('nc-name').value.trim();
    const phone = document.getElementById('nc-phone').value.trim();

    if (!name)                   { toast.error('Name is required.'); return; }
    if (!/^\d{10}$/.test(phone)) { toast.error('Enter a valid 10-digit phone number.'); return; }

    const existing = await findCustomerByPhone(phone);
    if (existing) { toast.error('A customer with this phone number already exists.'); return; }

    const saveBtn = overlay.querySelector('#nc-save');
    saveBtn.disabled = true;

    try {
      await createCustomer({
        name,
        phone,
        gender:         document.getElementById('nc-gender').value || null,
        dateOfBirth:    document.getElementById('nc-dob').value    || null,
        referralSource: document.getElementById('nc-ref').value    || null,
        notes:          document.getElementById('nc-notes').value.trim() || null,
      });
      toast.success('Customer added successfully.');
      close();
      await _renderAllTab(container);
    } catch (err) {
      console.error('Failed to add customer:', err);
      toast.error(err?.message || 'Failed to add customer. Please try again.');
      saveBtn.disabled = false;
    }
  });
}

// ── Edit Customer modal ───────────────────────────────────────────────────────

function _openEditCustomerModal(container, customer) {
  const genderOpt = ['Female', 'Male', 'Other', 'Prefer not to say']
    .map(g => `<option${customer.gender === g ? ' selected' : ''}>${g}</option>`).join('');
  const refOpt = ['Walk-in', 'Friend Referral', 'Instagram', 'Google', 'Facebook', 'Other']
    .map(r => `<option${customer.referralSource === r ? ' selected' : ''}>${r}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <div class="modal__title">Edit Customer</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <input class="form-input" id="ec-name" type="text" value="${_escAttr(customer.name)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" id="ec-phone" type="tel" value="${_escAttr(customer.phone)}" readonly
                   style="background:var(--clr-bg);color:var(--clr-text-muted);" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-select" id="ec-gender">
              <option value="">Select…</option>
              ${genderOpt}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date of Birth</label>
            <input class="form-input" id="ec-dob" type="date" value="${_escAttr(customer.dateOfBirth ?? '')}" max="${_todayStr()}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Referral Source</label>
          <select class="form-select" id="ec-ref">
            <option value="">Select…</option>
            ${refOpt}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" id="ec-notes">${_esc(customer.notes ?? '')}</textarea>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="ec-cancel">Cancel</button>
        <button class="btn btn--primary" id="ec-save">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#ec-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _escKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _escKey); }
  });

  overlay.querySelector('#ec-save').addEventListener('click', async () => {
    const name = document.getElementById('ec-name').value.trim();
    if (!name) { toast.error('Name is required.'); return; }

    const saveBtn = overlay.querySelector('#ec-save');
    saveBtn.disabled = true;
    try {
      await updateCustomer(customer.id, {
        name,
        phone:          customer.phone,
        gender:         document.getElementById('ec-gender').value || null,
        dateOfBirth:    document.getElementById('ec-dob').value    || customer.dateOfBirth || null,
        referralSource: document.getElementById('ec-ref').value    || null,
        notes:          document.getElementById('ec-notes').value.trim() || null,
      });
      toast.success('Customer updated.');
      close();
      await _renderAllTab(container);
    } catch (err) {
      console.error('Failed to update customer:', err);
      toast.error(err?.message || 'Failed to update customer.');
      saveBtn.disabled = false;
    }
  });
}

// ── Delete Customer ───────────────────────────────────────────────────────────

async function _confirmDeleteCustomer(container, customer) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">Delete ${_esc(customer.name)}?</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <p style="font-size:var(--text-sm);color:var(--clr-text-secondary);">
          This permanently removes <strong>${_esc(customer.name)}</strong> from the customer list and database.
          Past invoices are kept for your records. This cannot be undone.
        </p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="dc-cancel">Cancel</button>
        <button class="btn btn--primary" id="dc-confirm"
                style="background:var(--clr-danger);border-color:var(--clr-danger);">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close').addEventListener('click', close);
  overlay.querySelector('#dc-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _escKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _escKey); }
  });

  overlay.querySelector('#dc-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#dc-confirm');
    btn.disabled = true;
    try {
      await deleteCustomer(customer.id);
      toast.success(`${customer.name} deleted.`);
      close();
      await _renderAllTab(container);
    } catch (err) {
      console.error('Failed to delete customer:', err);
      toast.error(err?.message || 'Failed to delete customer.');
      btn.disabled = false;
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _todayStr() {
  return new Date().toISOString().split('T')[0];
}

function _escAttr(str) {
  return _esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _fmt(n) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _initials(name) {
  return String(name ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
