const db = require('../config/db');
const httpError = require('../utils/httpError');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

async function getSalon() {
  try {
    const result = await db.query('SELECT * FROM salon_profile ORDER BY updated_at DESC LIMIT 1');
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Salon profile not found');
    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function updateSalon(data) {
  try {
    const existing = await db.query('SELECT id FROM salon_profile ORDER BY updated_at DESC LIMIT 1');
    if (existing.rows.length === 0) {
      const created = await db.query(
        `INSERT INTO salon_profile (name, address, phone, gst_enabled, gstin)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.name, data.address, data.phone, data.gst_enabled, data.gstin || null]
      );
      return created.rows[0];
    }

    const result = await db.query(
      `UPDATE salon_profile
       SET name = $1,
           address = $2,
           phone = $3,
           gst_enabled = $4,
           gstin = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [data.name, data.address, data.phone, data.gst_enabled, data.gstin || null, existing.rows[0].id]
    );
    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function listDiscounts(query = {}) {
  try {
    const params = [];
    let where = '';
    if (query.status && query.status !== 'all') {
      params.push(query.status);
      where = `WHERE status = $${params.length}`;
    }
    const result = await db.query(
      `SELECT *
       FROM predefined_discount_offers
       ${where}
       ORDER BY name`,
      params
    );
    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function createDiscount(data) {
  try {
    const result = await db.query(
      `INSERT INTO predefined_discount_offers (name, discount_type, discount_value, status)
       VALUES ($1, $2, $3, COALESCE($4, 'ACTIVE'))
       RETURNING *`,
      [data.name, data.discount_type, data.discount_value, data.status || 'ACTIVE']
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'CONFLICT', 'Active discount offer name already exists');
    ensureDatabaseConfigured(err);
  }
}

async function updateDiscountStatus(id, status) {
  try {
    const result = await db.query(
      `UPDATE predefined_discount_offers
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) throw httpError(404, 'NOT_FOUND', 'Discount offer not found');
    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  getSalon,
  updateSalon,
  listDiscounts,
  createDiscount,
  updateDiscountStatus
};
