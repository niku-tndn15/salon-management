/**
 * db.js — Dexie.js (IndexedDB) schema, seed data, and query helpers.
 * All page modules import named helpers from this file.
 * initDB() is called once at boot (app.js); seeds on first run.
 */

import api, { APIError, hasBackendSession } from './api.js';

const db = new Dexie('SalonDB');

db.version(1).stores({
  salonProfile:             '++id',
  users:                    '++id, username, role, status',
  customers:                '++id, phone, status, referralSource',
  serviceCategories:        '++id, name',
  services:                 '++id, categoryId, status, name',
  staff:                    '++id, phone, status',
  commissionRateHistory:    '++id, staffId, effectiveFrom',
  invoices:                 '++id, invoiceNumber, customerId, invoiceDate, status, paymentMethod, createdBy, syncStatus',
  invoiceLineItems:         '++id, invoiceId, serviceId, professionalId',
  refunds:                  '++id, invoiceId',
  predefinedDiscountOffers: '++id, status',
  syncQueue:                '++id, entityType, entityId, syncStatus',
});

export default db;

// Backend integration helpers. Dexie remains the local cache/fallback.

function _apiEnabled() {
  return hasBackendSession() && navigator.onLine !== false && localStorage.getItem('salon_api_mode') !== 'local';
}

function _canFallback(err) {
  return err instanceof APIError && ['NETWORK_ERROR', 'DB_NOT_CONFIGURED', 'DB_UNAVAILABLE'].includes(err.code);
}

async function _apiOrLocal(apiFn, localFn) {
  if (!_apiEnabled()) return localFn();
  try {
    return await apiFn();
  } catch (err) {
    if (_canFallback(err)) {
      console.warn('Backend unavailable, using local cache:', err.message);
      return localFn();
    }
    throw err;
  }
}

function _toDateOnly(value, fallback = '1990-01-01') {
  if (!value) return fallback;
  return String(value).split('T')[0];
}

function _mapGenderToApi(value) {
  const v = String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  return ({ MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER', PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY' }[v]) || 'PREFER_NOT_TO_SAY';
}

function _mapReferralToApi(value) {
  const v = String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  return ({
    WALK_IN: 'WALK_IN',
    WALKIN: 'WALK_IN',
    FRIEND_REFERRAL: 'FRIEND_REFERRAL',
    INSTAGRAM: 'INSTAGRAM',
    GOOGLE: 'GOOGLE',
    FACEBOOK: 'FACEBOOK',
    OTHER: 'OTHER',
  }[v]) || 'OTHER';
}

function _labelGender(value) {
  return ({ MALE: 'Male', FEMALE: 'Female', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say' }[value]) || value || null;
}

function _labelReferral(value) {
  return ({
    WALK_IN: 'Walk-in',
    FRIEND_REFERRAL: 'Friend Referral',
    INSTAGRAM: 'Instagram',
    GOOGLE: 'Google',
    FACEBOOK: 'Facebook',
    OTHER: 'Other',
  }[value]) || value || null;
}

function _customerFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    gender: _labelGender(c.gender),
    dateOfBirth: _toDateOnly(c.date_of_birth, null),
    referralSource: _labelReferral(c.referral_source),
    notes: c.notes ?? '',
    status: c.status ?? 'ACTIVE',
    syncStatus: 'SYNCED',
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    totalSpend: Number(c.lifetime_spend ?? c.total_spend ?? 0),
    visitCount: Number(c.total_visits ?? c.visit_count ?? 0),
    lastVisit: c.last_visit_date ?? c.last_visit ?? null,
    avgSpend: Number(c.average_spend ?? c.avg_spend ?? 0),
    daysSince: c.days_since_last_visit ?? c.days_since ?? null,
    daysUntilBirthday: c.days_until_birthday ?? _daysUntil(c.next_birthday) ?? null,
    birthdayDate: _toDateOnly(c.birthday_date ?? c.next_birthday, null),
  };
}

function _customerToApi(data) {
  return {
    name: data.name,
    phone: data.phone,
    gender: _mapGenderToApi(data.gender),
    date_of_birth: _toDateOnly(data.dateOfBirth),
    referral_source: _mapReferralToApi(data.referralSource),
    notes: data.notes || '',
  };
}

function _categoryFromApi(c) {
  return { id: c.id, name: c.name, createdAt: c.created_at };
}

