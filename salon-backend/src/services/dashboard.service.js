const db = require('../config/db');
const httpError = require('../utils/httpError');
const { roundMoney, toNumber } = require('../utils/numbers');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function dateOrToday(value) {
  return value || new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function rangeDays(startDate, endDate) {
  return Math.max(1, Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
}

function wow(current, prior) {
  if (!prior) return { wow_pct: null, wow_direction: null };
  const pct = roundMoney(((current - prior) / prior) * 100);
  return {
    wow_pct: pct,
    wow_direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  };
}

async function getKpis(query) {
  try {
    const endDate = dateOrToday(query.end_date);
    const startDate = query.start_date || endDate;
    const days = rangeDays(startDate, endDate);
    const priorEnd = addDays(startDate, -1);
    const priorStart = addDays(priorEnd, -(days - 1));

    const [
      revenue,
      priorRevenue,
      customers,
      priorCustomers,
      lapsed,
      topPerformer
    ] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(grand_total), 0) AS total
         FROM invoices
         WHERE status = 'PAID' AND invoice_date BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      db.query(
        `SELECT COALESCE(SUM(grand_total), 0) AS total
         FROM invoices
         WHERE status = 'PAID' AND invoice_date BETWEEN $1 AND $2`,
        [priorStart, priorEnd]
      ),
      db.query(
        `SELECT COUNT(DISTINCT customer_id)::int AS total,
                COUNT(DISTINCT customer_id) FILTER (
                  WHERE customer_id IN (
                    SELECT id FROM customers WHERE created_at::date BETWEEN $1 AND $2
                  )
                )::int AS new
         FROM invoices
         WHERE status = 'PAID' AND invoice_date BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      db.query(
        `SELECT COUNT(DISTINCT customer_id)::int AS total
         FROM invoices
         WHERE status = 'PAID' AND invoice_date BETWEEN $1 AND $2`,
        [priorStart, priorEnd]
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM (
           SELECT c.id
           FROM customers c
           JOIN invoices i ON i.customer_id = c.id AND i.status = 'PAID'
           WHERE c.status = 'ACTIVE'
           GROUP BY c.id
           HAVING CURRENT_DATE - MAX(i.invoice_date) >= 45
         ) lapsed_customers`
      ),
      db.query(
        `SELECT ili.professional_id AS staff_id,
                ili.professional_name_snap AS name,
                COALESCE(SUM(ili.unit_price_snap * ili.quantity), 0) AS revenue,
                COUNT(ili.id)::int AS service_count
         FROM invoice_line_items ili
         JOIN invoices i ON i.id = ili.invoice_id
           AND i.status = 'PAID'
           AND i.invoice_date BETWEEN $1 AND $2
         LEFT JOIN refunds r ON r.invoice_id = i.id
         WHERE r.id IS NULL
         GROUP BY ili.professional_id, ili.professional_name_snap
         ORDER BY revenue DESC
         LIMIT 1`,
        [startDate, endDate]
      )
    ]);

    const revenueValue = toNumber(revenue.rows[0].total);
    const priorRevenueValue = toNumber(priorRevenue.rows[0].total);
    const customerTotal = Number(customers.rows[0].total || 0);
    const newCustomers = Number(customers.rows[0].new || 0);
    const returningCustomers = Math.max(0, customerTotal - newCustomers);
    const priorCustomerTotal = Number(priorCustomers.rows[0].total || 0);
    const atv = customerTotal > 0 ? roundMoney(revenueValue / customerTotal) : null;
    const priorAtv = priorCustomerTotal > 0 ? roundMoney(priorRevenueValue / priorCustomerTotal) : null;
    const top = topPerformer.rows[0] || null;

    return {
      revenue: { value: revenueValue, ...wow(revenueValue, priorRevenueValue) },
      customers_served: {
        total: customerTotal,
        new: newCustomers,
        returning: returningCustomers,
        wow_change: customerTotal - priorCustomerTotal
      },
      average_ticket_value: {
        value: atv,
        ...wow(atv || 0, priorAtv || 0)
      },
      lapsed_customers: {
        count: Number(lapsed.rows[0].count || 0)
      },
      top_performer: top ? {
        staff_id: top.staff_id,
        name: top.name,
        revenue: toNumber(top.revenue),
        service_count: Number(top.service_count || 0)
      } : null
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getRevenueTrend() {
  try {
    const result = await db.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       )
       SELECT d.day,
              COALESCE(SUM(i.grand_total), 0) AS revenue
       FROM days d
       LEFT JOIN invoices i ON i.invoice_date = d.day AND i.status = 'PAID'
       GROUP BY d.day
       ORDER BY d.day`
    );
    return result.rows.map((row) => ({ day: row.day, revenue: toNumber(row.revenue) }));
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getCategorySplit(query) {
  try {
    const endDate = dateOrToday(query.end_date);
    const startDate = query.start_date || endDate;
    const result = await db.query(
      `SELECT sc.name AS category,
              COALESCE(SUM(CASE WHEN i.id IS NOT NULL THEN ili.unit_price_snap * ili.quantity ELSE 0 END), 0) AS revenue
       FROM service_categories sc
       LEFT JOIN services s ON s.category_id = sc.id
       LEFT JOIN invoice_line_items ili ON ili.service_id = s.id
       LEFT JOIN invoices i ON i.id = ili.invoice_id
         AND i.status = 'PAID'
         AND i.invoice_date BETWEEN $1 AND $2
         AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.invoice_id = i.id)
       GROUP BY sc.id, sc.name
       ORDER BY revenue DESC`,
      [startDate, endDate]
    );
    return result.rows.map((row) => ({ category: row.category, revenue: toNumber(row.revenue) }));
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getTopServices(query) {
  try {
    const endDate = dateOrToday(query.end_date);
    const startDate = query.start_date || endDate;
    const result = await db.query(
      `SELECT ili.service_id,
              ili.service_name_snap AS name,
              COUNT(ili.id)::int AS service_count,
              COALESCE(SUM(ili.unit_price_snap * ili.quantity), 0) AS revenue
       FROM invoice_line_items ili
       JOIN invoices i ON i.id = ili.invoice_id
         AND i.status = 'PAID'
         AND i.invoice_date BETWEEN $1 AND $2
       LEFT JOIN refunds r ON r.invoice_id = i.id
       WHERE r.id IS NULL
       GROUP BY ili.service_id, ili.service_name_snap
       ORDER BY revenue DESC, service_count DESC
       LIMIT 5`,
      [startDate, endDate]
    );
    return result.rows.map((row) => ({ ...row, revenue: toNumber(row.revenue) }));
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getStaffLeaderboard(query) {
  try {
    const endDate = dateOrToday(query.end_date);
    const startDate = query.start_date || endDate;
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

async function getBirthdays() {
  try {
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
                WHEN birthday_this_year BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN birthday_this_year
                ELSE birthday_next_year
              END AS next_birthday
       FROM birthdays
       WHERE birthday_this_year BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          OR birthday_next_year BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       ORDER BY next_birthday`
    );
    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  getKpis,
  getRevenueTrend,
  getCategorySplit,
  getTopServices,
  getStaffLeaderboard,
  getBirthdays
};
