const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const httpError = require('../utils/httpError');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    status: row.status,
    force_password_change: row.force_password_change,
    failed_attempts: row.failed_attempts,
    locked_until: row.locked_until,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function temporaryPassword() {
  return crypto.randomBytes(8).toString('hex');
}

async function listUsers() {
  try {
    const result = await db.query(
      `SELECT id, username, full_name, role, status, force_password_change,
              failed_attempts, locked_until, last_login_at, created_at, updated_at
       FROM users
       ORDER BY username`
    );
    return result.rows.map(toPublicUser);
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function createUser(data) {
  try {
    const password = data.password || temporaryPassword();
    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, status, force_password_change)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'ACTIVE'), TRUE)
       RETURNING id, username, full_name, role, status, force_password_change,
                 failed_attempts, locked_until, last_login_at, created_at, updated_at`,
      [data.username, hash, data.full_name, data.role, data.status || 'ACTIVE']
    );
    return { user: toPublicUser(result.rows[0]), credentials: { username: data.username, temporaryPassword: password } };
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'CONFLICT', 'Username already exists');
    ensureDatabaseConfigured(err);
  }
}

async function updateUserStatus(id, status, currentUser) {
  if (id === currentUser.id && status === 'INACTIVE') {
    throw httpError(400, 'VALIDATION_ERROR', 'Cannot deactivate your own account');
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name, role, status, force_password_change,
                 failed_attempts, locked_until, last_login_at, created_at, updated_at`,
      [status, id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'User not found');
    return toPublicUser(result.rows[0]);
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function resetPassword(id) {
  try {
    const existing = await db.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'User not found');
    if (!['BILLING_PERSON', 'STAFF'].includes(existing.rows[0].role)) {
      throw httpError(400, 'VALIDATION_ERROR', 'Only billing and staff user passwords can be reset here');
    }

    const password = temporaryPassword();
    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const result = await db.query(
      `UPDATE users
       SET password_hash = $1,
           force_password_change = TRUE,
           failed_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name, role, status, force_password_change,
                 failed_attempts, locked_until, last_login_at, created_at, updated_at`,
      [hash, id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'User not found');
    return { user: toPublicUser(result.rows[0]), temporaryPassword: password };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function deleteUser(id, currentUser) {
  if (id === currentUser.id) {
    throw httpError(400, 'VALIDATION_ERROR', 'Cannot delete your own account');
  }

  const client = await db.getClient().catch(err => {
    ensureDatabaseConfigured(err);
  });

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'User not found');

    await client.query('UPDATE staff SET user_id = NULL, updated_at = NOW() WHERE user_id = $1', [id]);

    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'User not found');

    await client.query('COMMIT');
    return { id: result.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23503') {
      throw httpError(
        409,
        'USER_HAS_HISTORY',
        'This user has billing, catalog, customer, refund, or audit history and cannot be permanently deleted. Deactivate the user instead.'
      );
    }
    ensureDatabaseConfigured(err);
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUserStatus,
  resetPassword,
  deleteUser
};
