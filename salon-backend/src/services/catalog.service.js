const db = require('../config/db');
const httpError = require('../utils/httpError');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

async function listCategories() {
  try {
    const result = await db.query(
      `SELECT id, name, created_at
       FROM service_categories
       ORDER BY name`
    );
    return result.rows;
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function createCategory({ name }) {
  try {
    const existing = await db.query(
      'SELECT id FROM service_categories WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existing.rows.length > 0) {
      throw httpError(409, 'CONFLICT', 'Category name already exists');
    }

    const result = await db.query(
      `INSERT INTO service_categories (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [name]
    );

    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function listServices(query, user) {
  try {
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 50, 100);
    const offset = (page - 1) * limit;
    const clauses = [];
    const params = [];

    let requestedStatus = query.status || 'all';
    if (user.role === 'BILLING_PERSON') {
      requestedStatus = 'active';
    }

    if (requestedStatus !== 'all') {
      params.push(requestedStatus);
      clauses.push(`s.status = $${params.length}`);
    }

    if (query.category_id) {
      params.push(query.category_id);
      clauses.push(`s.category_id = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      clauses.push(`LOWER(s.name) LIKE $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await db.query(
      `SELECT s.id, s.name, s.category_id, sc.name AS category_name,
              s.price, s.duration_minutes, s.description, s.status,
              s.created_by, s.created_at, s.updated_at
       FROM services s
       JOIN service_categories sc ON sc.id = s.category_id
       ${where}
       ORDER BY s.name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM services s
       JOIN service_categories sc ON sc.id = s.category_id
       ${where}`,
      params.slice(0, -2)
    );

    const services = result.rows.map((service) => {
      if (user.role === 'OWNER') return service;
      const { created_by, ...safeService } = service;
      return safeService;
    });

    return {
      services,
      meta: {
        page,
        limit,
        total: countResult.rows[0].total
      }
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function assertCategoryExists(categoryId) {
  const result = await db.query('SELECT id FROM service_categories WHERE id = $1', [categoryId]);
  if (result.rows.length === 0) {
    throw httpError(404, 'NOT_FOUND', 'Category not found');
  }
}

async function assertServiceNameAvailable(name, excludeId = null) {
  const params = [name];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = ` AND id <> $${params.length}`;
  }

  const existing = await db.query(
    `SELECT id FROM services WHERE LOWER(name) = LOWER($1)${excludeClause}`,
    params
  );

  if (existing.rows.length > 0) {
    throw httpError(409, 'CONFLICT', 'Service name already exists');
  }
}

async function createService(data, user) {
  try {
    await assertCategoryExists(data.category_id);
    await assertServiceNameAvailable(data.name);

    const result = await db.query(
      `INSERT INTO services (name, category_id, price, duration_minutes, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, category_id, price, duration_minutes, description, status, created_by, created_at, updated_at`,
      [
        data.name,
        data.category_id,
        data.price,
        data.duration_minutes,
        data.description || null,
        data.status || 'active',
        user.id
      ]
    );

    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function updateService(id, data) {
  try {
    await assertCategoryExists(data.category_id);
    await assertServiceNameAvailable(data.name, id);

    const result = await db.query(
      `UPDATE services
       SET name = $1,
           category_id = $2,
           price = $3,
           duration_minutes = $4,
           description = $5,
           status = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, category_id, price, duration_minutes, description, status, created_by, created_at, updated_at`,
      [
        data.name,
        data.category_id,
        data.price,
        data.duration_minutes,
        data.description || null,
        data.status || 'active',
        id
      ]
    );

    if (result.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Service not found');
    }

    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function updateServiceStatus(id, status) {
  try {
    const result = await db.query(
      `UPDATE services
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, category_id, price, duration_minutes, description, status, created_by, created_at, updated_at`,
      [status, id]
    );

    if (result.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Service not found');
    }

    return result.rows[0];
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function deleteService(id) {
  try {
    const history = await db.query(
      'SELECT COUNT(*)::int AS count FROM invoice_line_items WHERE service_id = $1',
      [id]
    );

    if (history.rows[0].count > 0) {
      throw httpError(400, 'VALIDATION_ERROR', 'Deactivate this service instead - it has invoice history.');
    }

    const result = await db.query(
      'DELETE FROM services WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Service not found');
    }

    return { message: 'Service deleted successfully' };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  listCategories,
  createCategory,
  listServices,
  createService,
  updateService,
  updateServiceStatus,
  deleteService
};
