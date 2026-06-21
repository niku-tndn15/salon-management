/**
 * billing.js — Invoicing & Billing page.
 * Features: customer lookup, cart, discounts, GST, invoice generation,
 *           WhatsApp share, past invoice history, full/partial refunds.
 */

import { registerRoute } from '../router.js';
import db, {
  findCustomerByPhone, createCustomer, getCustomerWithStats,
  getActiveStaff, getSalonProfile, getActiveDiscountOffers,
  createInvoice, getInvoiceWithLineItems, processRefund,
} from '../db.js';
import { currentUser } from '../auth.js';
import toast           from '../components/toast.js';

registerRoute('/billing', _renderBilling);

// ── Module state ───────────────────────────────────────────────────────────────
let _tab           = 'new';
let _customer      = null;      // enriched customer with stats
let _cart          = [];        // [{_id, serviceId, serviceName, catalogPrice, unitPrice, isPriceOverride, professionalId}]
let _discountMode  = 'NONE';   // 'NONE' | 'PREDEFINED' | 'MANUAL'
let _discountType  = 'PERCENTAGE'; // 'PERCENTAGE' | 'FLAT'
let _discountValue = 0;
let _selectedOffer = null;
let _paymentMethod = null;
let _staff         = [];
let _categories    = [];
let _services      = [];
let _offers        = [];
let _salon         = null;
let _catFilter     = 'all';
let _phoneTimer    = null;

// ── Page render ────────────────────────────────────────────────────────────────
async function _renderBilling() {
  const content = document.getElementById('page-content');
  if (!content) return;

  _tab = 'new';
  content.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>`;

  [_staff, _categories, _services, _offers, _salon] = await Promise.all([
    getActiveStaff(),
    db.serviceCategories.toArray(),
    db.services.where('status').equals('ACTIVE').toArray(),
    getActiveDiscountOffers(),
    getSalonProfile(),
  ]);

  await _restoreCart();

  content.innerHTML = `
    <div class="page-tabs" id="billing-tabs" style="margin-bottom:var(--sp-5);">
      <button class="page-tab active" data-tab="new">New Invoice</button>
      <button class="page-tab" data-tab="history">Past Invoices</button>
    </div>
    <div id="billing-view"></div>
  `;

  document.getElementById('billing-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    _tab = btn.dataset.tab;
    document.querySelectorAll('#billing-tabs .page-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === _tab));
    _renderView();
  });

  _renderView();
}

function _renderView() {
  const v = document.getElementById('billing-view');
  if (!v) return;
  _tab === 'new' ? _renderNew(v) : _renderHistory(v);
}

// ── NEW INVOICE ────────────────────────────────────────────────────────────────
function _renderNew(container) {
  container.innerHTML = `
    <div class="billing-page">
      <div class="billing-left">
        <div class="section-card">
          <div class="section-card__header"><div class="section-card__title">Customer</div></div>
          <div class="section-card__body">
            <div id="cust-area">${_customer ? _custStripHTML() : _custSearchHTML()}</div>
          </div>
        </div>
        <div class="section-card">
          <div class="section-card__header"><div class="section-card__title">Add Services</div></div>
          <div class="section-card__body" id="svc-picker">
            ${_customer ? _pickerHTML() : `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">Select a customer first.</p>`}
          </div>
        </div>
      </div>

      <div class="billing-cart" id="billing-cart">
        <div class="billing-cart__header" id="cart-hdr">
          ${_cartHdrHTML()}
        </div>
        <div class="billing-cart__items" id="cart-items">${_cartItemsHTML()}</div>
        <div class="billing-cart__discount" id="cart-disc">${_discountHTML()}</div>
        <div class="billing-cart__totals" id="cart-totals">${_totalsHTML()}</div>
        <div class="billing-cart__payment">
          <div style="font-size:var(--text-xs);font-weight:600;color:var(--clr-text-secondary);margin-bottom:var(--sp-2);text-transform:uppercase;letter-spacing:.5px;">Payment</div>
          <div class="payment-methods" id="pay-methods">
            ${['CASH','UPI','CARD'].map(m => `<button class="payment-method-btn${_paymentMethod===m?' active':''}" data-pm="${m}">${m}</button>`).join('')}
          </div>
        </div>
        <div class="billing-cart__actions">
          <button class="btn btn--primary btn--pay" id="gen-btn"${_canGenerate()?'':' disabled'}>Generate Invoice</button>
          <div id="gen-hint" style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-top:var(--sp-2);text-align:center;min-height:16px;">${_hint()}</div>
        </div>
      </div>
    </div>
  `;

  _wireCustArea(container.querySelector('#cust-area'));
  _wirePickerArea();
  _wireCart();
  if (window.lucide) window.lucide.createIcons({ nodes: [container] });
}

// ── Customer area ──────────────────────────────────────────────────────────────
function _wireCustArea(el) {
  if (!el) return;
  _wirePhoneInput(el);

  el.addEventListener('click', e => {
    if (e.target.closest('#change-cust-btn')) {
      _customer = null;
      _clearCartState();
      el.innerHTML = _custSearchHTML();
      const picker = document.getElementById('svc-picker');
      if (picker) picker.innerHTML = `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">Select a customer first.</p>`;
      _wirePhoneInput(el);
      _refreshCart();
    }
  });

  el.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!el.contains(document.activeElement)) _hideSugg();
    }, 150);
  });
}

