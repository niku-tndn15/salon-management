/**
 * api.js - Backend API client for M12 integration.
 * The app keeps Dexie as its local cache; this module owns HTTP concerns.
 */

const DEFAULT_API_BASE_URL = 'https://salon-management-9b29.onrender.com/api';
const TOKEN_KEY = 'salon_token';
const API_BASE_KEY = 'salon_api_base_url';

export class APIError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiBaseUrl() {
  const fromWindow = globalThis.window?.SALON_API_BASE_URL;
  const fromStorage = _safeStorageGet(localStorage, API_BASE_KEY);
  return String(fromWindow || fromStorage || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export function setApiBaseUrl(url) {
  localStorage.setItem(API_BASE_KEY, String(url || '').replace(/\/+$/, ''));
}

export function getToken() {
  return _safeStorageGet(sessionStorage, TOKEN_KEY);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function hasBackendSession() {
  return Boolean(getToken());
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const init = {
    ...options,
    headers,
  };

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (err) {
    throw new APIError('Backend is unavailable. Using local data if available.', {
      code: 'NETWORK_ERROR',
      details: err,
    });
  }

  const payload = await _readJson(response);
  if (!response.ok || payload?.success === false) {
    throw new APIError(payload?.message || payload?.error?.message || response.statusText || 'API request failed', {
      status: response.status,
      code: payload?.code || payload?.error?.code || 'API_ERROR',
      details: payload?.details || payload?.error?.details || payload,
    });
  }

  return payload;
}

function _query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, value);
  });
  const str = q.toString();
  return str ? `?${str}` : '';
}

async function _readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text };
  }
}

function _safeStorageGet(storage, key) {
  try {
    return storage?.getItem(key) || '';
  } catch {
    return '';
  }
}

