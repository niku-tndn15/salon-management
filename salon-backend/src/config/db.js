const { Pool } = require('pg');
const env = require('./env');

let pool = null;

if (env.DATABASE_URL) {
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL error', err);
  });
}

function getPool() {
  return pool;
}

async function query(text, params) {
  if (!pool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return pool.query(text, params);
}

async function getClient() {
  if (!pool) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return pool.connect();
}

async function checkConnection() {
  if (!pool) return { status: 'not_configured' };

  try {
    await pool.query('SELECT 1');
    return { status: 'connected' };
  } catch (err) {
    return {
      status: 'error',
      message: err.message
    };
  }
}

module.exports = {
  query,
  getClient,
  getPool,
  checkConnection
};
