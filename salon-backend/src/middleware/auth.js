const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
        details: []
      }
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        details: []
      }
    });
  }

  const pool = db.getPool();
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT id, username, role, full_name
         FROM users
         WHERE id = $1 AND status = 'ACTIVE'`,
        [payload.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is inactive or no longer exists',
            details: []
          }
        });
      }
    } catch {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database is unavailable',
          details: []
        }
      });
    }
  }

  req.user = payload;
  return next();
}

module.exports = authenticate;
