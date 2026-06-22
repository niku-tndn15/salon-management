/**
 * settings.js — Owner settings page.
 * Sections: Salon Profile, GST & Billing, Discount Offers, User Management.
 */

import { registerRoute }            from '../router.js';
import { currentUser, hashPassword } from '../auth.js';
import {
  getSalonProfile,
  updateSalonProfile,
  getDiscountOffers,
  createDiscountOffer,
  updateDiscountOfferStatus,
  deleteDiscountOffer,
  getUserAccounts,
  createUserAccount,
  updateUserAccountStatus,
  deleteUserAccount,
  resetUserPassword,
} from '../db.js';
import db   from '../db.js';
import toast from '../components/toast.js';

registerRoute('/settings', _renderSettings);

// ── Page render ───────────────────────────────────────────────────────────────

async function _renderSettings() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div class="settings-page">
      <nav class="settings-nav" id="settings-nav">
        <button class="settings-nav__link active" data-panel="profile">
          <i data-lucide="store"></i> Salon Profile
        </button>
        <button class="settings-nav__link" data-panel="gst">
          <i data-lucide="percent"></i> GST &amp; Billing
        </button>
        <button class="settings-nav__link" data-panel="offers">
          <i data-lucide="tag"></i> Discount Offers
        </button>
        <button class="settings-nav__link" data-panel="users">
          <i data-lucide="users"></i> User Management
        </button>
        <button class="settings-nav__link" data-panel="reset-password">
          <i data-lucide="key-round"></i> Reset Password
        </button>
      </nav>

      <div class="settings-panel" id="settings-content"></div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [document.getElementById('settings-nav')] });

  document.getElementById('settings-nav')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-panel]');
    if (!btn) return;
    document.querySelectorAll('.settings-nav__link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await _renderPanel(btn.dataset.panel);
  });

  await _renderPanel('profile');
}

async function _renderPanel(panel) {
  const container = document.getElementById('settings-content');
  if (!container) return;

  container.innerHTML = `<div class="skeleton" style="height:320px;border-radius:12px;"></div>`;

  switch (panel) {
    case 'profile': await _profilePanel(container); break;
    case 'gst':     await _gstPanel(container);     break;
    case 'offers':  await _offersPanel(container);  break;
    case 'users':   await _usersPanel(container);   break;
    case 'reset-password': await _resetPasswordPanel(container); break;
  }

  if (window.lucide) window.lucide.createIcons({ nodes: [container] });
}

// ── Salon Profile panel ───────────────────────────────────────────────────────