function _serviceFromApi(s) {
  const status = String(s.status || '').toLowerCase() === 'active' ? 'ACTIVE'
    : String(s.status || '').toLowerCase() === 'inactive' ? 'INACTIVE'
    : s.status;
  return {
    id: s.id,
    name: s.name,
    categoryId: s.category_id,
    categoryName: s.category_name,
    price: Number(s.price ?? 0),
    durationMin: Number(s.duration_minutes ?? s.durationMin ?? 0),
    description: s.description ?? '',
    status,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function _staffFromApi(s) {
  return {
    id: s.id ?? s.staff_id,
    userId: s.user_id,
    username: s.username,
    name: s.name,
    phone: s.phone,
    designation: s.designation,
    joinDate: _toDateOnly(s.join_date, null),
    commissionPct: Number(s.commission_pct ?? s.current_rate ?? 0),
    status: s.status,
    syncStatus: 'SYNCED',
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    totalRevenue: Number(s.total_revenue ?? 0),
    totalCommission: Number(s.total_commission ?? 0),
    serviceCount: Number(s.service_count ?? 0),
  };
}

function _commissionFromApi(row) {
  return {
    id: row.id,
    staffId: row.staff_id,
    commissionPct: Number(row.commission_pct ?? 0),
    effectiveFrom: _toDateOnly(row.effective_from, ''),
    effectiveTo: row.effective_to ? _toDateOnly(row.effective_to, '') : null,
  };
}

function _invoiceFromApi(i) {
  return {
    id: i.id,
    invoiceNumber: i.invoice_number,
    customerId: i.customer_id,
    customerName: i.customer_name,
    customerPhone: i.customer_phone,
    invoiceDate: i.invoice_date || i.created_at,
    status: i.status,
    paymentMethod: i.payment_method,
    subtotal: Number(i.subtotal ?? 0),
    discountType: i.discount_type === 'NONE' ? null : i.discount_type,
    discountValue: Number(i.discount_value ?? 0),
    discountAmount: Number(i.discount_amount ?? 0),
    discountOfferSnap: i.discount_offer_snap ?? null,
    taxableAmount: Number(i.taxable_amount ?? 0),
    gstEnabled: Boolean(i.gst_enabled),
    cgstAmount: Number(i.cgst_amount ?? 0),
    sgstAmount: Number(i.sgst_amount ?? 0),
    grandTotal: Number(i.grand_total ?? 0),
    gstinSnap: i.gstin_snap,
    createdBy: i.created_by,
    syncStatus: 'SYNCED',
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

function _lineItemFromApi(li, invoiceId) {
  return {
    id: li.id,
    invoiceId,
    serviceId: li.service_id,
    serviceNameSnap: li.service_name_snap,
    unitPriceSnap: Number(li.unit_price_snap ?? 0),
    quantity: Number(li.quantity ?? 1),
    professionalId: li.professional_id,
    professionalNameSnap: li.professional_name_snap,
    commissionPctSnap: Number(li.commission_pct_snap ?? 0),
  };
}

function _offerFromApi(o) {
  return {
    id: o.id,
    name: o.name,
    discountType: o.discount_type,
    discountValue: Number(o.discount_value ?? 0),
    status: o.status,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

function _userFromApi(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.full_name ?? u.name,
    role: u.role,
    status: u.status,
    staffId: u.staff_id ?? u.staffId ?? null,
    failedAttempts: Number(u.failed_attempts ?? u.failedAttempts ?? 0),
    lockedUntil: u.locked_until ?? u.lockedUntil ?? null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLoginAt: u.last_login_at ?? null,
  };
}

function _salonFromApi(s) {
  if (!s) return null;
  return {
    id: s.id || 1,
    name: s.name,
    address: s.address,
    phone: s.phone,
    email: s.email,
    gstin: s.gstin,
    gstEnabled: Boolean(s.gst_enabled),
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function _salonToApi(data) {
  // Only include fields explicitly provided so partial saves (e.g. just the
  // salon name, or just GST settings) don't blank out the other fields.
  const out = {};
  if (data.name !== undefined)       out.name        = data.name;
  if (data.address !== undefined)    out.address     = data.address || '';
  if (data.phone !== undefined)      out.phone       = data.phone || '';
  if (data.email !== undefined)      out.email       = data.email || '';
  if (data.gstin !== undefined)      out.gstin       = data.gstin || '';
  if (data.gstEnabled !== undefined) out.gst_enabled = Boolean(data.gstEnabled);
  return out;
}

const SALON_NAME_KEY = 'salon_name';

function _persistSalonName(name) {
  if (!name) return;
  try {
    if (localStorage.getItem(SALON_NAME_KEY) !== name) {
      localStorage.setItem(SALON_NAME_KEY, name);
    }
  } catch { /* ignore storage errors */ }
  document.dispatchEvent(new CustomEvent('salon:profile-updated', { detail: { name } }));
}

export function getCachedSalonName() {
  try {
    return localStorage.getItem(SALON_NAME_KEY) || 'Glamour Salon';
  } catch {
    return 'Glamour Salon';
  }
}

async function _cacheCustomers(customers) {
  const rows = customers.map(_customerFromApi).filter(Boolean);
  if (rows.length) {
    try {
      await db.customers.bulkPut(rows);
    } catch (err) {
      console.warn('Customer cache update failed:', err);
    }
  }
  return rows;
}

async function _cacheInvoices(invoices) {
  const rows = invoices.map(_invoiceFromApi);
  if (rows.length) await db.invoices.bulkPut(rows);
  return rows;
}

async function _cacheInvoiceDetail(invoice) {
  const row = _invoiceFromApi(invoice);
  await db.invoices.put(row);
  const items = (invoice.line_items || invoice.lineItems || []).map(li => _lineItemFromApi(li, row.id));
  if (items.length) await db.invoiceLineItems.bulkPut(items);
  return { ...row, lineItems: items };
}

function _dateParam(value) {
  return String(value || '').split('T')[0];
}

function _daysUntil(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(_toDateOnly(value, ''));
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

function _deviceId() {
  let id = localStorage.getItem('salon_device_id');
  if (!id) {
    id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('salon_device_id', id);
  }
  return id;
}

function _hashPassword(plain) {
  let h = 5381;
  for (let i = 0; i < plain.length; i++) h = Math.imul(h, 33) ^ plain.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function _temporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const random = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(10)), n => chars[n % chars.length])
    : Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]);
  return random.join('');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

export async function initDB() {
  await db.open();
  if (!localStorage.getItem('salon_db_seeded')) {
    await _seedDatabase();
    localStorage.setItem('salon_db_seeded', '1');
  }
}

export async function hydrateFromBackend() {
  if (!_apiEnabled()) return { skipped: true };

  const [categories, services, discounts, customers, invoices, syncData, salon] = await Promise.all([
    api.catalog.categories(),
    api.catalog.services({ limit: 100 }),
    api.settings.discounts({ limit: 100 }),
    api.customers.list({ limit: 100 }),
    api.invoices.list({ limit: 100 }),
    api.sync.pull({ device_id: _deviceId() }),
    api.settings.salon().catch(err => {
      if (err?.status === 403) return null;
      throw err;
    }),
  ]);

  await db.transaction(
    'rw',
    db.serviceCategories,
    db.services,
    db.staff,
    db.predefinedDiscountOffers,
    db.customers,
    db.invoices,
    db.salonProfile,
    async () => {
      await db.serviceCategories.bulkPut(categories.map(_categoryFromApi));
      await db.services.bulkPut(services.map(_serviceFromApi));
      await db.staff.bulkPut((syncData.staff || []).map(_staffFromApi));
      await db.predefinedDiscountOffers.bulkPut(discounts.map(_offerFromApi));
      await _cacheCustomers(customers);
      await _cacheInvoices(invoices);
      if (salon) await db.salonProfile.put(_salonFromApi(salon));
    }
  );

  if (salon?.name) _persistSalonName(salon.name);

  localStorage.setItem('salon_last_backend_sync', new Date().toISOString());
  return {
    skipped: false,
    categories: categories.length,
    services: services.length,
    staff: (syncData.staff || []).length,
    discounts: discounts.length,
    customers: customers.length,
    invoices: invoices.length,
  };
}

// ── Customer helpers ──────────────────────────────────────────────────────────

export async function findCustomerByPhone(phone) {
  return _apiOrLocal(async () => {
    const rows = await api.customers.list({ phone: String(phone), limit: 1 });
    const cached = await _cacheCustomers(rows);
    return cached[0] || null;
  }, () => db.customers.where('phone').equals(String(phone)).first());
}

export async function getActiveCustomers(limit = 100) {
  return _apiOrLocal(async () => {
    const rows = await api.customers.list({ limit });
    return _cacheCustomers(rows);
  }, () => db.customers.where('status').equals('ACTIVE').toArray());
}

export async function createCustomer(data) {
  if (_apiEnabled()) {
    const customer = await api.customers.create(_customerToApi(data));
    const [cached] = await _cacheCustomers([customer]);
    return cached?.id || customer.id;
  }

  const now = new Date().toISOString();
  return db.transaction('rw', db.customers, db.syncQueue, async () => {
    const customerId = await db.customers.add({
      ...data,
      status:     'ACTIVE',
      syncStatus: 'PENDING',
      createdAt:  now,
      updatedAt:  now,
    });
    await db.syncQueue.add({
      entityType: 'customer',
      entityId: customerId,
      operation: 'CREATE',
      payload: _customerToApi(data),
      syncStatus: 'PENDING',
      createdAt: now,
    });
    return customerId;
  });
}

export async function updateCustomer(id, data) {
  if (_apiEnabled()) {
    const customer = await api.customers.update(id, _customerToApi({ ...data, phone: data.phone || '0000000000' }));
    const [cached] = await _cacheCustomers([customer]);
    return cached.id;
  }

  return db.customers.update(id, {
    ...data,
    updatedAt:  new Date().toISOString(),
    syncStatus: 'PENDING',
  });
}

export async function deleteCustomer(id) {
  if (_apiEnabled()) {
    await api.customers.delete(id);
  }
  await db.customers.delete(id).catch(() => {});
  return { id };
}

export async function getCustomerWithStats(id) {
  return _apiOrLocal(async () => {
    const customer = await api.customers.get(id);
    const [cached] = await _cacheCustomers([customer]);
    return cached;
  }, async () => {
  const customer = await db.customers.get(id);
  if (!customer) return null;

  const invoices = await db.invoices
    .where('customerId').equals(id)
    .filter(inv => inv.status !== 'REFUNDED')
    .toArray();

  const sorted     = invoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  const totalSpend = invoices.reduce((s, i) => s + i.grandTotal, 0);

  return {
    ...customer,
    totalSpend,
    visitCount: invoices.length,
    lastVisit:  sorted[0]?.invoiceDate ?? null,
    avgSpend:   invoices.length ? totalSpend / invoices.length : 0,
  };
  });
}

export async function getLapsedCustomers(thresholdDays = 45) {
  return _apiOrLocal(async () => {
    const rows = await api.customers.lapsed(thresholdDays);
    return _cacheCustomers(rows);
  }, async () => {
  const cutoff    = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  const customers = await db.customers.where('status').equals('ACTIVE').toArray();
  const results   = [];

  for (const c of customers) {
    const invoices = await db.invoices
      .where('customerId').equals(c.id)
      .filter(inv => inv.status !== 'REFUNDED')
      .toArray();

    if (!invoices.length) continue;

    const last      = invoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))[0];
    const lastVisit = new Date(last.invoiceDate);
    if (lastVisit < cutoff) {
      const daysSince = Math.floor((Date.now() - lastVisit) / 86_400_000);
      results.push({ ...c, lastVisit: last.invoiceDate, daysSince });
    }
  }

  return results.sort((a, b) => b.daysSince - a.daysSince);
  });
}

export async function getUpcomingBirthdays(daysAhead = 7) {
  return _apiOrLocal(async () => {
    const rows = await api.customers.birthdays(daysAhead);
    const cached = await _cacheCustomers(rows);
    return cached.filter(c => Number(c.daysUntilBirthday ?? 9999) <= daysAhead);
  }, async () => {
  const customers = await db.customers.where('status').equals('ACTIVE').toArray();
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const results   = [];

  for (const c of customers) {
    if (!c.dateOfBirth) continue;
    const dob  = new Date(c.dateOfBirth);
    const bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (bday < today) bday.setFullYear(today.getFullYear() + 1);
    const daysUntil = Math.round((bday - today) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= daysAhead) {
      results.push({ ...c, daysUntilBirthday: daysUntil, birthdayDate: bday.toISOString().split('T')[0] });
    }
  }

  return results.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
  });
}

// ── Invoice helpers ───────────────────────────────────────────────────────────

export async function createInvoice(invoiceData, lineItems) {
  const apiPayload = {
    customer_id: invoiceData.customerId,
    payment_method: invoiceData.paymentMethod,
    discount_type: invoiceData.discountType || 'NONE',
    discount_value: Number(invoiceData.discountValue || 0),
    discount_offer_id: invoiceData.discountOfferId || null,
    line_items: lineItems.map(li => ({
      service_id: li.serviceId || null,
      service_name_snap: li.serviceNameSnap,
      unit_price_snap: Number(li.unitPriceSnap || li.unitPrice || 0),
      is_price_override: Boolean(li.isPriceOverride),
      quantity: Number(li.quantity || 1),
      professional_id: li.professionalId,
      professional_name_snap: li.professionalNameSnap,
    })),
  };

  if (_apiEnabled()) {
    const invoice = await api.invoices.create(apiPayload);
    const cached = await _cacheInvoiceDetail(invoice);
    return cached.id;
  }

  return db.transaction('rw', db.invoices, db.invoiceLineItems, db.syncQueue, async () => {
    const now       = new Date().toISOString();
    const invoiceId = await db.invoices.add({
      ...invoiceData,
      status:     'PAID',
      syncStatus: 'PENDING',
      createdAt:  now,
    });

    await db.invoiceLineItems.bulkAdd(lineItems.map(li => ({ ...li, invoiceId })));

    await db.syncQueue.add({
      entityType: 'invoice',
      entityId:   invoiceId,
      operation:  'CREATE',
      payload:    apiPayload,
      syncStatus: 'PENDING',
      createdAt:  now,
    });

    return invoiceId;
  });
}

export async function getInvoiceWithLineItems(invoiceId) {
  return _apiOrLocal(async () => {
    const invoice = await api.invoices.get(invoiceId);
    return _cacheInvoiceDetail(invoice);
  }, async () => {
  const invoice = await db.invoices.get(invoiceId);
  if (!invoice) return null;
  const lineItems = await db.invoiceLineItems.where('invoiceId').equals(invoiceId).toArray();
  return { ...invoice, lineItems };
  });
}

export async function getInvoicesByCustomer(customerId) {
  const all = await _apiOrLocal(async () => {
    const rows = await api.invoices.list({ search: '', limit: 100 });
    const cached = await _cacheInvoices(rows);
    return cached.filter(inv => String(inv.customerId) === String(customerId));
  }, () => db.invoices.where('customerId').equals(customerId).toArray());
  return all.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
}

export async function getInvoicesByDateRange(startDate, endDate) {
  return _apiOrLocal(async () => {
    const rows = await api.invoices.list({ start_date: _dateParam(startDate), end_date: _dateParam(endDate), limit: 100 });
    return _cacheInvoices(rows);
  }, async () => {
  const start = new Date(startDate); start.setHours(0, 0, 0, 0);
  const end   = new Date(endDate);   end.setHours(23, 59, 59, 999);
  return db.invoices
    .filter(inv => { const d = new Date(inv.invoiceDate); return d >= start && d <= end; })
    .toArray();
  });
}

export async function processRefund(invoiceId, refundData) {
  if (_apiEnabled()) {
    const refund = await api.invoices.refund(invoiceId, {
      refund_type: refundData.type,
      refund_amount: Number(refundData.amount || refundData.refundAmount || 0),
      reason: refundData.reason,
    });
    await db.invoices.update(invoiceId, {
      status: refundData.type === 'FULL' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      syncStatus: 'SYNCED',
      updatedAt: new Date().toISOString(),
    });
    await db.refunds.put({
      id: refund.id,
      invoiceId,
      refundNumber: refund.refund_number,
      type: refund.refund_type,
      amount: Number(refund.refund_amount ?? 0),
      reason: refund.reason,
      createdAt: refund.created_at,
      syncStatus: 'SYNCED',
    });
    return refund.id;
  }

  return db.transaction('rw', db.invoices, db.refunds, db.syncQueue, async () => {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const now      = new Date().toISOString();
    const refundId = await db.refunds.add({ ...refundData, invoiceId, createdAt: now, syncStatus: 'PENDING' });

    const newStatus = refundData.type === 'FULL' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await db.invoices.update(invoiceId, { status: newStatus, syncStatus: 'PENDING', updatedAt: now });

    await db.syncQueue.add({ entityType: 'refund', entityId: refundId, operation: 'CREATE', syncStatus: 'PENDING', createdAt: now });
    return refundId;
  });
}

export async function deleteInvoice(id) {
  if (_apiEnabled()) {
    await api.invoices.delete(id);
  }
  await db.transaction('rw', db.invoices, db.invoiceLineItems, db.refunds, async () => {
    await db.invoiceLineItems.where('invoiceId').equals(id).delete().catch(() => {});
    await db.refunds.where('invoiceId').equals(id).delete().catch(() => {});
    await db.invoices.delete(id).catch(() => {});
  }).catch(() => {});
  return { id };
}

// ── Staff helpers ─────────────────────────────────────────────────────────────

export async function getActiveStaff() {
  return _apiOrLocal(async () => {
    let rows;
    try {
      rows = await api.staff.list({ status: 'ACTIVE', limit: 100 });
    } catch (err) {
      if (!(err instanceof APIError && err.status === 403)) throw err;
      const pulled = await api.sync.pull({ device_id: _deviceId() });
      rows = pulled.staff || [];
    }
    const mapped = rows.map(_staffFromApi);
    if (mapped.length) await db.staff.bulkPut(mapped);
    return mapped.filter(s => s.status === 'ACTIVE');
  }, () => db.staff.where('status').equals('ACTIVE').toArray());
}

export async function getStaffDirectory() {
  return _apiOrLocal(async () => {
    const rows = await api.staff.list({ status: 'all', limit: 100 });
    const mapped = rows.map(_staffFromApi);
    if (mapped.length) await db.staff.bulkPut(mapped);
    return mapped;
  }, () => db.staff.toArray());
}

export async function createStaffMember(data) {
  if (_apiEnabled()) {
    const result = await api.staff.create({
      name: data.name,
      phone: data.phone,
      designation: data.designation,
      commission_pct: Number(data.commissionPct),
      join_date: data.joinDate,
    });
    const staff = _staffFromApi(result.staff);
    await db.staff.put(staff).catch(err => console.warn('Staff cache update failed:', err));
    await db.commissionRateHistory.put({
      staffId: staff.id,
      commissionPct: Number(data.commissionPct),
      effectiveFrom: data.joinDate,
      effectiveTo: null,
    }).catch(err => console.warn('Commission cache update failed:', err));
    return {
      staff,
      credentials: result.credentials,
    };
  }

  const now = new Date().toISOString();
  const firstName = data.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'staff';
  const suffix = data.phone.slice(-4);
  const username = `${firstName}${suffix}`;
  const tempPwd = `Salon@${suffix}`;
  const staffId = await db.staff.add({
    name: data.name,
    phone: data.phone,
    designation: data.designation,
    status: 'ACTIVE',
    syncStatus: 'PENDING',
    createdAt: now,
  });
  await db.commissionRateHistory.add({
    staffId,
    commissionPct: Number(data.commissionPct),
    effectiveFrom: data.joinDate,
    effectiveTo: null,
  });
  return {
    staff: { id: staffId, name: data.name, phone: data.phone, designation: data.designation, status: 'ACTIVE' },
    credentials: { username, temporaryPassword: tempPwd },
  };
}

export async function updateStaffStatus(id, status, payload = {}) {
  if (_apiEnabled()) {
    const staff = await api.staff.updateStatus(id, status, payload);
    const mapped = _staffFromApi(staff);
    await db.staff.put(mapped).catch(err => console.warn('Staff cache update failed:', err));
    if (mapped.userId) {
      await db.users.update(mapped.userId, { status: mapped.status, updatedAt: mapped.updatedAt }).catch(() => {});
    }
    return mapped;
  }

  await db.staff.update(id, {
    status,
    syncStatus: 'PENDING',
    updatedAt: new Date().toISOString(),
  });
  const staff = await db.staff.get(id);
  const user = await db.users.where('staffId').equals(id).first()
    ?? await db.users.filter(u => u.name === staff?.name && u.role === 'STAFF').first();
  if (user) await db.users.update(user.id, { status });
  return staff ? { ...staff, status } : null;
}

export async function updateStaff(id, data) {
  if (_apiEnabled()) {
    const staff = await api.staff.update(id, {
      name:        data.name,
      phone:       data.phone,
      designation: data.designation,
      join_date:   _toDateOnly(data.joinDate) || _toDateOnly(new Date().toISOString()),
    });
    const mapped = _staffFromApi(staff);
    await db.staff.put(mapped).catch(err => console.warn('Staff cache update failed:', err));
    return mapped;
  }

  await db.staff.update(id, {
    name:        data.name,
    phone:       data.phone,
    designation: data.designation,
    syncStatus:  'PENDING',
    updatedAt:   new Date().toISOString(),
  });
  return db.staff.get(id);
}

export async function updateStaffCommission(id, commissionPct) {
  if (_apiEnabled()) {
    const result = await api.staff.updateCommission(id, Number(commissionPct));
    if (result?.staff) {
      await db.staff.put(_staffFromApi(result.staff)).catch(() => {});
    }
    // Refresh local commission history cache from the server.
    try {
      const history = await api.staff.commissionHistory(id);
      const mapped = history.map(_commissionFromApi);
      await db.commissionRateHistory.where('staffId').equals(id).delete().catch(() => {});
      if (mapped.length) await db.commissionRateHistory.bulkPut(mapped);
    } catch { /* non-fatal cache refresh */ }
    return result;
  }
  return null;
}

export async function deleteStaffMember(id) {
  if (_apiEnabled()) {
    await api.staff.delete(id);
  }
  await db.staff.delete(id).catch(() => {});
  await db.commissionRateHistory.where('staffId').equals(id).delete().catch(() => {});
  return { id };
}

export async function getCommissionRateOnDate(staffId, dateStr) {
  if (_apiEnabled()) {
    try {
      const history = await api.staff.commissionHistory(staffId);
      const mapped = history.map(_commissionFromApi);
      if (mapped.length) await db.commissionRateHistory.bulkPut(mapped);
    } catch (err) {
      if (!_canFallback(err)) throw err;
    }
  }

  const date  = new Date(dateStr);
  const rates = await db.commissionRateHistory.where('staffId').equals(staffId).toArray();
  const match = rates
    .filter(r => new Date(r.effectiveFrom) <= date && (!r.effectiveTo || new Date(r.effectiveTo) >= date))
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return match[0]?.commissionPct ?? 0;
}

export async function getStaffPerformance(staffId, startDate, endDate) {
  return _apiOrLocal(async () => {
    const data = await api.staff.performance(staffId, {
      start_date: _dateParam(startDate),
      end_date: _dateParam(endDate),
    });
    const summary = data.summary || {};
    const lineItems = (data.line_items || []).map(li => {
      const unitPrice = Number(li.unit_price_snap ?? li.revenue ?? 0);
      const quantity = Number(li.quantity ?? 1);
      const revenue = Number(li.revenue ?? unitPrice * quantity);
      const commissionPct = Number(li.commission_pct_snap ?? li.commission_pct ?? 0);
      return {
        id: li.id,
        invoiceId: li.invoice_id,
        serviceId: li.service_id,
        serviceNameSnap: li.service_name_snap,
        professionalId: li.professional_id,
        professionalNameSnap: li.professional_name_snap,
        unitPriceSnap: unitPrice,
        quantity,
        commissionPctSnap: commissionPct,
        invoice: _invoiceFromApi(li),
        revenue,
        commission: Number(li.commission ?? revenue * (commissionPct / 100)),
      };
    });
    return {
      lineItems,
      totalRevenue: Number(data.total_revenue ?? summary.total_revenue ?? 0),
      totalCommission: Number(data.total_commission ?? summary.commission_earned ?? 0),
      serviceCount: Number(data.service_count ?? summary.total_services ?? lineItems.length),
    };
  }, async () => {
  const start     = new Date(startDate); start.setHours(0, 0, 0, 0);
  const end       = new Date(endDate);   end.setHours(23, 59, 59, 999);
  const lineItems = await db.invoiceLineItems.where('professionalId').equals(staffId).toArray();

  let totalRevenue = 0, totalCommission = 0, serviceCount = 0;
  const rows = [];

  for (const li of lineItems) {
    const invoice = await db.invoices.get(li.invoiceId);
    if (!invoice) continue;
    const d = new Date(invoice.invoiceDate);
    if (d < start || d > end || invoice.status === 'REFUNDED') continue;

    const revenue    = li.unitPriceSnap * li.quantity;
    const commission = revenue * (li.commissionPctSnap / 100);
    totalRevenue    += revenue;
    totalCommission += commission;
    serviceCount    += 1;
    rows.push({ ...li, invoice, revenue, commission });
  }

  return { lineItems: rows, totalRevenue, totalCommission, serviceCount };
  });
}

// ── Dashboard helpers ─────────────────────────────────────────────────────────

export async function getDashboardKPIs(startDate, endDate) {
  return _apiOrLocal(async () => {
    const data = await api.dashboard.kpis({ start_date: _dateParam(startDate), end_date: _dateParam(endDate) });
    const revenue = Number(data.revenue?.current ?? data.revenue?.value ?? data.total_revenue ?? data.revenue ?? 0);
    const customerCount = Number(data.customers_served?.total ?? data.customers?.current ?? data.customer_count ?? 0);
    const invoiceCount = Number(data.invoices?.current ?? data.invoice_count ?? 0);
    return {
      revenue,
      customers: customerCount,
      invoiceCount,
      avgInvoice: Number(data.average_ticket_value?.value ?? data.avg_invoice?.current ?? data.average_invoice_value ?? (customerCount ? revenue / customerCount : 0)),
    };
  }, async () => {
  const invoices = await getInvoicesByDateRange(startDate, endDate);
  const paid     = invoices.filter(i => i.status !== 'REFUNDED');
  const revenue  = paid.reduce((s, i) => s + i.grandTotal, 0);
  const cnt      = paid.length;

  return {
    revenue,
    customers:    new Set(paid.map(i => i.customerId)).size,
    invoiceCount: cnt,
    avgInvoice:   cnt ? revenue / cnt : 0,
  };
  });
}

export async function getRevenueByDay() {
  return _apiOrLocal(async () => {
    const rows = await api.dashboard.revenueTrend();
    return rows.map(r => ({ date: _toDateOnly(r.date || r.day, ''), revenue: Number(r.revenue ?? 0) }));
  }, async () => {
  const end   = new Date();
  const start = new Date(); start.setDate(start.getDate() - 30);

  const invoices = await getInvoicesByDateRange(start.toISOString(), end.toISOString());
  const byDay    = {};
  invoices
    .filter(i => i.status !== 'REFUNDED')
    .forEach(inv => {
      const day = inv.invoiceDate.split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + inv.grandTotal;
    });

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
  });
}

export async function getRevenueByCategoryForRange(startDate, endDate) {
  return _apiOrLocal(async () => {
    const rows = await api.dashboard.categorySplit({ start_date: _dateParam(startDate), end_date: _dateParam(endDate) });
    return rows.map(r => ({ name: r.category || r.name, revenue: Number(r.revenue ?? 0) }));
  }, async () => {
  const invoices   = await getInvoicesByDateRange(startDate, endDate);
  const byCategory = {};

  for (const inv of invoices.filter(i => i.status !== 'REFUNDED')) {
    const items = await db.invoiceLineItems.where('invoiceId').equals(inv.id).toArray();
    for (const li of items) {
      const svc     = await db.services.get(li.serviceId);
      const cat     = await db.serviceCategories.get(svc?.categoryId);
      const catName = cat?.name ?? 'Other';
      byCategory[catName] = (byCategory[catName] ?? 0) + li.unitPriceSnap * li.quantity;
    }
  }

  return Object.entries(byCategory).map(([name, revenue]) => ({ name, revenue }));
  });
}

export async function getStaffLeaderboard(startDate, endDate) {
  return _apiOrLocal(async () => {
    const rows = await api.dashboard.staffLeaderboard({ start_date: _dateParam(startDate), end_date: _dateParam(endDate) });
    return rows.map(row => _staffFromApi({
      ...row,
      total_revenue: row.total_revenue ?? row.revenue,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, async () => {
  const allStaff = await getActiveStaff();
  const results  = await Promise.all(
    allStaff.map(async m => ({ ...m, ...(await getStaffPerformance(m.id, startDate, endDate)) }))
  );
  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
  });
}

export async function getTopServicesForRange(startDate, endDate) {
  return _apiOrLocal(async () => {
    const rows = await api.dashboard.topServices({ start_date: _dateParam(startDate), end_date: _dateParam(endDate) });
    return rows.map(r => ({
      name: r.service_name || r.name,
      revenue: Number(r.revenue ?? 0),
      count: Number(r.service_count ?? r.count ?? 0),
    }));
  }, async () => {
    const invoices = await getInvoicesByDateRange(startDate, endDate);
    const byName = {};
    for (const inv of invoices.filter(i => i.status !== 'REFUNDED')) {
      const items = await db.invoiceLineItems.where('invoiceId').equals(inv.id).toArray();
      for (const li of items) {
        if (!byName[li.serviceNameSnap]) byName[li.serviceNameSnap] = { revenue: 0, count: 0 };
        byName[li.serviceNameSnap].revenue += li.unitPriceSnap * li.quantity;
        byName[li.serviceNameSnap].count += 1;
      }
    }
    return Object.entries(byName)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(([name, { revenue, count }]) => ({ name, revenue, count }));
  });
}

// ── Settings helpers ──────────────────────────────────────────────────────────

export async function getSalonProfile() {
  return _apiOrLocal(async () => {
    const salon = await api.settings.salon();
    const mapped = _salonFromApi(salon);
    if (mapped) {
      await db.salonProfile.put(mapped);
      _persistSalonName(mapped.name);
    }
    return mapped;
  }, async () => {
    const profile = await db.salonProfile.toCollection().first();
    if (profile?.name) _persistSalonName(profile.name);
    return profile;
  });
}

export async function updateSalonProfile(data) {
  if (_apiEnabled()) {
    const salon = await api.settings.updateSalon(_salonToApi(data));
    const mapped = _salonFromApi(salon);
    await db.salonProfile.put(mapped);
    _persistSalonName(mapped.name);
    return mapped.id;
  }

  const profile = await getSalonProfile();
  const now     = new Date().toISOString();
  if (profile) {
    await db.salonProfile.update(profile.id, { ...data, updatedAt: now });
    const updated = await db.salonProfile.get(profile.id);
    if (updated?.name) _persistSalonName(updated.name);
    return profile.id;
  }
  const id = await db.salonProfile.add({ ...data, createdAt: now });
  if (data.name) _persistSalonName(data.name);
  return id;
}

export async function getActiveDiscountOffers() {
  return _apiOrLocal(async () => {
    const discounts = await api.settings.discounts({ status: 'ACTIVE' });
    const mapped = discounts.map(_offerFromApi);
    if (mapped.length) await db.predefinedDiscountOffers.bulkPut(mapped);
    return mapped;
  }, () => db.predefinedDiscountOffers.where('status').equals('ACTIVE').toArray());
}

export async function getDiscountOffers(status = 'all') {
  return _apiOrLocal(async () => {
    const discounts = await api.settings.discounts({ status, limit: 100 });
    const mapped = discounts.map(_offerFromApi);
    if (mapped.length) await db.predefinedDiscountOffers.bulkPut(mapped);
    return mapped;
  }, async () => {
    const rows = await db.predefinedDiscountOffers.toArray();
    return status === 'all' ? rows : rows.filter(o => o.status === status);
  });
}

export async function createDiscountOffer(data) {
  if (_apiEnabled()) {
    const discount = await api.settings.createDiscount({
      name: data.name,
      discount_type: data.discountType,
      discount_value: Number(data.discountValue),
      status: data.status ?? 'ACTIVE',
    });
    const mapped = _offerFromApi(discount);
    await db.predefinedDiscountOffers.put(mapped);
    return mapped;
  }

  const id = await db.predefinedDiscountOffers.add({
    name: data.name,
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    status: data.status ?? 'ACTIVE',
  });
  return db.predefinedDiscountOffers.get(id);
}

export async function updateDiscountOfferStatus(id, status) {
  if (_apiEnabled()) {
    const discount = await api.settings.updateDiscountStatus(id, status);
    const mapped = _offerFromApi(discount);
    await db.predefinedDiscountOffers.put(mapped);
    return mapped;
  }

  await db.predefinedDiscountOffers.update(id, { status, updatedAt: new Date().toISOString() });
  return db.predefinedDiscountOffers.get(id);
}

export async function getUserAccounts() {
  return _apiOrLocal(async () => {
    const users = await api.users.list();
    const mapped = users.map(_userFromApi);
    if (mapped.length) await db.users.bulkPut(mapped);
    return mapped;
  }, () => db.users.toArray());
}

export async function createUserAccount(data) {
  if (_apiEnabled()) {
    const result = await api.users.create({
      username: data.username,
      password: data.password,
      full_name: data.name,
      role: data.role,
      status: data.status ?? 'ACTIVE',
    });
    const mapped = _userFromApi(result.user);
    await db.users.put(mapped);
    return { user: mapped, credentials: result.credentials };
  }

  const id = await db.users.add({
    name: data.name,
    username: data.username,
    role: data.role,
    passwordHash: data.passwordHash,
    status: data.status ?? 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
  });
  return { user: await db.users.get(id), credentials: null };
}

export async function updateUserAccountStatus(id, status) {
  if (_apiEnabled()) {
    const user = await api.users.updateStatus(id, status);
    const mapped = _userFromApi(user);
    await db.users.put(mapped);
    return mapped;
  }

  await db.users.update(id, { status, updatedAt: new Date().toISOString() });
  return db.users.get(id);
}

export async function deleteUserAccount(id) {
  if (_apiEnabled()) {
    await api.users.delete(id);
  }

  await db.users.delete(id);
  return { id };
}

export async function resetUserPassword(id) {
  if (_apiEnabled()) {
    const result = await api.users.resetPassword(id);
    const mapped = _userFromApi(result.user);
    await db.users.put(mapped);
    return { user: mapped, temporaryPassword: result.temporaryPassword };
  }

  const user = await db.users.get(id);
  if (!user) throw new Error('User not found');
  if (!['BILLING_PERSON', 'STAFF'].includes(user.role)) {
    throw new Error('Only billing and staff user passwords can be reset here');
  }

  const temporaryPassword = _temporaryPassword();
  await db.users.update(id, {
    passwordHash: _hashPassword(temporaryPassword),
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date().toISOString(),
  });
  return { user: await db.users.get(id), temporaryPassword };
}

export async function deleteService(id) {
  if (_apiEnabled()) {
    await api.catalog.deleteService(id);
  }
  await db.services.delete(id).catch(() => {});
  return { id };
}

export async function deleteDiscountOffer(id) {
  if (_apiEnabled()) {
    await api.settings.deleteDiscount(id);
  }
  await db.predefinedDiscountOffers.delete(id).catch(() => {});
  return { id };
}

export async function updateServiceStatus(id, status) {
  if (_apiEnabled()) {
    const apiStatus = status === 'ACTIVE' ? 'active' : 'inactive';
    const service = await api.catalog.updateServiceStatus(id, apiStatus);
    const mapped = _serviceFromApi(service);
    await db.services.put(mapped);
    return mapped;
  }

  await db.services.update(id, { status, updatedAt: new Date().toISOString() });
  return db.services.get(id);
}

export async function syncPendingRecords() {
  if (!_apiEnabled()) return { skipped: true, pushed: 0, conflicts: 0 };

  const pending = await db.syncQueue
    .where('syncStatus')
    .equals('PENDING')
    .toArray();

  const records = pending
    .filter(row => row.payload && ['customer', 'invoice'].includes(row.entityType))
    .map(row => ({
      entity_type: row.entityType,
      operation: row.operation,
      local_id: String(row.entityId),
      payload: row.payload,
    }));

  if (!records.length) return { skipped: false, pushed: 0, conflicts: 0 };

  const data = await api.sync.push(_deviceId(), records);
  const results = data.results || [];

  await db.transaction('rw', db.syncQueue, db.customers, db.invoices, db.invoiceLineItems, async () => {
    for (const result of results) {
      const queueRow = pending.find(row => String(row.entityId) === String(result.local_id));
      if (!queueRow) continue;

      if (result.status === 'PROCESSED') {
        await db.syncQueue.update(queueRow.id, {
          syncStatus: 'SYNCED',
          serverId: result.server_id,
          canonicalNumber: result.canonical_number || null,
          processedAt: new Date().toISOString(),
        });

        if (queueRow.entityType === 'customer') {
          await db.customers.update(queueRow.entityId, {
            id: result.server_id,
            syncStatus: 'SYNCED',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }

        if (queueRow.entityType === 'invoice') {
          await db.invoices.update(queueRow.entityId, {
            id: result.server_id,
            invoiceNumber: result.canonical_number,
            syncStatus: 'SYNCED',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          await db.invoiceLineItems
            .where('invoiceId')
            .equals(queueRow.entityId)
            .modify({ invoiceId: result.server_id })
            .catch(() => {});
        }
      } else {
        await db.syncQueue.update(queueRow.id, {
          syncStatus: 'CONFLICT',
          conflict: result.conflict || null,
          processedAt: new Date().toISOString(),
        });
      }
    }
  });

  return {
    skipped: false,
    pushed: results.filter(r => r.status === 'PROCESSED').length,
    conflicts: results.filter(r => r.status === 'CONFLICT').length,
  };
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function _seedDatabase() {
  // djb2 hash — same algorithm as auth.js hashPassword
  const _hash = str => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = Math.imul(h, 33) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  };

  const pwd = _hash('demo123');

  // 1 ── Salon profile
  await db.salonProfile.add({
    name:       'Glamour Salon',
    address:    'Shop 4, Anand Nagar, Bandra West, Mumbai 400050',
    phone:      '022-24987600',
    email:      'glamourstudio@example.com',
    gstin:      '27ABCDE1234F1Z5',
    gstEnabled: true,
    createdAt:  '2026-01-01T00:00:00',
  });

  // 2 ── Users
  const userIds = await db.users.bulkAdd([
    { username: 'owner',   passwordHash: pwd, name: 'Samay Raina',  role: 'OWNER',          status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
    { username: 'billing', passwordHash: pwd, name: 'Meena Patel',  role: 'BILLING_PERSON', status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
    { username: 'anita',   passwordHash: pwd, name: 'Anita Singh',  role: 'STAFF',          status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
    { username: 'ravi',    passwordHash: pwd, name: 'Ravi Kumar',   role: 'STAFF',          status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
  ], { allKeys: true });

  // 3 ── Service categories
  const catIds = await db.serviceCategories.bulkAdd([
    { name: 'Hair' }, { name: 'Skin' }, { name: 'Nails' }, { name: 'Makeup' }, { name: 'Other' },
  ], { allKeys: true });

  // 4 ── Services  (index 10 = Bridal Makeup is INACTIVE for realistic catalog)
  const serviceRows = [
    { categoryId: catIds[0], name: 'Haircut',       price: 250,  durationMin: 30,  status: 'ACTIVE'   },
    { categoryId: catIds[0], name: 'Hair Colour',   price: 1200, durationMin: 90,  status: 'ACTIVE'   },
    { categoryId: catIds[0], name: 'Hair Spa',      price: 800,  durationMin: 60,  status: 'ACTIVE'   },
    { categoryId: catIds[1], name: 'Facial',        price: 600,  durationMin: 45,  status: 'ACTIVE'   },
    { categoryId: catIds[1], name: 'Cleanup',       price: 400,  durationMin: 30,  status: 'ACTIVE'   },
    { categoryId: catIds[1], name: 'Bleach',        price: 300,  durationMin: 20,  status: 'ACTIVE'   },
    { categoryId: catIds[2], name: 'Manicure',      price: 350,  durationMin: 30,  status: 'ACTIVE'   },
    { categoryId: catIds[2], name: 'Pedicure',      price: 450,  durationMin: 45,  status: 'ACTIVE'   },
    { categoryId: catIds[2], name: 'Nail Art',      price: 200,  durationMin: 20,  status: 'ACTIVE'   },
    { categoryId: catIds[3], name: 'Party Makeup',  price: 2500, durationMin: 90,  status: 'ACTIVE'   },
    { categoryId: catIds[3], name: 'Bridal Makeup', price: 8000, durationMin: 180, status: 'INACTIVE' },
    { categoryId: catIds[4], name: 'Threading',     price: 50,   durationMin: 10,  status: 'ACTIVE'   },
  ];
  const serviceIds = await db.services.bulkAdd(serviceRows, { allKeys: true });

  // 5 ── Staff
  const staffRows = [
    { name: 'Anita Singh',   phone: '9012345678', designation: 'Senior Stylist',  status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-01-01T00:00:00' },
    { name: 'Ravi Kumar',    phone: '9123456789', designation: 'Stylist',          status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-01-01T00:00:00' },
    { name: 'Sunita Patel',  phone: '9234567890', designation: 'Nail Technician', status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-01-15T00:00:00' },
    { name: 'Deepak Sharma', phone: '9345678901', designation: 'Makeup Artist',   status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-02-01T00:00:00' },
  ];
  const staffIds = await db.staff.bulkAdd(staffRows, { allKeys: true });

  // 6 ── Commission rate history (Anita: 8→10 from May; Ravi: 12→15 from April)
  await db.commissionRateHistory.bulkAdd([
    { staffId: staffIds[0], commissionPct: 8,  effectiveFrom: '2026-01-01', effectiveTo: '2026-04-30' },
    { staffId: staffIds[0], commissionPct: 10, effectiveFrom: '2026-05-01', effectiveTo: null },
    { staffId: staffIds[1], commissionPct: 12, effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31' },
    { staffId: staffIds[1], commissionPct: 15, effectiveFrom: '2026-04-01', effectiveTo: null },
    { staffId: staffIds[2], commissionPct: 10, effectiveFrom: '2026-01-01', effectiveTo: null },
    { staffId: staffIds[3], commissionPct: 12, effectiveFrom: '2026-01-01', effectiveTo: null },
  ]);

  // 7 ── Customers  (Ria: birthday Jun 20 = 3 days away; Sunita Mehta: last visit Apr 25 = lapsed)
  const customerRows = [
    { name: 'Ria Sharma',    phone: '9800000001', gender: 'Female', dateOfBirth: '1994-06-20', referralSource: 'Walk-in',        notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-01-10T00:00:00' },
    { name: 'Amit Kumar',    phone: '9800000002', gender: 'Male',   dateOfBirth: '1988-11-09', referralSource: 'Friend Referral', notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-01-15T00:00:00' },
    { name: 'Sunita Mehta',  phone: '9800000003', gender: 'Female', dateOfBirth: '1990-06-15', referralSource: 'Instagram',       notes: 'Prefers Anita for haircuts', status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-02-01T00:00:00' },
    { name: 'Kavita Joshi',  phone: '9800000004', gender: 'Female', dateOfBirth: '1995-03-22', referralSource: 'Instagram',       notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-02-10T00:00:00' },
    { name: 'Priya Patel',   phone: '9800000005', gender: 'Female', dateOfBirth: '2000-08-10', referralSource: 'Walk-in',         notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-03-05T00:00:00' },
    { name: 'Rahul Singh',   phone: '9800000006', gender: 'Male',   dateOfBirth: '1985-12-01', referralSource: 'Friend Referral', notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-03-15T00:00:00' },
    { name: 'Nisha Agarwal', phone: '9800000007', gender: 'Female', dateOfBirth: '1992-09-18', referralSource: 'Google',          notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-04-01T00:00:00' },
    { name: 'Vikram Mehta',  phone: '9800000008', gender: 'Male',   dateOfBirth: '1990-07-25', referralSource: 'Walk-in',         notes: '',                           status: 'ACTIVE', syncStatus: 'SYNCED', createdAt: '2026-04-10T00:00:00' },
  ];
  const customerIds = await db.customers.bulkAdd(customerRows, { allKeys: true });

  // 8 ── Discount offers
  await db.predefinedDiscountOffers.bulkAdd([
    { name: 'Monsoon Special',        discountType: 'PERCENTAGE', discountValue: 10,  status: 'ACTIVE' },
    { name: 'Senior Citizen Discount', discountType: 'FLAT',      discountValue: 100, status: 'ACTIVE' },
    { name: 'Weekend Glow',           discountType: 'PERCENTAGE', discountValue: 15,  status: 'ACTIVE' },
  ]);

  // 9 ── Generate 120 invoices (30 days × 4/day) + 1 historical Sunita invoice
  const GSTIN_SNAP    = '27ABCDE1234F1Z5';
  const TIMES         = ['09:30', '11:15', '14:00', '16:30'];
  const PAYMENT_POOL  = ['CASH', 'CASH', 'CASH', 'UPI', 'UPI', 'CARD'];
  // 7 active customers (Sunita Mehta excluded from regular rotation — she's lapsed)
  const ACTIVE_CUSTS  = [customerIds[0], customerIds[1], customerIds[3], customerIds[4], customerIds[5], customerIds[6], customerIds[7]];
  // Active service indices (skip 10 = INACTIVE Bridal Makeup)
  const ACTIVE_SVCS   = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11];

  const staffNameMap  = {
    [staffIds[0]]: 'Anita Singh',
    [staffIds[1]]: 'Ravi Kumar',
    [staffIds[2]]: 'Sunita Patel',
    [staffIds[3]]: 'Deepak Sharma',
  };

  // Commission without DB lookup (avoid async in tight loop)
  const _commPct = (sid, dateStr) => {
    const d = new Date(dateStr);
    if (sid === staffIds[0]) return d < new Date('2026-05-01') ? 8  : 10;
    if (sid === staffIds[1]) return d < new Date('2026-04-01') ? 12 : 15;
    if (sid === staffIds[2]) return 10;
    if (sid === staffIds[3]) return 12;
    return 0;
  };

  // Staff assignment by service category index
  const _staffFor = (svcIdx, d, i) => {
    if (svcIdx <= 2)       return (d + i) % 2 === 0 ? staffIds[0] : staffIds[1]; // Hair → Anita/Ravi
    if (svcIdx <= 5)       return (d + i) % 2 === 0 ? staffIds[1] : staffIds[0]; // Skin → Ravi/Anita
    if (svcIdx <= 8)       return staffIds[2];                                     // Nails → Sunita Patel
    if (svcIdx === 9)      return staffIds[3];                                     // Makeup → Deepak
    return (d + i) % 2 === 0 ? staffIds[0] : staffIds[1];                         // Other → Anita/Ravi
  };

  let seq = 1;
  const invoiceRows  = [];
  const lineItemRows = [];

  for (let d = 0; d < 30; d++) {
    const dt = new Date('2026-05-18T00:00:00');
    dt.setDate(dt.getDate() + d);
    const dateStr = dt.toISOString().split('T')[0];
    const ym      = dateStr.slice(0, 7).replace('-', '');

    for (let i = 0; i < 4; i++) {
      const svcIdx  = ACTIVE_SVCS[(d * 4 + i) % ACTIVE_SVCS.length];
      const svc     = serviceRows[svcIdx];
      const svcId   = serviceIds[svcIdx];
      const staffId = _staffFor(svcIdx, d, i);
      const custId  = ACTIVE_CUSTS[(d * 4 + i) % ACTIVE_CUSTS.length];
      const pm      = PAYMENT_POOL[(d + i * 2) % PAYMENT_POOL.length];

      let discType = null, discVal = 0, discAmt = 0, discSnap = null;
      if (d > 0 && (d + i) % 7 === 0) {
        discType = 'PERCENTAGE'; discVal = 10;
        discAmt  = Math.round(svc.price * 0.1 * 100) / 100;
        discSnap = 'Monsoon Special';
      } else if (d > 0 && (d + i) % 11 === 0) {
        discType = 'FLAT'; discVal = 100;
        discAmt  = Math.min(100, svc.price);
        discSnap = 'Senior Citizen Discount';
      }

      const taxable = Math.round((svc.price - discAmt) * 100) / 100;
      const cgst    = Math.round(taxable * 0.09 * 100) / 100;
      const sgst    = Math.round(taxable * 0.09 * 100) / 100;
      const total   = Math.round((taxable + cgst + sgst) * 100) / 100;
      const dt2     = `${dateStr}T${TIMES[i]}:00`;
      const commPct = _commPct(staffId, dateStr);

      invoiceRows.push({
        invoiceNumber:   `SAL-${ym}-${String(seq).padStart(4, '0')}`,
        customerId:      custId,
        invoiceDate:     dt2,
        status:          'PAID',
        paymentMethod:   pm,
        subtotal:        svc.price,
        discountType:    discType,
        discountValue:   discVal,
        discountAmount:  discAmt,
        discountOfferSnap: discSnap,
        taxableAmount:   taxable,
        gstEnabled:      true,
        cgstAmount:      cgst,
        sgstAmount:      sgst,
        grandTotal:      total,
        gstinSnap:       GSTIN_SNAP,
        createdBy:       userIds[1],
        syncStatus:      'SYNCED',
        createdAt:       dt2,
      });

      lineItemRows.push({
        serviceId:           svcId,
        serviceNameSnap:     svc.name,
        unitPriceSnap:       svc.price,
        quantity:            1,
        professionalId:      staffId,
        professionalNameSnap: staffNameMap[staffId] ?? '',
        commissionPctSnap:   commPct,
      });

      seq++;
    }
  }

  // Sunita Mehta's last visit (2026-04-25 → >45 days → lapsed report)
  invoiceRows.push({
    invoiceNumber:    'SAL-202604-0001',
    customerId:       customerIds[2],
    invoiceDate:      '2026-04-25T11:00:00',
    status:           'PAID',
    paymentMethod:    'CARD',
    subtotal:         1200,
    discountType:     'FLAT',
    discountValue:    200,
    discountAmount:   200,
    discountOfferSnap: 'Senior Citizen Discount',
    taxableAmount:    1000,
    gstEnabled:       true,
    cgstAmount:       90,
    sgstAmount:       90,
    grandTotal:       1180,
    gstinSnap:        GSTIN_SNAP,
    createdBy:        userIds[1],
    syncStatus:       'SYNCED',
    createdAt:        '2026-04-25T11:00:00',
  });
  lineItemRows.push({
    serviceId:            serviceIds[1],
    serviceNameSnap:      'Hair Colour',
    unitPriceSnap:        1200,
    quantity:             1,
    professionalId:       staffIds[0],
    professionalNameSnap: 'Anita Singh',
    commissionPctSnap:    8, // rate before May 2026 change
  });

  // Bulk insert invoices → get IDs to attach to line items
  const invoiceIds = await db.invoices.bulkAdd(invoiceRows, { allKeys: true });

  await db.invoiceLineItems.bulkAdd(
    lineItemRows.map((li, idx) => ({ ...li, invoiceId: invoiceIds[idx] }))
  );

  // 10 ── 2 refunds: invoice index 4 (FULL) and index 14 (PARTIAL)
  const fullRefundInvId    = invoiceIds[4];
  const partialRefundInvId = invoiceIds[14];

  await db.refunds.bulkAdd([
    {
      invoiceId:    fullRefundInvId,
      refundNumber: 'REF-202605-0001',
      type:         'FULL',
      amount:       invoiceRows[4].grandTotal,
      reason:       'Customer dissatisfied with service result',
      createdAt:    '2026-05-23T10:00:00',
      syncStatus:   'SYNCED',
    },
    {
      invoiceId:    partialRefundInvId,
      refundNumber: 'REF-202605-0002',
      type:         'PARTIAL',
      amount:       100,
      reason:       'Product sensitivity — partial compensation',
      createdAt:    '2026-05-31T14:30:00',
      syncStatus:   'SYNCED',
    },
  ]);

  await db.invoices.update(fullRefundInvId,    { status: 'REFUNDED' });
  await db.invoices.update(partialRefundInvId, { status: 'PARTIALLY_REFUNDED' });
}
