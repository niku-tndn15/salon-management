const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const httpError = require('../utils/httpError');
const { roundMoney, toNumber, toPositiveInt } = require('../utils/numbers');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function randomPassword() {
  return crypto.randomBytes(4).toString('hex');
}

function baseUsername(name, phone) {
  const first = name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'staff';
  return `${first}${phone.slice(-4)}`;
}

async function generateUniqueUsername(client, name, phone) {
  const base = baseUsername(name, phone);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (existing.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

async function listStaff(query = {}) {
  try {
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 50, 100);
    const offset = (page - 1) * limit;
    const params = [];
    const clauses = [];

    if (query.status && query.status !== 'all') {
      params.push(query.status);
      clauses.push(`s.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      clauses.push(`(LOWER(s.name) LIKE $${params.length} OR s.phone LIKE $${params.length})`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await db.query(
      `SELECT s.*, u.username
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await db.query(`SELECT COUNT(*)::int AS total FROM staff s ${where}`, params.slice(0, -2));

    return { staff: result.rows, meta: { page, limit, total: count.rows[0].total } };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function assertStaffAccess(staffId, user) {
  if (user.role === 'OWNER') return;
  const result = await db.query('SELECT id FROM staff WHERE id = $1 AND user_id = $2', [staffId, user.id]);
  if (result.rows.length === 0) {
    throw httpError(403, 'FORBIDDEN', 'Staff users can only access their own profile');
  }
}

async function getStaff(id, user) {
  try {
    await assertStaffAccess(id, user);
    const result = await db.query(
      `SELECT s.*, u.username
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Staff profile not found');
    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function createStaff(data, user) {
  const client = await db.getClient().catch((err) => ensureDatabaseConfigured(err));

  try {
    await client.query('BEGIN');
    const phoneExists = await client.query('SELECT id FROM staff WHERE phone = $1', [data.phone]);
    if (phoneExists.rows.length > 0) throw httpError(409, 'CONFLICT', 'Staff phone already exists');

    const username = await generateUniqueUsername(client, data.name, data.phone);
    const temporaryPassword = randomPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_ROUNDS);

    const userResult = await client.query(
      `INSERT INTO users (username, password_hash, full_name, role, force_password_change)
       VALUES ($1, $2, $3, 'STAFF', TRUE)
       RETURNING id, username`,
      [username, passwordHash, data.name]
    );
    const staffUser = userResult.rows[0];

    const staffResult = await client.query(
      `INSERT INTO staff (user_id, name, phone, designation, commission_pct, join_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       RETURNING *`,
      [staffUser.id, data.name, data.phone, data.designation, data.commission_pct, data.join_date]
    );
    const staff = staffResult.rows[0];

    await client.query(
      `INSERT INTO commission_rate_history (staff_id, commission_pct, effective_from, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [staff.id, data.commission_pct, data.join_date, user.id]
    );

    await client.query('COMMIT');
    return { staff: { ...staff, username }, credentials: { username, temporaryPassword } };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw httpError(409, 'CONFLICT', 'Staff or user already exists');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStaff(id, data) {
  try {
    const result = await db.query(
      `UPDATE staff
       SET name = $1,
           phone = $2,
           designation = $3,
           join_date = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.name, data.phone, data.designation, data.join_date, id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Staff profile not found');
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'CONFLICT', 'Staff phone already exists');
    ensureDatabaseConfigured(err);
  }
}

async function updateStaffStatus(id, data) {
  const client = await db.getClient().catch((err) => ensureDatabaseConfigured(err));

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE staff
       SET status = $1::varchar,
           deactivation_date = CASE WHEN $1::varchar = 'INACTIVE' THEN COALESCE($2::date, CURRENT_DATE) ELSE NULL END,
           deactivation_reason = CASE WHEN $1::varchar = 'INACTIVE' THEN $3::text ELSE NULL END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.status, data.deactivation_date || null, data.deactivation_reason || null, id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Staff profile not found');

    const staff = result.rows[0];
    if (staff.user_id) {
      await client.query(
        `UPDATE users
         SET status = $1::varchar,
             updated_at = NOW()
         WHERE id = $2`,
        [data.status, staff.user_id]
      );
    }

    const withUser = await client.query(
      `SELECT s.*, u.username
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );

    await client.query('COMMIT');
    return withUser.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    ensureDatabaseConfigured(err);
  } finally {
    client.release();
  }
}

async function getCommissionHistory(id) {
  try {
    const result = await db.query(
      `SELECT crh.*, u.username AS changed_by_username
       FROM commission_rate_history crh
       JOIN users u ON u.id = crh.changed_by
       WHERE crh.staff_id = $1
       ORDER BY crh.effective_from DESC`,
      [id]
    );
    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function updateCommission(id, commissionPct, user) {
  const client = await db.getClient().catch((err) => ensureDatabaseConfigured(err));

  try {
    await client.query('BEGIN');
    const staff = await client.query('SELECT id FROM staff WHERE id = $1', [id]);
    if (staff.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Staff profile not found');

    const effectiveFrom = tomorrowISO();
    await client.query(
      `UPDATE commission_rate_history
       SET effective_to = ($1::date - INTERVAL '1 day')::date
       WHERE staff_id = $2 AND effective_to IS NULL`,
      [effectiveFrom, id]
    );
    await client.query(
      `INSERT INTO commission_rate_history (staff_id, commission_pct, effective_from, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, commissionPct, effectiveFrom, user.id]
    );
    const updated = await client.query(
      `UPDATE staff
       SET commission_pct = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [commissionPct, id]
    );

    await client.query('COMMIT');
    return { staff: updated.rows[0], effective_from: effectiveFrom };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function aggregatePerformance(rows, startDate, endDate) {
  const totalServices = rows.length;
  const totalRevenue = roundMoney(rows.reduce((sum, row) => sum + toNumber(row.unit_price_snap) * Number(row.quantity || 1), 0));
  const commissionEarned = roundMoney(rows.reduce((sum, row) => {
    const revenue = toNumber(row.unit_price_snap) * Number(row.quantity || 1);
    return sum + revenue * (toNumber(row.commission_pct) / 100);
  }, 0));
  const dayCount = Math.max(1, Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
  const periods = new Map();

  for (const row of rows) {
    const key = `${toNumber(row.commission_pct)}|${row.effective_from}|${row.effective_to || ''}`;
    const current = periods.get(key) || {
      rate: toNumber(row.commission_pct),
      from: row.effective_from,
      to: row.effective_to,
      services: 0,
      revenue: 0,
      commission: 0
    };
    const revenue = toNumber(row.unit_price_snap) * Number(row.quantity || 1);
    current.services += 1;
    current.revenue = roundMoney(current.revenue + revenue);
    current.commission = roundMoney(current.commission + revenue * (current.rate / 100));
    periods.set(key, current);
  }

  return {
    summary: {
      total_services: totalServices,
      total_revenue: totalRevenue,
      commission_earned: commissionEarned,
      avg_services_per_day: roundMoney(totalServices / dayCount)
    },
    by_rate_period: Array.from(periods.values()),
    line_items: rows
  };
}

async function getPerformance(id, query, user) {
  try {
    await assertStaffAccess(id, user);
    const today = new Date().toISOString().slice(0, 10);
    const startDate = query.start_date || today;
    const endDate = query.end_date || today;

    const result = await db.query(
      `SELECT ili.professional_id,
              ili.professional_name_snap,
              i.invoice_date,
              ili.service_name_snap,
              ili.unit_price_snap,
              ili.quantity,
              crh.commission_pct,
              crh.effective_from,
              crh.effective_to
       FROM invoice_line_items ili
       JOIN invoices i ON i.id = ili.invoice_id
         AND i.status = 'PAID'
         AND i.invoice_date BETWEEN $2 AND $3
       LEFT JOIN refunds r ON r.invoice_id = i.id
       JOIN LATERAL (
         SELECT commission_pct, effective_from, effective_to
         FROM commission_rate_history
         WHERE staff_id = $1
           AND effective_from <= i.invoice_date
           AND (effective_to IS NULL OR effective_to >= i.invoice_date)
         ORDER BY effective_from DESC
         LIMIT 1
       ) crh ON true
       WHERE ili.professional_id = $1
         AND r.id IS NULL
       ORDER BY i.invoice_date, ili.service_name_snap`,
      [id, startDate, endDate]
    );

    return aggregatePerformance(result.rows, startDate, endDate);
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function compareStaff(query) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = query.start_date || today;
    const endDate = query.end_date || today;
    const result = await db.query(
      `SELECT s.id AS staff_id,
              s.name,
              COUNT(i.id) FILTER (WHERE r.id IS NULL)::int AS service_count,
              COALESCE(SUM(CASE WHEN i.id IS NOT NULL AND r.id IS NULL THEN ili.unit_price_snap * ili.quantity ELSE 0 END), 0) AS revenue
       FROM staff s
       LEFT JOIN invoice_line_items ili ON ili.professional_id = s.id
       LEFT JOIN invoices i ON i.id = ili.invoice_id
         AND i.status = 'PAID'
         AND i.invoice_date BETWEEN $1 AND $2
       LEFT JOIN refunds r ON r.invoice_id = i.id
       WHERE s.status = 'ACTIVE'
       GROUP BY s.id, s.name
       ORDER BY revenue DESC, service_count DESC, s.name`,
      [startDate, endDate]
    );
    return result.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) }));
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  getCommissionHistory,
  updateCommission,
  getPerformance,
  compareStaff
};
