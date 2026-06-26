const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const httpError = require('../utils/httpError');

const GENERIC_LOGIN_ERROR = 'Invalid username or password';

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.full_name
  };
}

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  if (err && ['ENOENT', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(err.code)) {
    throw httpError(503, 'DB_UNAVAILABLE', 'Database is unavailable');
  }
  throw err;
}

async function findActiveUserByUsername(username) {
  const result = await db.query(
    `SELECT id, username, password_hash, full_name, role, status,
            force_password_change, failed_attempts, locked_until
     FROM users
     WHERE username = $1 AND status = 'ACTIVE'`,
    [username]
  );
  return result.rows[0] || null;
}

async function findActiveUserById(id) {
  const result = await db.query(
    `SELECT id, username, full_name, role, force_password_change
     FROM users
     WHERE id = $1 AND status = 'ACTIVE'`,
    [id]
  );
  return result.rows[0] || null;
}

async function recordFailedLogin(user) {
  const failedAttempts = Number(user.failed_attempts || 0) + 1;

  if (failedAttempts >= env.LOGIN_MAX_ATTEMPTS) {
    await db.query(
      `UPDATE users
       SET failed_attempts = 0,
           locked_until = NOW() + ($1::text || ' minutes')::interval,
           updated_at = NOW()
       WHERE id = $2`,
      [env.LOGIN_WINDOW_MINUTES, user.id]
    );
    return;
  }

  await db.query(
    `UPDATE users
     SET failed_attempts = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [failedAttempts, user.id]
  );
}

async function login({ username, password }) {
  try {
    const user = await findActiveUserByUsername(username);

    if (!user) {
      throw httpError(401, 'UNAUTHORIZED', GENERIC_LOGIN_ERROR);
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.max(1, Math.ceil((new Date(user.locked_until) - new Date()) / 60000));
      throw httpError(
        423,
        'ACCOUNT_LOCKED',
        `Account temporarily locked after too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      await recordFailedLogin(user);
      throw httpError(401, 'UNAUTHORIZED', GENERIC_LOGIN_ERROR);
    }

    await db.query(
      `UPDATE users
       SET failed_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    const publicUser = toPublicUser(user);
    const token = jwt.sign(publicUser, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });

    return {
      token,
      user: publicUser,
      forcePasswordChange: user.force_password_change
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

// Beta "Dummy login": create the next sequential owner-role test account
// (dummy1, dummy2, ...), record the requester's IP / user-agent, and issue a
// token. Username comes from a server-side integer sequence — never from client
// input — and every write is parameterized, so there is no injection surface.
async function dummyLogin({ ipAddress, userAgent } = {}) {
  try {
    const seqResult = await db.query("SELECT nextval('dummy_user_seq') AS n");
    const n = seqResult.rows[0].n;
    const username = `dummy${n}`;
    const fullName = `Dummy Tester ${n}`;

    // Give the account an unusable random password so it can never be reached
    // through the normal username/password form — access is via the button only.
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomSecret, env.BCRYPT_ROUNDS);

    const insertResult = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, status, force_password_change)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', FALSE)
       RETURNING id, username, full_name, role`,
      [username, passwordHash, fullName]
    );
    const user = insertResult.rows[0];

    await db.query(
      `INSERT INTO dummy_login_events (user_id, username, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [user.id, username, ipAddress || null, userAgent || null]
    );

    const publicUser = toPublicUser(user);
    const token = jwt.sign(publicUser, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });

    return {
      token,
      user: publicUser,
      forcePasswordChange: false
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getCurrentUser(userId) {
  try {
    const user = await findActiveUserById(userId);
    if (!user) {
      throw httpError(401, 'UNAUTHORIZED', 'User no longer exists or is inactive');
    }

    return {
      user: toPublicUser(user),
      forcePasswordChange: user.force_password_change
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function changePassword(userId, { currentPassword, newPassword }) {
  try {
    const result = await db.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1 AND status = 'ACTIVE'`,
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      throw httpError(401, 'UNAUTHORIZED', 'User no longer exists or is inactive');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      throw httpError(401, 'UNAUTHORIZED', 'Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           force_password_change = FALSE,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    return { message: 'Password changed successfully' };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  login,
  dummyLogin,
  getCurrentUser,
  changePassword
};
