const db = require('../config/db');
const httpError = require('../utils/httpError');
const customersService = require('./customers.service');
const invoicesService = require('./invoices.service');
const crypto = require('crypto');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

async function recordSyncQueue({ deviceId, record, entityId = null, status, conflictReason = null }) {
  const queueEntityId = entityId || crypto.randomUUID();
  const processedAt = status === 'PENDING' ? null : new Date();
  const result = await db.query(
    `INSERT INTO sync_queue (device_id, entity_type, entity_id, operation, payload, sync_status, processed_at, conflict_reason)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     RETURNING id`,
    [deviceId, record.entity_type, queueEntityId, record.operation, JSON.stringify(record.payload || {}), status, processedAt, conflictReason]
  );
  return result.rows[0].id;
}

async function processCustomerCreate(deviceId, record, user) {
  const phone = record.payload?.phone;
  if (phone) {
    const existing = await db.query('SELECT id FROM customers WHERE phone = $1 AND status = $2', [phone, 'ACTIVE']);
    if (existing.rows.length > 0) {
      await recordSyncQueue({
        deviceId,
        record,
        status: 'CONFLICT',
        conflictReason: `DUPLICATE_PHONE:${existing.rows[0].id}`
      });
      return {
        local_id: record.local_id,
        status: 'CONFLICT',
        conflict: {
          type: 'DUPLICATE_PHONE',
          existing_customer_id: existing.rows[0].id,
          message: `Phone ${phone} already exists. Merge required.`
        }
      };
    }
  }

  const customer = await customersService.createCustomer(record.payload, user);
  await recordSyncQueue({ deviceId, record, entityId: customer.id, status: 'PROCESSED' });
  return { local_id: record.local_id, server_id: customer.id, status: 'PROCESSED' };
}

async function processInvoiceCreate(deviceId, record, user) {
  const invoice = await invoicesService.createInvoice(record.payload, user);
  await recordSyncQueue({ deviceId, record, entityId: invoice.id, status: 'PROCESSED' });
  return {
    local_id: record.local_id,
    server_id: invoice.id,
    canonical_number: invoice.invoice_number,
    status: 'PROCESSED'
  };
}

async function push(deviceId, records, user) {
  try {
    const results = [];

    for (const record of records) {
      if (record.operation !== 'CREATE') {
        await recordSyncQueue({
          deviceId,
          record,
          status: 'CONFLICT',
          conflictReason: 'UNSUPPORTED_OPERATION'
        });
        results.push({ local_id: record.local_id, status: 'CONFLICT', conflict: { type: 'UNSUPPORTED_OPERATION' } });
        continue;
      }

      if (record.entity_type === 'customer') {
        results.push(await processCustomerCreate(deviceId, record, user));
      } else if (record.entity_type === 'invoice') {
        results.push(await processInvoiceCreate(deviceId, record, user));
      } else {
        await recordSyncQueue({
          deviceId,
          record,
          status: 'CONFLICT',
          conflictReason: 'UNSUPPORTED_ENTITY'
        });
        results.push({ local_id: record.local_id, status: 'CONFLICT', conflict: { type: 'UNSUPPORTED_ENTITY' } });
      }
    }

    return { results };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function pull(since, deviceId) {
  try {
    const sinceValue = since || '1970-01-01T00:00:00.000Z';
    const [customers, services, staff, invoices, conflicts] = await Promise.all([
      db.query(
        `SELECT *
         FROM customers
         WHERE COALESCE(updated_at, created_at) > $1::timestamptz
         ORDER BY COALESCE(updated_at, created_at)`,
        [sinceValue]
      ),
      db.query(
        `SELECT *
         FROM services
         WHERE updated_at > $1::timestamptz
         ORDER BY updated_at`,
        [sinceValue]
      ),
      db.query(
        `SELECT *
         FROM staff
         WHERE updated_at > $1::timestamptz
         ORDER BY updated_at`,
        [sinceValue]
      ),
      db.query(
        `SELECT *
         FROM invoices
         WHERE created_at > $1::timestamptz
         ORDER BY created_at`,
        [sinceValue]
      ),
      db.query(
        `SELECT id, entity_type, entity_id, payload, conflict_reason, created_at
         FROM sync_queue
         WHERE device_id = $1 AND sync_status = 'CONFLICT'
         ORDER BY created_at DESC`,
        [deviceId]
      )
    ]);

    return {
      customers: customers.rows,
      services: services.rows,
      staff: staff.rows,
      invoices: invoices.rows,
      conflicts: conflicts.rows,
      last_sync_timestamp: new Date().toISOString()
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

module.exports = {
  push,
  pull
};
