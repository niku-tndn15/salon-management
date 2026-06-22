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

function pick(value, fallback) {
  return value === undefined ? fallback : value;
}

async function updateSalon(data) {
  try {
    const existing = await db.query('SELECT * FROM salon_profile ORDER BY updated_at DESC LIMIT 1');

    // Merge incoming fields over the current profile so callers can send a
    // partial payload (e.g. just the salon name, or just the GST settings).
    const current = existing.rows[0] || {};
    const merged = {
      name: pick(data.name, current.name),
      address: pick(data.address, current.address),
      phone: pick(data.phone, current.phone),
      gst_enabled: pick(data.gst_enabled, current.gst_enabled ?? false),
      gstin: pick(data.gstin, current.gstin ?? null)
    };

    if (!merged.name || !String(merged.name).trim()) {
      throw httpError(400, 'VALIDATION_ERROR', 'Salon name is required');
    }
    if (merged.gst_enabled && (!merged.gstin || String(merged.gstin).trim().length !== 15)) {
      throw httpError(400, 'VALIDATION_ERROR', 'GSTIN is required (15 characters) when GST is enabled');
    }
    if (!merged.gst_enabled) {
      merged.gstin = null;
    }

    if (existing.rows.length === 0) {
      const created = await db.query(
        `INSERT INTO salon_profile (name, address, phone, gst_enabled, gstin)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [merged.name, merged.address || '', merged.phone || '', merged.gst_enabled, merged.gstin]
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
      [merged.name, merged.address || '', merged.phone || '', merged.gst_enabled, merged.gstin, current.id]
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

async function deleteDiscount(id) {
  const client = await db.getClient().catch((err) => ensureDatabaseConfigured(err));

  try {
    await client.query('BEGIN');

    // Invoices keep discount_offer_snap, so release the FK link before deleting.
    await client.query('UPDATE invoices SET discount_offer_id = NULL WHERE discount_offer_id = $1', [id]);

    const result = await client.query(
      'DELETE FROM predefined_discount_offers WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Discount offer not found');
    }

    await client.query('COMMIT');
    return { message: 'Discount offer deleted successfully', id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getSalon,
  updateSalon,
  listDiscounts,
  createDiscount,
  updateDiscountStatus,
  deleteDiscount
};
