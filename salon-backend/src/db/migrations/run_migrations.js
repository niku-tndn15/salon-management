const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');
const env = require('../../config/env');

const migrationsDir = __dirname;

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir);
  return entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const filePath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(filePath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`Applied ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    err.message = `Failed while applying ${filename}: ${err.message}`;
    throw err;
  }
}

async function runMigrations() {
  if (!env.DATABASE_URL) {
    console.log('DATABASE_URL is not configured; skipping migrations.');
    return { applied: 0, skipped: 0, status: 'not_configured' };
  }

  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('supabase.co') || env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined
  });

  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = await getMigrationFiles();
    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipped ${filename}`);
        skippedCount += 1;
        continue;
      }

      await applyMigration(client, filename);
      appliedCount += 1;
    }

    console.log(`Migrations complete. Applied: ${appliedCount}. Skipped: ${skippedCount}.`);
    return { applied: appliedCount, skipped: skippedCount, status: 'ok' };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  runMigrations
};
