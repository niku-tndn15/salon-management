const db = require('../config/db');
const httpError = require('../utils/httpError');
const { toNumber, toPositiveInt } = require('../utils/numbers');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function normalizeCustomer(row) {
  if (!row) return row;
  const totalVisits = Number(row.total_visits || 0);
  const lifetimeSpend = toNumber(row.lifetime_spend);
  const daysSinceLastVisit = row.days_since_last_visit === null ? null : Number(row.days_since_last_visit);

  return {
    ...row,
    total_visits: totalVisits,
    lifetime_spend: lifetimeSpend,
    days_since_last_visit: daysSinceLastVisit,
    age: calculateAge(row.date_of_birth),
    average_spend: totalVisits > 0 ? lifetimeSpend / totalVisits : 0,
    is_lapsed: totalVisits > 0 && daysSinceLastVisit !== null && daysSinceLastVisit >= 45,
    birthday_upcoming: isBirthdayUpcoming(row.date_of_birth)
  };
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function isBirthdayUpcoming(dateOfBirth, daysAhead = 10) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates = [
    new Date(today.getFullYear(), dob.getMonth(), dob.getDate()),
    new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate())
  ];

  return candidates.some((birthday) => {
    const diffDays = Math.floor((birthday - today) / 86400000);
    return diffDays >= 0 && diffDays <= daysAhead;
  });
}

async function listCustomers(query) {
  try {
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 20, 100);
    const offset = (page - 1) * limit;
    const params = [query.phone || null, query.name || null, limit, offset];

    const result = await db.query(
      `SELECT c.*,
              COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'PAID')::int AS total_visits,
              COALESCE(SUM(i.grand_total) FILTER (WHERE i.status = 'PAID'), 0) AS lifetime_spend,
              MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID') AS last_visit_date
       FROM customers c
       LEFT JOIN invoices i ON i.customer_id = c.id
       WHERE c.status = 'ACTIVE'
         AND ($1::text IS NULL OR c.phone LIKE $1 || '%')
         AND ($2::text IS NULL OR LOWER(c.name) LIKE '%' || LOWER($2) || '%')
       GROUP BY c.id
       ORDER BY c.name
       LIMIT $3 OFFSET $4`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM customers c
       WHERE c.status = 'ACTIVE'
         AND ($1::text IS NULL OR c.phone LIKE $1 || '%')
         AND ($2::text IS NULL OR LOWER(c.name) LIKE '%' || LOWER($2) || '%')`,
      [query.phone || null, query.name || null]
    );

    return {
      customers: result.rows.map(normalizeCustomer),
      meta: { page, limit, total: countResult.rows[0].total }
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getCustomer(id) {
  try {
    const result = await db.query(
      `SELECT c.*,
              COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'PAID')::int AS total_visits,
              COALESCE(SUM(i.grand_total) FILTER (WHERE i.status = 'PAID'), 0) AS lifetime_spend,
              MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID') AS last_visit_date,
              (NOW()::date - MAX(i.invoice_date) FILTER (WHERE i.status = 'PAID'))::int AS days_since_last_visit
       FROM customers c
       LEFT JOIN invoices i ON i.customer_id = c.id
       WHERE c.id = $1 AND c.status = 'ACTIVE'
       GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Customer not found');
    }

    return normalizeCustomer(result.rows[0]);
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function assertActivePhoneAvailable(phone, excludeId = null) {
  const params = [phone];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = ` AND id <> $${params.length}`;
  }

  const result = await db.query(
    `SELECT id FROM customers WHERE phone = $1 AND status = 'ACTIVE'${excludeClause}`,
    params
  );

  if (result.rows.length > 0) {
    throw httpError(409, 'CONFLICT', 'Active customer with this phone already exists');
  }
}

