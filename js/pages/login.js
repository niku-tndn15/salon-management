/**
 * login.js — Login page module.
 * Registers the /login route with the router on import.
 * Authenticates against the backend API, with Dexie fallback for offline demo use.
 */

import { registerRoute, navigate } from '../router.js';
import {
  setSession, landingRoute,
  verifyPassword, checkLockout, recordFailedAttempt, resetLockout,
} from '../auth.js';
import db, { hydrateFromBackend } from '../db.js';
import api, { APIError, setToken, clearToken } from '../api.js';
import toast from '../components/toast.js';

// Register immediately so the router can use it on first load
registerRoute('/login', _renderLogin);

// ── Render ────────────────────────────────────────────────────────────────────

async function _renderLogin() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div class="login-page">

      <!-- Left: brand panel -->
      <div class="login-page__brand">
        <a class="login-page__logo" href="#">
          <div class="login-page__logo-icon">
            <i data-lucide="scissors"></i>
          </div>
          Glamour Studio
        </a>

        <div class="login-page__tagline">
          <h1>Manage your salon smarter</h1>
          <p>Billing, staff performance, customer insights — all in one place.</p>
        </div>

        <p class="login-page__brand-footer">© 2026 Glamour Studio</p>
      </div>

      <!-- Right: form panel -->
      <div class="login-page__form-panel">
        <form id="login-form" class="login-form" novalidate autocomplete="on">

          <div class="login-form__header">
            <h2 class="login-form__title">Welcome back</h2>
            <p class="login-form__subtitle">Sign in to continue</p>
          </div>

          <div class="login-form__fields">
            <div>
              <label for="login-username" class="form-label">Username</label>
              <input
                id="login-username"
                class="form-input"
                type="text"
                autocomplete="username"
                placeholder="Enter your username"
                spellcheck="false"
              />
            </div>

            <div>
              <label for="login-password" class="form-label">Password</label>
              <div style="position:relative;">
                <input
                  id="login-password"
                  class="form-input"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Enter your password"
                  style="padding-right:44px;"
                />
                <button
                  type="button"
                  id="toggle-pwd"
                  aria-label="Show password"
                  style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--clr-text-muted);padding:0;display:flex;align-items:center;"
                >
                  <i data-lucide="eye" style="width:16px;height:16px;stroke:currentColor;"></i>
                </button>
              </div>
            </div>

            <div id="login-error" class="login-error" hidden>
              <i data-lucide="alert-circle"></i>
              <span id="login-error-msg"></span>
            </div>

            <div id="login-lockout" class="login-lockout" hidden>
              Account locked — try again in <span id="lockout-timer"></span>
            </div>
          </div>

          <button type="submit" id="login-submit" class="btn btn--primary login-form__submit">
            Sign in
          </button>

          <div id="dummy-login-wrap" hidden>
            <div class="login-form__divider"><span>or</span></div>

            <button type="button" id="dummy-login" class="btn btn--primary login-form__submit">
              Dummy Login
            </button>
          </div>

        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  _wireForm();
  _maybeShowDummyLogin();
}

// Reveal the beta dummy-login button only if the backend says it's enabled.
// Fail-closed: any error (flag off, old backend, network down) leaves it hidden.
async function _maybeShowDummyLogin() {
  try {
    const { dummyLoginEnabled } = await api.auth.config();
    if (dummyLoginEnabled) {
      document.getElementById('dummy-login-wrap')?.removeAttribute('hidden');
    }
  } catch {
    /* keep hidden */
  }
}

// ── Form logic ────────────────────────────────────────────────────────────────

let _lockoutInterval = null;

function _wireForm() {
  // Password visibility toggle
  document.getElementById('toggle-pwd')?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    const icon  = document.querySelector('#toggle-pwd i');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    if (icon) icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
    if (window.lucide) window.lucide.createIcons({ nodes: [document.getElementById('toggle-pwd')] });
  });

  // Form submit
  document.getElementById('login-form')?.addEventListener('submit', _handleSubmit);

  // Beta dummy login (instant owner access)
  document.getElementById('dummy-login')?.addEventListener('click', _handleDummyLogin);
}