function _wirePhoneInput(custEl) {
  const inp = custEl.querySelector('#phone-inp');
  if (!inp) return;
  inp.focus();
  inp.addEventListener('input', e => {
    const v = e.target.value.trim();
    clearTimeout(_phoneTimer);
    if (v.length < 4) { _hideSugg(); return; }
    _phoneTimer = setTimeout(() => _searchCustomers(v, custEl), 200);
  });

  // mousedown fires before blur — e.preventDefault() keeps the input focused
  // so focusout never fires and suggestions stay in the DOM for the click
  const suggEl = custEl.querySelector('#phone-sugg');
  if (suggEl) {
    suggEl.addEventListener('mousedown', async e => {
      const item = e.target.closest('[data-cust-id]');
      if (item) {
        e.preventDefault();
        await _pickCustomer(item.dataset.custId, custEl);
        return;
      }
      if (e.target.closest('#new-cust-btn')) {
        e.preventDefault();
        _openAddCustModal(inp.value, custEl);
      }
    });
  }
}

async function _searchCustomers(q, custEl) {
  const all     = await db.customers.where('status').equals('ACTIVE').toArray();
  const matches = all.filter(c => c.phone.includes(q) || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const suggEl  = custEl.querySelector('#phone-sugg');
  if (!suggEl) return;

  if (!matches.length) {
    suggEl.innerHTML = q.length === 10
      ? `<div class="customer-suggestion-item customer-suggestion-item--new" id="new-cust-btn">+ Create new customer for ${_esc(q)}</div>`
      : `<div style="padding:var(--sp-3) var(--sp-4);font-size:var(--text-sm);color:var(--clr-text-muted);">Type more to search…</div>`;
    suggEl.hidden = false;
    return;
  }

  suggEl.innerHTML = matches.map(c => `
    <div class="customer-suggestion-item" data-cust-id="${c.id}">
      <div class="customer-suggestion-item__avatar">${_initials(c.name)}</div>
      <div>
        <div class="customer-suggestion-item__name">${_esc(c.name)}</div>
        <div class="customer-suggestion-item__sub">${_esc(c.phone)}</div>
      </div>
    </div>
  `).join('') + (q.length === 10 ? `<div class="customer-suggestion-item customer-suggestion-item--new" id="new-cust-btn" style="border-top:1px solid var(--clr-border);">+ Create new customer</div>` : '');
  suggEl.hidden = false;
}

function _hideSugg() {
  const el = document.getElementById('phone-sugg');
  if (el) { el.innerHTML = ''; el.hidden = true; }
}

async function _pickCustomer(id, custEl) {
  const c = await getCustomerWithStats(id);
  if (!c) return;
  _customer = c;
  custEl.innerHTML = _custStripHTML();
  const picker = document.getElementById('svc-picker');
  if (picker) picker.innerHTML = _pickerHTML();
  _refreshCart();
}

function _custSearchHTML() {
  return `
    <div class="customer-lookup-card__search">
      <input class="form-input" id="phone-inp" type="text"
             placeholder="Search by phone or name…" autocomplete="off" />
      <div class="customer-suggestions" id="phone-sugg" hidden></div>
    </div>
  `;
}

function _custStripHTML() {
  const c    = _customer;
  const last = c.lastVisit
    ? new Date(c.lastVisit).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    : 'No visits';
  return `
    <div class="selected-customer">
      <div class="selected-customer__avatar">${_initials(c.name)}</div>
      <div class="selected-customer__info">
        <div class="selected-customer__name">${_esc(c.name)}</div>
        <div class="selected-customer__meta">${_esc(c.phone)} · ${c.visitCount ?? 0} visits · Last: ${last}</div>
      </div>
      <button class="btn btn--ghost btn--sm" id="change-cust-btn">Change</button>
    </div>
  `;
}

// ── Service picker ─────────────────────────────────────────────────────────────
function _wirePickerArea() {
  document.getElementById('svc-picker')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      _catFilter = chip.dataset.chip;
      const p = document.getElementById('svc-picker');
      if (p) p.innerHTML = _pickerHTML();
      return;
    }
    const tile = e.target.closest('[data-svc]');
    if (tile) _addToCart(tile.dataset.svc);
  });
}

function _pickerHTML() {
  const chips = [
    `<button class="category-chip${_catFilter==='all'?' active':''}" data-chip="all">All</button>`,
    ..._categories.map(c => `<button class="category-chip${String(_catFilter)===String(c.id)?' active':''}" data-chip="${c.id}">${_esc(c.name)}</button>`),
  ].join('');

  const svcs = _catFilter === 'all' ? _services : _services.filter(s => String(s.categoryId) === String(_catFilter));
  const tiles = svcs.length
    ? svcs.map(s => `
        <div class="service-tile" data-svc="${s.id}">
          <div class="service-tile__name">${_esc(s.name)}</div>
          <div class="service-tile__price">${_fmt(s.price)}</div>
          ${s.durationMin ? `<div class="service-tile__duration">${s.durationMin} min</div>` : ''}
        </div>
      `).join('')
    : `<p style="color:var(--clr-text-muted);font-size:var(--text-sm);">No services in this category.</p>`;

  return `<div class="service-picker__categories">${chips}</div><div class="service-grid">${tiles}</div>`;
}

// ── Cart ───────────────────────────────────────────────────────────────────────
function _addToCart(serviceId) {
  const svc = _services.find(s => String(s.id) === String(serviceId));
  if (!svc) return;
  _cart.push({
    _id:             `${Date.now()}${Math.random().toString(36).slice(2,6)}`,
    serviceId:       svc.id,
    serviceName:     svc.name,
    catalogPrice:    svc.price,
    unitPrice:       svc.price,
    isPriceOverride: false,
    professionalId:  _staff.length === 1 ? _staff[0].id : null,
  });
  _saveCart();
  _refreshCart();
}