async function createCustomer(data, user) {
  try {
    await assertActivePhoneAvailable(data.phone);
    const result = await db.query(
      `INSERT INTO customers (name, phone, gender, date_of_birth, referral_source, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.name, data.phone, data.gender, data.date_of_birth, data.referral_source, data.notes || null, user.id]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'CONFLICT', 'Active customer with this phone already exists');
    }
    ensureDatabaseConfigured(err);
  }
}

async function updateCustomer(id, data, user) {
  try {
    const existing = await db.query('SELECT id FROM customers WHERE id = $1 AND status = $2', [id, 'ACTIVE']);
    if (existing.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Customer not found');
    }

    const result = await db.query(
      `UPDATE customers
       SET name = $1,
           gender = $2,
           date_of_birth = $3,
           referral_source = $4,
           notes = $5,
           updated_at = NOW(),
           updated_by = $6
       WHERE id = $7
       RETURNING *`,
      [data.name, data.gender, data.date_of_birth, data.referral_source, data.notes || null, user.id, id]
    );
    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getVisits(id, query) {
  try {
    await getCustomer(id);
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 20, 100);
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, COALESCE(r.refund_amount, 0) AS refund_amount, r.refund_number
       FROM invoices i
       LEFT JOIN refunds r ON r.invoice_id = i.id
       WHERE i.customer_id = $1
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const count = await db.query('SELECT COUNT(*)::int AS total FROM invoices WHERE customer_id = $1', [id]);
    return { visits: result.rows, meta: { page, limit, total: count.rows[0].total } };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getLapsedCustomers(query) {
  try {
    const thresholdDays = toPositiveInt(query.threshold_days, 45, 3650);
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 50, 100);
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT c.id, c.name, c.phone,
              MAX(i.invoice_date) AS last_visit_date,
              (NOW()::date - MAX(i.invoice_date))::int AS days_inactive,
              COUNT(i.id)::int AS total_visits,
              COALESCE(SUM(i.grand_total), 0) AS lifetime_spend
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.status = 'PAID'
       WHERE c.status = 'ACTIVE'
       GROUP BY c.id
       HAVING NOW()::date - MAX(i.invoice_date) >= $1
       ORDER BY days_inactive DESC
       LIMIT $2 OFFSET $3`,
      [thresholdDays, limit, offset]
    );

    return { customers: result.rows, meta: { page, limit, threshold_days: thresholdDays } };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getBirthdays(query = {}) {
  try {
    const daysAhead = toPositiveInt(query.days_ahead, 10, 365);
    const result = await db.query(
      `WITH birthdays AS (
         SELECT id, name, phone, date_of_birth,
                MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM date_of_birth)::int, EXTRACT(DAY FROM date_of_birth)::int) AS birthday_this_year,
                MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM date_of_birth)::int, EXTRACT(DAY FROM date_of_birth)::int) AS birthday_next_year
         FROM customers
         WHERE status = 'ACTIVE'
       )
       SELECT id, name, phone, date_of_birth,
              CASE
                WHEN birthday_this_year BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1::int || ' days')::interval THEN birthday_this_year
                ELSE birthday_next_year
              END AS next_birthday,
              (
                CASE
                  WHEN birthday_this_year BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1::int || ' days')::interval THEN birthday_this_year
                  ELSE birthday_next_year
                END - CURRENT_DATE
              )::int AS days_until_birthday
       FROM birthdays
       WHERE birthday_this_year BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1::int || ' days')::interval
          OR birthday_next_year BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1::int || ' days')::interval
       ORDER BY next_birthday`,
      [daysAhead]
    );

    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getReferralReport() {
  try {
    const result = await db.query(
      `SELECT referral_source, COUNT(*)::int AS customer_count
       FROM customers
       WHERE status = 'ACTIVE'
       GROUP BY referral_source
       ORDER BY customer_count DESC, referral_source`
    );
    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function mergeCustomers({ primary_id: primaryId, secondary_id: secondaryId }, user) {
  if (primaryId === secondaryId) {
    throw httpError(400, 'VALIDATION_ERROR', 'Primary and secondary customers must be different');
  }

  const client = await db.getClient().catch((err) => {
    ensureDatabaseConfigured(err);
  });

  try {
    await client.query('BEGIN');

    const customers = await client.query(
      `SELECT id FROM customers WHERE id IN ($1, $2) AND status = 'ACTIVE'`,
      [primaryId, secondaryId]
    );
    if (customers.rows.length !== 2) {
      throw httpError(404, 'NOT_FOUND', 'Both active customers are required for merge');
    }

    await client.query('UPDATE invoices SET customer_id = $1 WHERE customer_id = $2', [primaryId, secondaryId]);
    await client.query(
      `UPDATE customers
       SET status = 'MERGED',
           merged_into_id = $1,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $3`,
      [primaryId, user.id, secondaryId]
    );

    await client.query('COMMIT');
    return { message: 'Customers merged successfully', primary_id: primaryId, secondary_id: secondaryId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  getVisits,
  getLapsedCustomers,
  getBirthdays,
  getReferralReport,
  mergeCustomers
};