async function _profilePanel(container) {
  const p = await getSalonProfile();

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">Salon Profile</div>
          <div class="settings-section__desc">Basic information displayed on invoices</div>
        </div>
      </div>

      <form id="profile-form">
        <div class="settings-section__body">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Salon Name <span class="required">*</span></label>
              <input class="form-input" name="name" required
                value="${_esc(p?.name ?? '')}" placeholder="Glamour Salon" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-input" name="phone"
                value="${_esc(p?.phone ?? '')}" placeholder="022-XXXXXXXX" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea class="form-textarea" name="address" placeholder="Full address with pincode">${_esc(p?.address ?? '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" name="email"
              value="${_esc(p?.email ?? '')}" placeholder="salon@example.com" />
          </div>
        </div>
        <div class="settings-section__footer">
          <button type="submit" class="btn btn--primary">Save changes</button>
        </div>
      </form>
    </div>
  `;

  container.querySelector('#profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!String(data.name ?? '').trim()) { toast.error('Validation', 'Salon name is required.'); return; }
    try {
      await updateSalonProfile(data);
      toast.success('Saved', 'Salon profile updated.');
    } catch {
      toast.error('Error', 'Failed to save profile.');
    }
  });
}

// ── GST & Billing panel ───────────────────────────────────────────────────────

async function _gstPanel(container) {
  const p          = await getSalonProfile();
  const gstEnabled = p?.gstEnabled ?? false;

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">GST &amp; Billing</div>
          <div class="settings-section__desc">Configure tax settings applied on every invoice</div>
        </div>
      </div>

      <div class="settings-section__body">
        <div class="form-group">
          <label class="toggle-wrapper">
            <span class="toggle">
              <input type="checkbox" id="gst-toggle" ${gstEnabled ? 'checked' : ''} />
              <span class="toggle__track"></span>
              <span class="toggle__thumb"></span>
            </span>
            <span class="toggle-label">Enable GST on invoices</span>
          </label>
          <span class="form-hint">When enabled, CGST 9% + SGST 9% is added to the taxable amount after discount.</span>
        </div>

        <div class="form-group gst-field ${gstEnabled ? '' : 'hidden'}" id="gstin-field">
          <label class="form-label">GSTIN</label>
          <input class="form-input" id="gstin-input"
            value="${_esc(p?.gstin ?? '')}"
            placeholder="27ABCDE1234F1Z5"
            maxlength="15"
            style="text-transform:uppercase;letter-spacing:1px;" />
          <span class="form-hint">15-character GST Identification Number</span>
        </div>

        <div style="background:var(--clr-bg);border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--sp-5);">
          <div style="font-size:var(--text-sm);font-weight:var(--font-semibold);color:var(--clr-text-primary);margin-bottom:var(--sp-4);">Tax rates (fixed by law)</div>
          <div style="display:flex;gap:var(--sp-8);">
            <div>
              <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-bottom:4px;">CGST</div>
              <div style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--clr-text-primary);">9%</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-bottom:4px;">SGST</div>
              <div style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--clr-text-primary);">9%</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-bottom:4px;">Total GST</div>
              <div style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--clr-primary);">18%</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section__footer">
        <button type="button" class="btn btn--primary" id="gst-save">Save changes</button>
      </div>
    </div>
  `;

  const toggle   = container.querySelector('#gst-toggle');
  const gstField = container.querySelector('#gstin-field');

  toggle?.addEventListener('change', () => {
    gstField.classList.toggle('hidden', !toggle.checked);
  });

  container.querySelector('#gst-save')?.addEventListener('click', async () => {
    const enabled = toggle.checked;
    const gstin   = container.querySelector('#gstin-input')?.value.trim().toUpperCase() ?? '';
    if (enabled && !gstin) { toast.error('Validation', 'GSTIN is required when GST is enabled.'); return; }
    try {
      await updateSalonProfile({ gstEnabled: enabled, gstin });
      toast.success('Saved', 'GST settings updated.');
    } catch {
      toast.error('Error', 'Failed to save GST settings.');
    }
  });
}

// ── Discount Offers panel ─────────────────────────────────────────────────────

async function _offersPanel(container) {
  const offers = await getDiscountOffers('all');

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">Discount Offers</div>
          <div class="settings-section__desc">Predefined offers selectable at billing time</div>
        </div>
        <button class="btn btn--secondary btn--sm" id="add-offer-btn" type="button">
          <i data-lucide="plus"></i> Add Offer
        </button>
      </div>

      <!-- Inline add form (hidden by default) -->
      <div id="add-offer-form" hidden>
        <div class="settings-section__body" style="border-bottom:1px solid var(--clr-border);background:var(--clr-bg);">
          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Offer Name <span class="required">*</span></label>
              <input class="form-input" id="offer-name" placeholder="e.g. Weekend Glow" />
            </div>
            <div class="form-group">
              <label class="form-label">Discount Type</label>
              <select class="form-select" id="offer-type">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Value <span class="required">*</span></label>
              <input class="form-input" id="offer-value" type="number" min="1" step="any" placeholder="e.g. 10" />
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-2);">
            <button class="btn btn--primary btn--sm" type="button" id="save-offer-btn">Save Offer</button>
            <button class="btn btn--ghost btn--sm"   type="button" id="cancel-offer-btn">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Offers table -->
      <div class="offers-table-wrapper">
        ${_offersTableHTML(offers)}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container.querySelector('.settings-section__header')] });

  container.querySelector('#add-offer-btn')?.addEventListener('click', () => {
    container.querySelector('#add-offer-form').hidden = false;
    container.querySelector('#add-offer-btn').hidden  = true;
  });

  container.querySelector('#cancel-offer-btn')?.addEventListener('click', () => {
    container.querySelector('#add-offer-form').hidden = true;
    container.querySelector('#add-offer-btn').hidden  = false;
    container.querySelector('#offer-name').value  = '';
    container.querySelector('#offer-value').value = '';
  });

  container.querySelector('#save-offer-btn')?.addEventListener('click', async () => {
    const name  = container.querySelector('#offer-name')?.value.trim() ?? '';
    const type  = container.querySelector('#offer-type')?.value ?? 'PERCENTAGE';
    const raw   = container.querySelector('#offer-value')?.value;
    const value = parseFloat(raw);

    if (!name)                     { toast.error('Validation', 'Offer name is required.'); return; }
    if (!value || isNaN(value) || value <= 0) { toast.error('Validation', 'Enter a valid discount value.'); return; }
    if (type === 'PERCENTAGE' && value > 100) { toast.error('Validation', 'Percentage cannot exceed 100.'); return; }

    try {
      await createDiscountOffer({
        name, discountType: type, discountValue: value, status: 'ACTIVE',
      });
      toast.success('Added', 'Discount offer created.');
      await _offersPanel(container);
      if (window.lucide) window.lucide.createIcons({ nodes: [container] });
    } catch {
      toast.error('Error', 'Failed to create offer.');
    }
  });

  // Activate / Deactivate / Delete
  container.querySelector('.offers-table-wrapper')?.addEventListener('click', async e => {
    const toggleBtn = e.target.closest('[data-offer-toggle]');
    if (toggleBtn) {
      const id      = toggleBtn.dataset.offerToggle;
      const current = toggleBtn.dataset.offerStatus;
      const next    = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      try {
        await updateDiscountOfferStatus(id, next);
        toast.success('Updated', `Offer ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
        await _offersPanel(container);
        if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      } catch {
        toast.error('Error', 'Failed to update offer status.');
      }
      return;
    }

    const delBtn = e.target.closest('[data-offer-delete]');
    if (delBtn) {
      const id   = delBtn.dataset.offerDelete;
      const name = delBtn.dataset.offerName || 'this offer';
      if (!confirm(`Delete discount offer "${name}" permanently? This cannot be undone.`)) return;
      try {
        await deleteDiscountOffer(id);
        toast.success('Deleted', `Offer "${name}" deleted.`);
        await _offersPanel(container);
        if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      } catch (err) {
        toast.error('Error', err?.message || 'Failed to delete offer.');
      }
    }
  });
}

function _offersTableHTML(offers) {
  if (!offers.length) {
    return `<p style="padding:var(--sp-6);font-size:var(--text-sm);color:var(--clr-text-muted);">No discount offers yet. Add one above.</p>`;
  }

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Value</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${offers.map(o => `
          <tr>
            <td style="font-weight:var(--font-medium);">${_esc(o.name)}</td>
            <td class="col-muted">${o.discountType === 'PERCENTAGE' ? 'Percentage' : 'Flat'}</td>
            <td style="font-weight:var(--font-semibold);">${o.discountType === 'PERCENTAGE' ? o.discountValue + '%' : '₹' + o.discountValue}</td>
            <td>
              <span class="badge ${o.status === 'ACTIVE' ? 'badge--active' : 'badge--inactive'}">
                ${o.status}
              </span>
            </td>
            <td>
              <div style="display:flex;gap:var(--sp-2);">
                <button class="btn btn--ghost btn--sm"
                  data-offer-toggle="${o.id}"
                  data-offer-status="${o.status}"
                  type="button">
                  ${o.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn btn--ghost btn--sm"
                  data-offer-delete="${o.id}"
                  data-offer-name="${_escAttr(o.name)}"
                  type="button"
                  style="color:var(--clr-danger);border-color:var(--clr-danger);">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ── User Management panel ─────────────────────────────────────────────────────

async function _usersPanel(container) {
  const me    = currentUser();
  const users = await getUserAccounts();

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">User Management</div>
          <div class="settings-section__desc">Manage accounts and access for your team</div>
        </div>
        <button class="btn btn--secondary btn--sm" id="add-user-btn" type="button">
          <i data-lucide="user-plus"></i> Add User
        </button>
      </div>

      <!-- Inline add form -->
      <div id="add-user-form" hidden>
        <div class="settings-section__body" style="border-bottom:1px solid var(--clr-border);background:var(--clr-bg);">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Full Name <span class="required">*</span></label>
              <input class="form-input" id="new-name" placeholder="Full name" autocomplete="off" />
            </div>
            <div class="form-group">
              <label class="form-label">Username <span class="required">*</span></label>
              <input class="form-input" id="new-username" placeholder="username (no spaces)" autocomplete="off" spellcheck="false" />
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" id="new-role">
                <option value="BILLING_PERSON">Billing Person</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Password <span class="required">*</span></label>
              <input class="form-input" id="new-password" type="password"
                placeholder="Min 6 characters" autocomplete="new-password" />
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-2);">
            <button class="btn btn--primary btn--sm" type="button" id="save-user-btn">Create User</button>
            <button class="btn btn--ghost btn--sm"   type="button" id="cancel-user-btn">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Users list -->
      <div class="users-list" id="users-list">
        ${_usersListHTML(users, me)}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [container.querySelector('.settings-section__header')] });

  container.querySelector('#add-user-btn')?.addEventListener('click', () => {
    container.querySelector('#add-user-form').hidden = false;
    container.querySelector('#add-user-btn').hidden  = true;
  });

  container.querySelector('#cancel-user-btn')?.addEventListener('click', () => {
    container.querySelector('#add-user-form').hidden = true;
    container.querySelector('#add-user-btn').hidden  = false;
  });

  container.querySelector('#save-user-btn')?.addEventListener('click', async () => {
    const name     = container.querySelector('#new-name')?.value.trim() ?? '';
    const username = container.querySelector('#new-username')?.value.trim().toLowerCase() ?? '';
    const role     = container.querySelector('#new-role')?.value ?? 'BILLING_PERSON';
    const password = container.querySelector('#new-password')?.value ?? '';

    if (!name)                   { toast.error('Validation', 'Name is required.'); return; }
    if (!username)               { toast.error('Validation', 'Username is required.'); return; }
    if (/\s/.test(username))     { toast.error('Validation', 'Username cannot contain spaces.'); return; }
    if (password.length < 6)     { toast.error('Validation', 'Password must be at least 6 characters.'); return; }

    const existing = await db.users.where('username').equals(username).first();
    if (existing) { toast.error('Validation', `Username "${username}" is already taken.`); return; }

    try {
      await createUserAccount({
        name, username, role,
        password,
        passwordHash:   hashPassword(password),
        status:         'ACTIVE',
      });
      toast.success('Created', `User "${username}" created.`);
      await _usersPanel(container);
      if (window.lucide) window.lucide.createIcons({ nodes: [container] });
    } catch {
      toast.error('Error', 'Failed to create user.');
    }
  });

  // Activate / Deactivate / Delete
  container.querySelector('#users-list')?.addEventListener('click', async e => {
    const toggleBtn = e.target.closest('[data-user-toggle]');
    const deleteBtn = e.target.closest('[data-user-delete]');

    if (toggleBtn) {
      const id      = toggleBtn.dataset.userToggle;
      const current = toggleBtn.dataset.userStatus;
      if (String(id) === String(me?.id)) { toast.warning('Not allowed', 'You cannot deactivate your own account.'); return; }
      const next = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      try {
        await updateUserAccountStatus(id, next);
        toast.success('Updated', `User ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
        await _usersPanel(container);
        if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      } catch {
        toast.error('Error', 'Failed to update user status.');
      }
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.userDelete;
      const username = deleteBtn.dataset.userUsername || 'this user';
      if (String(id) === String(me?.id)) { toast.warning('Not allowed', 'You cannot delete your own account.'); return; }
      if (!confirm(`Delete user "${username}" permanently? This cannot be undone.`)) return;
      try {
        await deleteUserAccount(id);
        toast.success('Deleted', `User "${username}" deleted.`);
        await _usersPanel(container);
        if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      } catch (err) {
        toast.error('Error', err?.message || 'Failed to delete user.');
      }
    }
  });
}

function _usersListHTML(users, me) {
  const roleLabel = r => ({ OWNER: 'Owner', BILLING_PERSON: 'Billing', STAFF: 'Staff' }[r] ?? r);
  const roleBadge = r => ({ OWNER: 'badge--owner', BILLING_PERSON: 'badge--billing-person', STAFF: 'badge--staff' }[r] ?? '');

  return users.map(u => `
    <div class="user-row">
      <div class="user-row__avatar">${_initials(u.name)}</div>
      <div class="user-row__info">
        <div class="user-row__name">${_esc(u.name)}</div>
        <div class="user-row__username">
          @${_esc(u.username)}
          &nbsp;<span class="badge badge--no-dot ${roleBadge(u.role)}">${roleLabel(u.role)}</span>
        </div>
      </div>
      <div class="user-row__actions">
        <span class="badge ${u.status === 'ACTIVE' ? 'badge--active' : 'badge--inactive'}">${u.status}</span>
        ${u.id !== me?.id
          ? `<button class="btn btn--ghost btn--sm"
               data-user-toggle="${u.id}"
               data-user-status="${u.status}"
               type="button">
               ${u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
             </button>
             <button class="btn btn--ghost btn--sm"
               data-user-delete="${u.id}"
               data-user-username="${_escAttr(u.username)}"
               type="button">
               Delete
             </button>`
          : `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);padding:0 var(--sp-2);">(you)</span>`
        }
      </div>
    </div>
  `).join('');
}

// ── Reset Password panel ──────────────────────────────────────────────────────

async function _resetPasswordPanel(container) {
  const users = (await getUserAccounts())
    .filter(u => ['BILLING_PERSON', 'STAFF'].includes(u.role))
    .sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username)));

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">Reset Password</div>
          <div class="settings-section__desc">Reset passwords for Billing and Staff login accounts</div>
        </div>
      </div>

      <div class="settings-section__body" id="reset-password-result" hidden></div>

      <div class="users-list" id="reset-password-list">
        ${_resetPasswordListHTML(users)}
      </div>
    </div>
  `;

  container.querySelector('#reset-password-list')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-reset-password]');
    if (!btn) return;

    const id = btn.dataset.resetPassword;
    const username = btn.dataset.userUsername || 'this user';
    if (!confirm(`Reset password for "${username}"? The old password will stop working.`)) return;

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Resetting...';

    try {
      const result = await resetUserPassword(id);
      _showResetPasswordResult(container, result.user, result.temporaryPassword);
      toast.success('Password reset', `New password generated for "${result.user.username}".`);
    } catch (err) {
      toast.error('Error', err?.message || 'Failed to reset password.');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  container.querySelector('#reset-password-result')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy-password]');
    if (!btn) return;
    const password = btn.dataset.copyPassword || '';
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Copied', 'Temporary password copied.');
    } catch {
      toast.warning('Copy failed', 'Select and copy the password manually.');
    }
  });
}

function _resetPasswordListHTML(users) {
  if (!users.length) {
    return `<p style="padding:var(--sp-6);font-size:var(--text-sm);color:var(--clr-text-muted);">No Billing or Staff users found.</p>`;
  }

  const roleLabel = r => ({ BILLING_PERSON: 'Billing', STAFF: 'Staff' }[r] ?? r);
  const roleBadge = r => ({ BILLING_PERSON: 'badge--billing-person', STAFF: 'badge--staff' }[r] ?? '');

  return users.map(u => `
    <div class="user-row">
      <div class="user-row__avatar">${_initials(u.name)}</div>
      <div class="user-row__info">
        <div class="user-row__name">${_esc(u.name)}</div>
        <div class="user-row__username">
          @${_esc(u.username)}
          &nbsp;<span class="badge badge--no-dot ${roleBadge(u.role)}">${roleLabel(u.role)}</span>
          &nbsp;<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">ID: ${_esc(u.id)}</span>
        </div>
      </div>
      <div class="user-row__actions">
        <span class="badge ${u.status === 'ACTIVE' ? 'badge--active' : 'badge--inactive'}">${u.status}</span>
        <button class="btn btn--secondary btn--sm"
          data-reset-password="${u.id}"
          data-user-username="${_escAttr(u.username)}"
          type="button">
          Reset Password
        </button>
      </div>
    </div>
  `).join('');
}

function _showResetPasswordResult(container, user, temporaryPassword) {
  const resultBox = container.querySelector('#reset-password-result');
  if (!resultBox) return;

  resultBox.hidden = false;
  resultBox.innerHTML = `
    <div style="border:1px solid var(--clr-border);border-radius:var(--radius-md);padding:var(--sp-5);background:var(--clr-bg);">
      <div style="font-size:var(--text-sm);font-weight:var(--font-semibold);color:var(--clr-text-primary);margin-bottom:var(--sp-2);">
        New password for @${_esc(user?.username)}
      </div>
      <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap;">
        <code style="font-size:var(--text-base);padding:8px 10px;border:1px solid var(--clr-border);border-radius:var(--radius-sm);background:white;">${_esc(temporaryPassword)}</code>
        <button class="btn btn--ghost btn--sm"
          data-copy-password="${_escAttr(temporaryPassword)}"
          type="button">
          Copy
        </button>
      </div>
      <div style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-top:var(--sp-3);">
        Share this password with the user. They can use it for their next login.
      </div>
    </div>
  `;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _escAttr(str) {
  return _esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _initials(name) {
  return String(name ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