function _wireCart() {
  const cart = document.getElementById('billing-cart');
  if (!cart) return;

  cart.addEventListener('click', e => {
    if (e.target.closest('#clear-cart-btn')) {
      _clearCartState();
      _refreshCart();
      return;
    }
    const rem = e.target.closest('[data-rem]');
    if (rem) {
      _cart = _cart.filter(c => c._id !== rem.dataset.rem);
      _saveCart();
      _refreshCart();
      return;
    }
    const pm = e.target.closest('[data-pm]');
    if (pm) {
      _paymentMethod = pm.dataset.pm;
      cart.querySelectorAll('[data-pm]').forEach(b => b.classList.toggle('active', b.dataset.pm === _paymentMethod));
      _updateGenBtn();
      return;
    }
    const dmode = e.target.closest('[data-dmode]');
    if (dmode) {
      _discountMode = dmode.dataset.dmode;
      _discountValue = 0; _selectedOffer = null;
      const discEl = document.getElementById('cart-disc');
      if (discEl) discEl.innerHTML = _discountHTML();
      _renderTotals();
      return;
    }
    const dtype = e.target.closest('[data-dtype]');
    if (dtype) {
      _discountType = dtype.dataset.dtype;
      _discountValue = 0;
      document.querySelectorAll('[data-dtype]').forEach(b => b.classList.toggle('active', b.dataset.dtype === _discountType));
      const inp = document.getElementById('disc-val');
      if (inp) inp.value = '';
      _renderTotals();
      return;
    }
    if (e.target.closest('#gen-btn') && _canGenerate()) _generateInvoice();
  });

  cart.addEventListener('input', e => {
    const priceInp = e.target.closest('[data-price]');
    if (priceInp) {
      const item = _cart.find(c => c._id === priceInp.dataset.price);
      if (item) {
        const v = parseFloat(priceInp.value) || 0;
        item.unitPrice       = v;
        item.isPriceOverride = v !== item.catalogPrice;
        const badge = document.querySelector(`[data-override="${item._id}"]`);
        if (badge) badge.style.display = item.isPriceOverride ? '' : 'none';
        _saveCart();
        _renderTotals();
      }
      return;
    }
    if (e.target.id === 'disc-val') {
      _discountValue = parseFloat(e.target.value) || 0;
      _renderTotals();
    }
  });

  cart.addEventListener('change', e => {
    const staffSel = e.target.closest('[data-staff]');
    if (staffSel) {
      const item = _cart.find(c => c._id === staffSel.dataset.staff);
      if (item) { item.professionalId = staffSel.value || null; _saveCart(); _updateGenBtn(); }
      return;
    }
    if (e.target.id === 'offer-sel') {
      const id  = e.target.value;
      _selectedOffer = _offers.find(o => String(o.id) === id) ?? null;
      if (_selectedOffer) {
        _discountValue = _selectedOffer.discountValue;
        _discountType  = _selectedOffer.discountType;
      } else {
        _discountValue = 0;
      }
      _renderTotals();
    }
  });
}

function _refreshCart() {
  const hdr   = document.getElementById('cart-hdr');
  const items = document.getElementById('cart-items');
  const disc  = document.getElementById('cart-disc');

  if (hdr)   hdr.innerHTML   = _cartHdrHTML();
  if (items) items.innerHTML  = _cartItemsHTML();
  if (disc)  disc.innerHTML   = _discountHTML();
  _renderTotals();
}

function _renderTotals() {
  const el = document.getElementById('cart-totals');
  if (el) el.innerHTML = _totalsHTML();
  _updateGenBtn();
}

function _updateGenBtn() {
  const btn  = document.getElementById('gen-btn');
  const hint = document.getElementById('gen-hint');
  if (btn)  btn.disabled    = !_canGenerate();
  if (hint) hint.textContent = _hint();
}

// ── HTML builders ──────────────────────────────────────────────────────────────
function _cartHdrHTML() {
  return `
    <span>Cart ${_cart.length ? `<span style="font-size:var(--text-sm);font-weight:400;color:var(--clr-text-muted);">(${_cart.length})</span>` : ''}</span>
    ${_cart.length ? `<button class="btn btn--ghost btn--sm" id="clear-cart-btn">Clear</button>` : ''}
  `;
}