export const api = {
  auth: {
    async login(username, password) {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      return res.data;
    },
    async config() {
      const res = await apiFetch('/auth/config');
      return res.data;
    },
    async dummyLogin() {
      const res = await apiFetch('/auth/dummy-login', { method: 'POST' });
      return res.data;
    },
    async me() {
      const res = await apiFetch('/auth/me');
      return res.data;
    },
    async logout() {
      return apiFetch('/auth/logout', { method: 'POST' });
    },
    async changePassword(currentPassword, newPassword) {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      return res.data;
    },
  },

  catalog: {
    async categories() {
      const res = await apiFetch('/catalog/categories');
      return res.data.categories;
    },
    async services(params = {}) {
      const res = await apiFetch(`/catalog/services${_query(params)}`);
      return res.data.services;
    },
    async createService(payload) {
      const res = await apiFetch('/catalog/services', { method: 'POST', body: payload });
      return res.data.service;
    },
    async updateService(id, payload) {
      const res = await apiFetch(`/catalog/services/${id}`, { method: 'PUT', body: payload });
      return res.data.service;
    },
    async updateServiceStatus(id, status) {
      const res = await apiFetch(`/catalog/services/${id}/status`, { method: 'PATCH', body: { status } });
      return res.data.service;
    },
    async deleteService(id) {
      const res = await apiFetch(`/catalog/services/${id}`, { method: 'DELETE' });
      return res.data;
    },
  },

  customers: {
    async list(params = {}) {
      const res = await apiFetch(`/customers${_query(params)}`);
      return res.data.customers;
    },
    async create(payload) {
      const res = await apiFetch('/customers', { method: 'POST', body: payload });
      return res.data.customer;
    },
    async get(id) {
      const res = await apiFetch(`/customers/${id}`);
      return res.data.customer;
    },
    async update(id, payload) {
      const res = await apiFetch(`/customers/${id}`, { method: 'PUT', body: payload });
      return res.data.customer;
    },
    async delete(id) {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      return res.data;
    },
    async visits(id, params = {}) {
      const res = await apiFetch(`/customers/${id}/visits${_query(params)}`);
      return res.data.visits;
    },
    async lapsed(thresholdDays = 45) {
      const res = await apiFetch(`/customers/reports/lapsed${_query({ threshold_days: thresholdDays, limit: 100 })}`);
      return res.data.customers;
    },
    async birthdays(daysAhead = 10) {
      const res = await apiFetch(`/customers/reports/birthdays${_query({ days_ahead: daysAhead })}`);
      return res.data.customers;
    },
  },

  invoices: {
    async create(payload) {
      const res = await apiFetch('/invoices', { method: 'POST', body: payload });
      return res.data.invoice;
    },
    async list(params = {}) {
      const res = await apiFetch(`/invoices${_query(params)}`);
      return res.data.invoices;
    },
    async get(id) {
      const res = await apiFetch(`/invoices/${id}`);
      return res.data.invoice;
    },
    async refund(id, payload) {
      const res = await apiFetch(`/invoices/${id}/refund`, { method: 'POST', body: payload });
      return res.data.refund;
    },
    async delete(id) {
      const res = await apiFetch(`/invoices/${id}`, { method: 'DELETE' });
      return res.data;
    },
  },

  staff: {
    async list(params = {}) {
      const res = await apiFetch(`/staff${_query(params)}`);
      return res.data.staff;
    },
    async create(payload) {
      const res = await apiFetch('/staff', { method: 'POST', body: payload });
      return res.data;
    },
    async update(id, payload) {
      const res = await apiFetch(`/staff/${id}`, { method: 'PUT', body: payload });
      return res.data.staff;
    },
    async updateStatus(id, status, payload = {}) {
      const res = await apiFetch(`/staff/${id}/status`, {
        method: 'PATCH',
        body: { status, ...payload },
      });
      return res.data.staff;
    },
    async updateCommission(id, commissionPct) {
      const res = await apiFetch(`/staff/${id}/commission`, {
        method: 'PUT',
        body: { commission_pct: commissionPct },
      });
      return res.data;
    },
    async delete(id) {
      const res = await apiFetch(`/staff/${id}`, { method: 'DELETE' });
      return res.data;
    },
    async performance(id, params = {}) {
      const res = await apiFetch(`/staff/${id}/performance${_query(params)}`);
      return res.data;
    },
    async commissionHistory(id) {
      const res = await apiFetch(`/staff/${id}/commission-history`);
      return res.data.history;
    },
  },

  dashboard: {
    async kpis(params = {}) {
      const res = await apiFetch(`/dashboard/kpis${_query(params)}`);
      return res.data;
    },
    async revenueTrend() {
      const res = await apiFetch('/dashboard/revenue-trend');
      return res.data.trend;
    },
    async categorySplit(params = {}) {
      const res = await apiFetch(`/dashboard/category-split${_query(params)}`);
      return res.data.categories;
    },
    async staffLeaderboard(params = {}) {
      const res = await apiFetch(`/dashboard/staff-leaderboard${_query(params)}`);
      return res.data.staff;
    },
    async topServices(params = {}) {
      const res = await apiFetch(`/dashboard/top-services${_query(params)}`);
      return res.data.services;
    },
  },

  settings: {
    async salon() {
      const res = await apiFetch('/settings/salon');
      return res.data.salon;
    },
    async updateSalon(payload) {
      const res = await apiFetch('/settings/salon', { method: 'PUT', body: payload });
      return res.data.salon;
    },
    async discounts(params = {}) {
      const res = await apiFetch(`/settings/discounts${_query(params)}`);
      return res.data.discounts;
    },
    async createDiscount(payload) {
      const res = await apiFetch('/settings/discounts', { method: 'POST', body: payload });
      return res.data.discount;
    },
    async updateDiscountStatus(id, status) {
      const res = await apiFetch(`/settings/discounts/${id}/status`, { method: 'PATCH', body: { status } });
      return res.data.discount;
    },
    async deleteDiscount(id) {
      const res = await apiFetch(`/settings/discounts/${id}`, { method: 'DELETE' });
      return res.data;
    },
  },

  users: {
    async list() {
      const res = await apiFetch('/users');
      return res.data.users;
    },
    async create(payload) {
      const res = await apiFetch('/users', { method: 'POST', body: payload });
      return res.data;
    },
    async updateStatus(id, status) {
      const res = await apiFetch(`/users/${id}/status`, { method: 'PATCH', body: { status } });
      return res.data.user;
    },
    async resetPassword(id) {
      const res = await apiFetch(`/users/${id}/reset-password`, { method: 'POST' });
      return res.data;
    },
    async delete(id) {
      const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
      return res.data;
    },
  },

  sync: {
    async pull(params = {}) {
      const res = await apiFetch(`/sync/pull${_query(params)}`);
      return res.data;
    },
    async push(deviceId, records) {
      const res = await apiFetch('/sync/push', { method: 'POST', body: { device_id: deviceId, records } });
      return res.data;
    },
  },
};

export default api;