async function _handleDummyLogin() {
  const btn = document.getElementById('dummy-login');
  _clearError();

  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    const data = await api.auth.dummyLogin();
    setToken(data.token);
    setSession(data.user, data.token);

    try {
      await hydrateFromBackend();
    } catch (err) {
      console.warn('Dummy login succeeded, but cache hydrate failed:', err);
    }

    toast.success('Dummy login', `You're in as ${data.user.name} (Owner).`);
    document.dispatchEvent(new CustomEvent('salon:login', { detail: { user: data.user } }));
    navigate(landingRoute(data.user.role));
  } catch (err) {
    console.error('Dummy login error:', err);
    if (err instanceof APIError && ['NETWORK_ERROR', 'DB_NOT_CONFIGURED', 'DB_UNAVAILABLE'].includes(err.code)) {
      _showError('Can’t reach the server for dummy login. Check your connection and try again.');
    } else {
      _showError(err?.message || 'Dummy login failed. Please try again.');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

async function _handleSubmit(e) {
  e.preventDefault();

  const username = document.getElementById('login-username')?.value.trim()  ?? '';
  const password = document.getElementById('login-password')?.value          ?? '';
  const btn      = document.getElementById('login-submit');

  _clearError();

  if (!username || !password) {
    _showError('Please enter your username and password.');
    return;
  }

  // Check lockout before hitting DB
  const lockout = checkLockout(username);
  if (lockout.locked) {
    _startLockoutCountdown(lockout.remaining);
    return;
  }

  // Disable button while processing
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    const backendLogin = await _tryBackendLogin(username, password);
    if (backendLogin.handled) return;

    // The backend could not be reached. Fall back to local cache ONLY if valid
    // offline credentials exist on this device — otherwise tell the user it's a
    // connectivity problem, never "invalid password" (which is misleading and
    // is what made fresh PCs fail even with the correct password).
    const user = await db.users.where('username').equals(username).first();

    if (user && user.status === 'ACTIVE' && verifyPassword(password, user.passwordHash)) {
      // ── Offline success ──
      resetLockout(username);

      const sessionUser = { id: user.id, name: user.name, username: user.username, role: user.role };
      clearToken();
      setSession(sessionUser, 'local');

      toast.success('Signed in (offline)', `Welcome back, ${user.name.split(' ')[0]}!`);
      document.dispatchEvent(new CustomEvent('salon:login', { detail: { user: sessionUser } }));
      navigate(landingRoute(user.role));
      return;
    }

    if (user && user.status !== 'ACTIVE') {
      _showError('This account has been deactivated. Contact the salon owner.');
      return;
    }

    // Server unreachable and no verified offline credentials on this device.
    _showError('Can’t reach the server. Check your internet connection and try again.');

  } catch (err) {
    console.error('Login error:', err);
    _showError('Something went wrong. Please try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
}

async function _tryBackendLogin(username, password) {
  try {
    const data = await api.auth.login(username, password);
    setToken(data.token);
    setSession(data.user, data.token);
    resetLockout(username);

    try {
      await hydrateFromBackend();
    } catch (err) {
      console.warn('Backend login succeeded, but cache hydrate failed:', err);
      toast.warning('Signed in', 'Backend connected. Some local cache data may refresh as you browse.');
    }

    toast.success('Signed in', `Welcome back, ${data.user.name.split(' ')[0]}!`);
    document.dispatchEvent(new CustomEvent('salon:login', { detail: { user: data.user } }));
    navigate(landingRoute(data.user.role));
    return { handled: true };
  } catch (err) {
    if (err instanceof APIError && ['NETWORK_ERROR', 'DB_NOT_CONFIGURED', 'DB_UNAVAILABLE'].includes(err.code)) {
      return { handled: false };
    }

    if (err instanceof APIError) {
      // 401 = wrong credentials → count down the client-side attempts.
      // Anything else (e.g. 423 ACCOUNT_LOCKED, 429, 5xx) → show as-is, do not
      // penalise the user's attempt counter for a server-side condition.
      if (err.status === 401) {
        _handleFailure(username, null);
      } else {
        _showError(err.message || 'Login failed. Please try again.');
      }
      return { handled: true };
    }

    throw err;
  }
}

function _handleFailure(username, overrideMsg) {
  const result = recordFailedAttempt(username);
  if (result.locked) {
    _startLockoutCountdown(15 * 60);
  } else {
    const left = result.attemptsLeft;
    _showError(overrideMsg ?? `Invalid username or password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`);
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _showError(msg) {
  const el  = document.getElementById('login-error');
  const txt = document.getElementById('login-error-msg');
  if (el)  el.hidden = false;
  if (txt) txt.textContent = msg;
}

function _clearError() {
  const el = document.getElementById('login-error');
  if (el) el.hidden = true;
}

function _startLockoutCountdown(seconds) {
  const lockoutEl = document.getElementById('login-lockout');
  const timerEl   = document.getElementById('lockout-timer');
  const errorEl   = document.getElementById('login-error');
  const btn       = document.getElementById('login-submit');

  if (errorEl)  errorEl.hidden   = true;
  if (lockoutEl) lockoutEl.hidden = false;
  if (btn)       btn.disabled     = true;

  clearInterval(_lockoutInterval);

  let remaining = seconds;
  const _fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (timerEl) timerEl.textContent = _fmt(remaining);

  _lockoutInterval = setInterval(() => {
    remaining -= 1;
    if (timerEl) timerEl.textContent = _fmt(remaining);
    if (remaining <= 0) {
      clearInterval(_lockoutInterval);
      if (lockoutEl) lockoutEl.hidden = true;
      if (btn)       btn.disabled     = false;
    }
  }, 1000);
}