function _cartItemsHTML() {
  if (!_cart.length) {
    return `<div style="padding:var(--sp-6) 0;text-align:center;color:var(--clr-text-muted);font-size:var(--text-sm);">No services added yet.</div>`;
  }
  return _cart.map(item => `
    <div class="cart-item">
      <div class="cart-item__top">
        <div>
          <div class="cart-item__name">${_esc(item.serviceName)}</div>
          <span data-override="${item._id}" class="badge badge--no-dot" style="font-size:10px;background:hsl(38,90%,94%);color:hsl(38,60%,40%);display:${item.isPriceOverride?'':'none'};">Override</span>
        </div>
        <button class="cart-item__remove" data-rem="${item._id}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="cart-item__bottom">
        <div style="position:relative;">
          <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--clr-text-muted);font-size:13px;pointer-events:none;">₹</span>
          <input class="form-input cart-item__price-input" style="padding-left:20px;"
                 type="number" min="0" step="1" value="${item.unitPrice}" data-price="${item._id}" />
        </div>
        <select class="form-select cart-item__staff-select" data-staff="${item._id}">
          <option value="">— Staff —</option>
          ${_staff.map(s => `<option value="${s.id}"${String(item.professionalId)===String(s.id)?' selected':''}>${_esc(s.name)}</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function _discountHTML() {
  const modes = [
    { k: 'NONE',       l: 'None' },
    { k: 'PREDEFINED', l: 'Offer' },
    { k: 'MANUAL',     l: 'Manual' },
  ];
  const btns = modes.map(m => `<button class="discount-type-btn${_discountMode===m.k?' active':''}" data-dmode="${m.k}">${m.l}</button>`).join('');

  let extra = '';
  if (_discountMode === 'PREDEFINED') {
    extra = `<select class="form-select" id="offer-sel" style="flex:1;height:30px;font-size:var(--text-sm);">
      <option value="">Select offer…</option>
      ${_offers.map(o => `<option value="${o.id}"${String(_selectedOffer?.id)===String(o.id)?' selected':''}>${_esc(o.name)} (${o.discountType==='PERCENTAGE'?o.discountValue+'%':'₹'+o.discountValue})</option>`).join('')}
    </select>`;
  } else if (_discountMode === 'MANUAL') {
    extra = `
      <div class="discount-type-toggle">
        <button class="discount-type-btn${_discountType==='PERCENTAGE'?' active':''}" data-dtype="PERCENTAGE">%</button>
        <button class="discount-type-btn${_discountType==='FLAT'?' active':''}" data-dtype="FLAT">₹</button>
      </div>
      <input class="form-input" id="disc-val" type="number" min="0" step="1"
             value="${_discountValue||''}" placeholder="${_discountType==='PERCENTAGE'?'0–100':'Amount'}"
             style="width:80px;height:30px;font-size:var(--text-sm);" />
    `;
  }

  return `
    <div style="font-size:var(--text-xs);font-weight:600;color:var(--clr-text-secondary);margin-bottom:var(--sp-2);text-transform:uppercase;letter-spacing:.5px;">Discount</div>
    <div class="discount-row">
      <div class="discount-type-toggle">${btns}</div>
      ${extra}
    </div>
  `;
}

function _calcTotals() {
  const subtotal = _cart.reduce((s, c) => s + c.unitPrice, 0);
  let   discAmt  = 0;
  let   discLabel = '';

  if (_discountMode === 'PREDEFINED' && _selectedOffer) {
    discAmt   = _selectedOffer.discountType === 'PERCENTAGE'
      ? Math.round(subtotal * _selectedOffer.discountValue / 100 * 100) / 100
      : Math.min(_selectedOffer.discountValue, subtotal);
    discLabel = _selectedOffer.name;
  } else if (_discountMode === 'MANUAL' && _discountValue > 0) {
    discAmt   = _discountType === 'PERCENTAGE'
      ? Math.round(subtotal * Math.min(_discountValue, 100) / 100 * 100) / 100
      : Math.min(_discountValue, subtotal);
    discLabel = _discountType === 'PERCENTAGE' ? `Manual (${_discountValue}%)` : 'Manual Discount';
  }

  const gst     = !!(_salon?.gstEnabled);
  const taxable = Math.round((subtotal - discAmt) * 100) / 100;
  const cgst    = gst ? Math.round(taxable * 0.09 * 100) / 100 : 0;
  const sgst    = gst ? Math.round(taxable * 0.09 * 100) / 100 : 0;
  const grand   = Math.round((taxable + cgst + sgst) * 100) / 100;

  return { subtotal, discAmt, discLabel, taxable, gst, cgst, sgst, grand };
}

function _totalsHTML() {
  const { subtotal, discAmt, discLabel, taxable, gst, cgst, sgst, grand } = _calcTotals();
  let rows = `<div class="total-row"><span>Subtotal</span><span>${_fmt(subtotal)}</span></div>`;
  if (discAmt > 0)
    rows += `<div class="total-row total-row--discount"><span>${_esc(discLabel)}</span><span>−${_fmt(discAmt)}</span></div>`;
  if (gst) {
    rows += `<div class="total-row total-row--tax"><span>Taxable</span><span>${_fmt(taxable)}</span></div>`;
    rows += `<div class="total-row total-row--tax"><span>CGST (9%)</span><span>${_fmt(cgst)}</span></div>`;
    rows += `<div class="total-row total-row--tax"><span>SGST (9%)</span><span>${_fmt(sgst)}</span></div>`;
  }
  rows += `<div class="total-row total-row--grand"><span>Grand Total</span><span class="amount">${_fmt(grand)}</span></div>`;
  return rows;
}

function _canGenerate() {
  return !!(
    _customer &&
    _cart.length &&
    _cart.every(c => c.professionalId) &&
    _paymentMethod
  );
}

function _hint() {
  if (!_customer)                         return 'Select a customer';
  if (!_cart.length)                      return 'Add at least one service';
  if (_cart.some(c => !c.professionalId)) return 'Assign a professional to each service';
  if (!_paymentMethod)                    return 'Select a payment method';
  return '';
}

// ── Generate invoice ───────────────────────────────────────────────────────────
async function _generateInvoice() {
  if (!_canGenerate()) return;
  const btn = document.getElementById('gen-btn');
  if (btn) btn.disabled = true;

  try {
    const { subtotal, discAmt, discLabel, taxable, gst, cgst, sgst, grand } = _calcTotals();

    if (_discountMode === 'MANUAL' && _discountType === 'FLAT' && _discountValue > subtotal) {
      toast.error(`Flat discount cannot exceed subtotal of ${_fmt(subtotal)}.`);
      if (btn) btn.disabled = false;
      return;
    }

    const now    = new Date();
    const invNum = await _nextInvNum();
    const user   = currentUser();

    const lineItems = await Promise.all(_cart.map(async item => {
      const commPct = await _commPct(item.professionalId, now.toISOString());
      const member  = _staff.find(s => String(s.id) === String(item.professionalId));
      return {
        serviceId:            item.serviceId,
        serviceNameSnap:      item.serviceName,
        unitPriceSnap:        item.unitPrice,
        quantity:             1,
        isPriceOverride:      item.isPriceOverride,
        professionalId:       item.professionalId,
        professionalNameSnap: member?.name ?? '',
        commissionPctSnap:    commPct,
      };
    }));

    const invData = {
      invoiceNumber:     invNum,
      customerId:        _customer.id,
      invoiceDate:       now.toISOString(),
      paymentMethod:     _paymentMethod,
      subtotal,
      discountType:      _discountMode === 'NONE' ? null : (_discountMode === 'PREDEFINED' ? _selectedOffer?.discountType : _discountType),
      discountValue:     _discountMode === 'NONE' ? 0 : (_discountMode === 'PREDEFINED' ? _selectedOffer?.discountValue ?? 0 : _discountValue),
      discountAmount:    discAmt,
      discountOfferSnap: _discountMode !== 'NONE' ? discLabel : null,
      taxableAmount:     taxable,
      gstEnabled:        gst,
      cgstAmount:        cgst,
      sgstAmount:        sgst,
      grandTotal:        grand,
      gstinSnap:         gst ? (_salon?.gstin ?? '') : null,
      salonNameSnap:     _salon?.name ?? '',
      salonAddressSnap:  _salon?.address ?? '',
      salonPhoneSnap:    _salon?.phone ?? '',
      createdBy:         user?.id ?? 1,
    };

    const savedCustomer = { ..._customer };
    const invoiceId     = await createInvoice(invData, lineItems);

    _openPreviewModal({ ...invData, id: invoiceId }, lineItems, savedCustomer);

    _cart = []; _discountMode = 'NONE'; _discountValue = 0;
    _selectedOffer = null; _paymentMethod = null; _customer = null;
    _saveCart();

  } catch {
    toast.error('Failed to generate invoice. Please try again.');
    if (btn) btn.disabled = false;
  }
}

async function _commPct(staffId, dateStr) {
  const date  = new Date(dateStr);
  const rates = await db.commissionRateHistory.where('staffId').equals(staffId).toArray();
  const hit   = rates
    .filter(r => new Date(r.effectiveFrom) <= date && (!r.effectiveTo || new Date(r.effectiveTo) >= date))
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return hit[0]?.commissionPct ?? 0;
}

async function _nextInvNum() {
  if (!navigator.onLine) return `LOCAL-${Date.now()}`;
  const all = await db.invoices.toArray();
  const max = all
    .filter(i => i.invoiceNumber?.startsWith('SAL-'))
    .reduce((m, i) => Math.max(m, parseInt(i.invoiceNumber.split('-')[2], 10) || 0), 0);
  const now = new Date();
  const ym  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
  return `SAL-${ym}-${String(max+1).padStart(4,'0')}`;
}

async function _nextRefNum() {
  const cnt = (await db.refunds.count()) + 1;
  const now = new Date();
  const ym  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
  return `REF-${ym}-${String(cnt).padStart(4,'0')}`;
}

// ── Invoice Preview Modal ──────────────────────────────────────────────────────
function _openPreviewModal(inv, lineItems, customer) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const dateStr = new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

  const rows = lineItems.map((li, i) => `
    <tr>
      <td style="padding:4px 0;color:var(--clr-text-muted);">${i+1}</td>
      <td style="padding:4px 8px;">${_esc(li.serviceNameSnap)}</td>
      <td style="padding:4px 8px;">${_esc(li.professionalNameSnap)}</td>
      <td style="padding:4px 0;text-align:right;">${_fmt(li.unitPriceSnap)}</td>
    </tr>`).join('');

  const waLines = [
    `*${inv.salonNameSnap} — Invoice*`,
    `Invoice: ${inv.invoiceNumber} | Date: ${dateStr}`,
    `Customer: ${customer.name}`,
    ``,
    `Services:`,
    ...lineItems.map(li => `• ${li.serviceNameSnap} (${li.professionalNameSnap}) — ${_fmt(li.unitPriceSnap)}`),
    ``,
    `Subtotal: ${_fmt(inv.subtotal)}`,
    inv.discountAmount > 0 ? `Discount: −${_fmt(inv.discountAmount)}` : null,
    inv.gstEnabled ? `CGST: ${_fmt(inv.cgstAmount)} | SGST: ${_fmt(inv.sgstAmount)}` : null,
    `*Total: ${_fmt(inv.grandTotal)}*`,
    `Payment: ${inv.paymentMethod}`,
    ``,
    `Thank you for visiting ${inv.salonNameSnap}! 🙏`,
  ].filter(Boolean).join('\n');

  overlay.innerHTML = `
    <div class="modal modal--sm" style="max-width:460px;">
      <div class="modal__header">
        <div class="modal__title">Invoice Generated ✓</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body" style="font-size:var(--text-sm);">
        <div style="text-align:center;margin-bottom:var(--sp-4);">
          <div style="font-size:var(--text-md);font-weight:700;">${_esc(inv.salonNameSnap)}</div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-secondary);">${_esc(inv.salonAddressSnap)}</div>
          ${inv.gstEnabled ? `<div style="font-size:var(--text-xs);color:var(--clr-text-muted);">GSTIN: ${_esc(inv.gstinSnap??'')}</div>` : ''}
        </div>
        <div style="border-top:1px dashed var(--clr-border);padding:var(--sp-2) 0;display:flex;justify-content:space-between;font-size:var(--text-xs);">
          <strong>${_esc(inv.invoiceNumber)}</strong><span>${dateStr}</span>
        </div>
        <div style="border-top:1px dashed var(--clr-border);padding:var(--sp-2) 0;font-size:var(--text-xs);color:var(--clr-text-secondary);">
          ${_esc(customer.name)} | ${_esc(customer.phone)}
        </div>
        <table style="width:100%;border-collapse:collapse;margin:var(--sp-2) 0;">
          <thead><tr style="border-bottom:1px solid var(--clr-border);">
            <th style="padding:4px 0;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">#</th>
            <th style="padding:4px 8px;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">Service</th>
            <th style="padding:4px 8px;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">By</th>
            <th style="padding:4px 0;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:right;">Price</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="border-top:1px dashed var(--clr-border);padding-top:var(--sp-2);display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${_fmt(inv.subtotal)}</span></div>
          ${inv.discountAmount>0?`<div style="display:flex;justify-content:space-between;color:var(--clr-danger);"><span>${_esc(inv.discountOfferSnap??'Discount')}</span><span>−${_fmt(inv.discountAmount)}</span></div>`:''}
          ${inv.gstEnabled?`<div style="display:flex;justify-content:space-between;color:var(--clr-text-muted);font-size:var(--text-xs);"><span>CGST (9%)</span><span>${_fmt(inv.cgstAmount)}</span></div><div style="display:flex;justify-content:space-between;color:var(--clr-text-muted);font-size:var(--text-xs);"><span>SGST (9%)</span><span>${_fmt(inv.sgstAmount)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;font-size:var(--text-lg);font-weight:700;border-top:1px solid var(--clr-border);padding-top:var(--sp-2);margin-top:4px;">
            <span>Grand Total</span><span style="color:var(--clr-primary);">${_fmt(inv.grandTotal)}</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-muted);">Payment: ${inv.paymentMethod}</div>
        </div>
        <div style="text-align:center;padding-top:var(--sp-3);border-top:1px dashed var(--clr-border);margin-top:var(--sp-3);font-size:var(--text-xs);color:var(--clr-text-muted);">
          Thank you for visiting ${_esc(inv.salonNameSnap)}!
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="prev-close">Close</button>
        <a class="btn btn--primary" href="https://wa.me/91${_esc(customer.phone)}?text=${encodeURIComponent(waLines)}" target="_blank" rel="noopener" style="text-decoration:none;">Share on WhatsApp</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => {
    if (!overlay.isConnected) return;
    overlay.remove();
    toast.success(`Invoice ${inv.invoiceNumber} generated.`);
    const view = document.getElementById('billing-view');
    if (view && _tab === 'new') _renderNew(view);
  };
  overlay.querySelector('.modal__close')?.addEventListener('click', close);
  overlay.querySelector('#prev-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });
}

// ── Add Customer Modal ─────────────────────────────────────────────────────────
function _openAddCustModal(phone, custEl) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">New Customer</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input class="form-input" id="nc-name" type="text" placeholder="e.g. Priya Sharma" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone <span class="required">*</span></label>
          <input class="form-input" id="nc-phone" type="tel" value="${_esc(phone)}"
                 style="background:var(--clr-bg);" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Gender</label>
          <select class="form-select" id="nc-gender">
            <option value="">Select…</option>
            <option>Female</option><option>Male</option><option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input class="form-input" id="nc-dob" type="date" max="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label class="form-label">Referral Source</label>
          <select class="form-select" id="nc-ref">
            <option value="">Select…</option>
            ${['Walk-in','Friend Referral','Instagram','Google','Facebook','Other'].map(s=>`<option>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="nc-cancel">Cancel</button>
        <button class="btn btn--primary" id="nc-save">Create Customer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });
  document.getElementById('nc-name')?.focus();

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close')?.addEventListener('click', close);
  overlay.querySelector('#nc-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelector('#nc-save')?.addEventListener('click', async () => {
    const name   = document.getElementById('nc-name').value.trim();
    const ph     = document.getElementById('nc-phone').value.trim();
    const gender = document.getElementById('nc-gender').value || null;
    const dob    = document.getElementById('nc-dob').value || null;
    const ref    = document.getElementById('nc-ref').value || null;

    if (!name)              { toast.error('Name is required.'); return; }
    if (!/^\d{10}$/.test(ph)) { toast.error('Enter a valid 10-digit phone number.'); return; }

    const exists = await findCustomerByPhone(ph);
    if (exists) { toast.error('A customer with this number already exists.'); return; }

    const saveBtn = overlay.querySelector('#nc-save');
    saveBtn.disabled = true;
    try {
      const id   = await createCustomer({ name, phone: ph, gender, dateOfBirth: dob, referralSource: ref });
      const cust = await getCustomerWithStats(id);
      _customer  = cust;
      close();
      custEl.innerHTML = _custStripHTML();
      const picker = document.getElementById('svc-picker');
      if (picker) picker.innerHTML = _pickerHTML();
      _refreshCart();
      toast.success('Customer created.');
    } catch {
      toast.error('Failed to create customer.');
      saveBtn.disabled = false;
    }
  });
}

// ── Past Invoices ──────────────────────────────────────────────────────────────
async function _renderHistory(container) {
  container.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);margin-top:var(--sp-5);"></div>`;

  const invoices = (await db.invoices.toArray()).sort((a,b) => new Date(b.invoiceDate)-new Date(a.invoiceDate));
  const custIds  = [...new Set(invoices.map(i => i.customerId))];
  const custMap  = {};
  await Promise.all(custIds.map(async id => {
    const c = await db.customers.get(id);
    if (c) custMap[id] = { name: c.name, phone: c.phone };
  }));

  const badgeCls = s => s==='PAID'?'badge--active':s==='REFUNDED'?'badge--refunded':'badge--partially-refunded';
  const badgeLbl = s => s==='PAID'?'Paid':s==='REFUNDED'?'Refunded':'Partial Refund';

  const renderTable = () => {
    const q   = (document.getElementById('h-search')?.value ?? '').toLowerCase();
    const pm  = document.getElementById('h-pm')?.value ?? '';
    const st  = document.getElementById('h-st')?.value ?? '';
    const df  = document.getElementById('h-from')?.value ?? '';
    const dt  = document.getElementById('h-to')?.value ?? '';

    const filtered = invoices.filter(inv => {
      const cn = (custMap[inv.customerId]?.name ?? '').toLowerCase();
      if (q && !inv.invoiceNumber?.toLowerCase().includes(q) && !cn.includes(q)) return false;
      if (pm && inv.paymentMethod !== pm) return false;
      if (st && inv.status !== st) return false;
      if (df && inv.invoiceDate < df) return false;
      if (dt && inv.invoiceDate.split('T')[0] > dt) return false;
      return true;
    });

    const tbody = document.getElementById('h-tbody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--sp-8);color:var(--clr-text-muted);">No invoices found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(inv => `
      <tr style="cursor:pointer;" data-inv-id="${inv.id}">
        <td>${_esc(inv.invoiceNumber??'')}</td>
        <td>${_esc(custMap[inv.customerId]?.name??'—')}</td>
        <td>${new Date(inv.invoiceDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td style="font-weight:600;">${_fmt(inv.grandTotal)}</td>
        <td><span class="badge badge--no-dot badge--cash" style="text-transform:uppercase;">${_esc(inv.paymentMethod??'')}</span></td>
        <td><span class="badge badge--no-dot ${badgeCls(inv.status)}">${badgeLbl(inv.status)}</span></td>
      </tr>
    `).join('');
  };

  container.innerHTML = `
    <div style="margin-top:var(--sp-5);">
      <div class="table-toolbar" style="margin-bottom:var(--sp-4);flex-wrap:wrap;gap:var(--sp-2);">
        <div class="table-toolbar__left" style="flex-wrap:wrap;gap:var(--sp-2);">
          <input class="form-input" id="h-search" type="search" placeholder="Invoice # or customer…" style="width:210px;" />
          <select class="form-select" id="h-pm" style="width:105px;"><option value="">All Methods</option><option>CASH</option><option>UPI</option><option>CARD</option></select>
          <select class="form-select" id="h-st" style="width:145px;"><option value="">All Statuses</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option><option value="PARTIALLY_REFUNDED">Partial Refund</option></select>
          <input class="form-input" id="h-from" type="date" style="width:128px;" title="From date" />
          <input class="form-input" id="h-to" type="date" style="width:128px;" title="To date" />
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody id="h-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderTable();

  ['h-search','h-pm','h-st','h-from','h-to'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  renderTable);
    document.getElementById(id)?.addEventListener('change', renderTable);
  });

  document.getElementById('h-tbody')?.addEventListener('click', async e => {
    const row = e.target.closest('[data-inv-id]');
    if (!row) return;
    const full = await getInvoiceWithLineItems(row.dataset.invId);
    if (full) _openDetailModal(full, custMap);
  });
}

// ── Invoice Detail Modal ───────────────────────────────────────────────────────
function _openDetailModal(inv, custMap) {
  const overlay  = document.createElement('div');
  overlay.className = 'modal-overlay';
  const dateStr  = new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  const custName = custMap?.[inv.customerId]?.name ?? '';
  const custPh   = custMap?.[inv.customerId]?.phone ?? '';
  const rows     = (inv.lineItems ?? []).map((li,i) => `
    <tr>
      <td style="padding:4px 0;color:var(--clr-text-muted);">${i+1}</td>
      <td style="padding:4px 8px;">${_esc(li.serviceNameSnap)}</td>
      <td style="padding:4px 8px;">${_esc(li.professionalNameSnap)}</td>
      <td style="padding:4px 0;text-align:right;">${_fmt(li.unitPriceSnap)}</td>
    </tr>`).join('');

  const waLines = [
    `*${inv.salonNameSnap??''} — Invoice*`,
    `Invoice: ${inv.invoiceNumber} | Date: ${dateStr}`,
    custName ? `Customer: ${custName}` : null,
    ``,
    `Services:`,
    ...(inv.lineItems??[]).map(li=>`• ${li.serviceNameSnap} (${li.professionalNameSnap}) — ${_fmt(li.unitPriceSnap)}`),
    ``,
    `*Total: ${_fmt(inv.grandTotal)}*`,
    `Payment: ${inv.paymentMethod}`,
  ].filter(Boolean).join('\n');

  const badgeCls = s => s==='PAID'?'badge--active':s==='REFUNDED'?'badge--refunded':'badge--partially-refunded';
  const badgeLbl = s => s==='PAID'?'Paid':s==='REFUNDED'?'Refunded':'Partially Refunded';
  const canRefund = inv.status === 'PAID';

  overlay.innerHTML = `
    <div class="modal modal--sm" style="max-width:460px;">
      <div class="modal__header">
        <div class="modal__title">${_esc(inv.invoiceNumber??'')} <span class="badge badge--no-dot ${badgeCls(inv.status)}" style="font-size:11px;vertical-align:middle;">${badgeLbl(inv.status)}</span></div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body" style="font-size:var(--text-sm);">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-3);color:var(--clr-text-secondary);">
          <span>${dateStr}</span><span>${_esc(custName)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid var(--clr-border);">
            <th style="padding:4px 0;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">#</th>
            <th style="padding:4px 8px;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">Service</th>
            <th style="padding:4px 8px;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:left;">By</th>
            <th style="padding:4px 0;font-size:var(--text-xs);color:var(--clr-text-muted);text-align:right;">Price</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="border-top:1px solid var(--clr-border);margin-top:var(--sp-3);padding-top:var(--sp-3);display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${_fmt(inv.subtotal)}</span></div>
          ${(inv.discountAmount??0)>0?`<div style="display:flex;justify-content:space-between;color:var(--clr-danger);"><span>${_esc(inv.discountOfferSnap??'Discount')}</span><span>−${_fmt(inv.discountAmount)}</span></div>`:''}
          ${inv.gstEnabled?`<div style="display:flex;justify-content:space-between;color:var(--clr-text-muted);font-size:var(--text-xs);"><span>CGST (9%)</span><span>${_fmt(inv.cgstAmount)}</span></div><div style="display:flex;justify-content:space-between;color:var(--clr-text-muted);font-size:var(--text-xs);"><span>SGST (9%)</span><span>${_fmt(inv.sgstAmount)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;font-size:var(--text-md);font-weight:700;border-top:1px solid var(--clr-border);padding-top:var(--sp-2);margin-top:4px;">
            <span>Grand Total</span><span style="color:var(--clr-primary);">${_fmt(inv.grandTotal)}</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--clr-text-muted);">Payment: ${inv.paymentMethod}</div>
        </div>
      </div>
      <div class="modal__footer">
        ${canRefund?`<button class="btn btn--ghost" id="do-refund" style="color:var(--clr-danger);border-color:var(--clr-danger);">Refund</button>`:''}
        <a class="btn btn--ghost" href="https://wa.me/91${_esc(custPh)}?text=${encodeURIComponent(waLines)}" target="_blank" rel="noopener" style="text-decoration:none;">WhatsApp</a>
        <button class="btn btn--primary" id="det-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close')?.addEventListener('click', close);
  overlay.querySelector('#det-close')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });
  if (canRefund) {
    overlay.querySelector('#do-refund')?.addEventListener('click', () => { close(); _openRefundModal(inv, custMap); });
  }
}

// ── Refund Modal ───────────────────────────────────────────────────────────────
function _openRefundModal(inv, custMap) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--sm">
      <div class="modal__header">
        <div class="modal__title">Process Refund</div>
        <button class="modal__close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="modal__body">
        <div style="font-size:var(--text-sm);color:var(--clr-text-secondary);margin-bottom:var(--sp-4);">
          ${_esc(inv.invoiceNumber??'')} — Total: <strong>${_fmt(inv.grandTotal)}</strong>
        </div>
        <div class="form-group">
          <label class="form-label">Refund Type</label>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;font-size:var(--text-sm);">
              <input type="radio" name="rtype" value="FULL" checked /> Full Refund (${_fmt(inv.grandTotal)})
            </label>
            <label style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer;font-size:var(--text-sm);">
              <input type="radio" name="rtype" value="PARTIAL" /> Partial Refund
            </label>
          </div>
        </div>
        <div class="form-group" id="partial-grp" style="display:none;">
          <label class="form-label">Refund Amount (₹) <span class="required">*</span></label>
          <input class="form-input" id="r-amount" type="number" min="1" step="1" placeholder="Min ₹1" />
        </div>
        <div class="form-group">
          <label class="form-label">Reason <span class="required">*</span></label>
          <textarea class="form-input" id="r-reason" rows="3" maxlength="500" placeholder="Required — max 500 characters"></textarea>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--ghost" id="r-cancel">Cancel</button>
        <button class="btn btn--primary" id="r-confirm" style="background:var(--clr-danger);border-color:var(--clr-danger);">Confirm Refund</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons({ nodes: [overlay] });

  const close = () => { if (!overlay.isConnected) return; overlay.remove(); };
  overlay.querySelector('.modal__close')?.addEventListener('click', close);
  overlay.querySelector('#r-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function _esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', _esc); }
  });

  overlay.querySelectorAll('[name="rtype"]').forEach(r => r.addEventListener('change', () => {
    const partial = overlay.querySelector('[name="rtype"]:checked')?.value === 'PARTIAL';
    document.getElementById('partial-grp').style.display = partial ? '' : 'none';
  }));

  overlay.querySelector('#r-confirm')?.addEventListener('click', async () => {
    const type   = overlay.querySelector('[name="rtype"]:checked')?.value ?? 'FULL';
    const reason = document.getElementById('r-reason')?.value?.trim() ?? '';
    const rawAmt = parseFloat(document.getElementById('r-amount')?.value ?? '0');

    if (!reason) { toast.error('Reason is required.'); return; }

    let amount = inv.grandTotal;
    if (type === 'PARTIAL') {
      if (!rawAmt || rawAmt < 1)        { toast.error('Enter a valid refund amount (min ₹1).'); return; }
      if (rawAmt >= inv.grandTotal)     { toast.error('Partial refund must be less than grand total. Use Full Refund instead.'); return; }
      amount = rawAmt;
    }

    const btn = overlay.querySelector('#r-confirm');
    btn.disabled = true;
    try {
      const refundNumber = await _nextRefNum();
      await processRefund(inv.id, { type, amount, reason, refundNumber, processedAt: new Date().toISOString() });
      close();
      toast.success(`Refund processed — ${refundNumber}`);
      const view = document.getElementById('billing-view');
      if (view && _tab === 'history') _renderHistory(view);
    } catch {
      toast.error('Failed to process refund.');
      btn.disabled = false;
    }
  });
}

// ── Cart persistence ───────────────────────────────────────────────────────────
function _saveCart() {
  try {
    localStorage.setItem('salon_cart', JSON.stringify({
      customerId:    _customer?.id ?? null,
      cart:          _cart,
      discountMode:  _discountMode,
      discountType:  _discountType,
      discountValue: _discountValue,
      selectedOffer: _selectedOffer,
      paymentMethod: _paymentMethod,
    }));
  } catch {}
}

async function _restoreCart() {
  try {
    const raw = localStorage.getItem('salon_cart');
    if (!raw) return;
    const d        = JSON.parse(raw);
    _cart          = d.cart          ?? [];
    _discountMode  = d.discountMode  ?? 'NONE';
    _discountType  = d.discountType  ?? 'PERCENTAGE';
    _discountValue = d.discountValue ?? 0;
    _selectedOffer = d.selectedOffer ?? null;
    _paymentMethod = d.paymentMethod ?? null;
    if (d.customerId) _customer = await getCustomerWithStats(d.customerId);
  } catch {}
}

function _clearCartState() {
  _cart = []; _discountMode = 'NONE'; _discountValue = 0;
  _selectedOffer = null; _paymentMethod = null;
  _saveCart();
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
