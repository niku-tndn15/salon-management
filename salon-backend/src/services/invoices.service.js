const db = require('../config/db');
const httpError = require('../utils/httpError');
const { generateInvoiceNumber, generateRefundNumber } = require('../utils/invoiceNumber');
const { roundMoney, toNumber, toPositiveInt } = require('../utils/numbers');

function ensureDatabaseConfigured(err) {
  if (err && err.code === 'DB_NOT_CONFIGURED') {
    throw httpError(503, 'DB_NOT_CONFIGURED', 'Database is not configured');
  }
  throw err;
}

function calculateTotals(lineItems, discountType, discountValue) {
  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + toNumber(item.unit_price_snap) * (item.quantity || 1), 0));
  let discountAmount = 0;

  if (discountType === 'PERCENTAGE') {
    if (discountValue > 100) {
      throw httpError(400, 'VALIDATION_ERROR', 'Percentage discount cannot exceed 100');
    }
    discountAmount = roundMoney(subtotal * (discountValue / 100));
  } else if (discountType === 'FLAT') {
    if (discountValue > subtotal) {
      throw httpError(400, 'VALIDATION_ERROR', 'Flat discount cannot exceed subtotal');
    }
    discountAmount = roundMoney(discountValue);
  }

  const taxableAmount = roundMoney(subtotal - discountAmount);
  return { subtotal, discountAmount, taxableAmount };
}

async function getSalonProfile(client) {
  const result = await client.query(
    `SELECT name, address, phone, gst_enabled, gstin
     FROM salon_profile
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'Salon profile must exist before invoicing');
  }

  return result.rows[0];
}

async function getActiveCustomer(client, id) {
  const result = await client.query('SELECT id FROM customers WHERE id = $1 AND status = $2', [id, 'ACTIVE']);
  if (result.rows.length === 0) {
    throw httpError(404, 'NOT_FOUND', 'Customer not found or inactive');
  }
}

async function getDiscountOffer(client, id) {
  if (!id) return null;
  const result = await client.query(
    `SELECT id, name, discount_type, discount_value
     FROM predefined_discount_offers
     WHERE id = $1 AND status = 'ACTIVE'`,
    [id]
  );
  if (result.rows.length === 0) {
    throw httpError(404, 'NOT_FOUND', 'Discount offer not found or inactive');
  }
  return result.rows[0];
}

async function enrichLineItems(client, lineItems) {
  const enriched = [];

  for (const item of lineItems) {
    let serviceName = item.service_name_snap;
    let unitPrice = item.unit_price_snap;

    if (item.service_id) {
      const serviceResult = await client.query(
        'SELECT id, name, price FROM services WHERE id = $1 AND status = $2',
        [item.service_id, 'active']
      );
      if (serviceResult.rows.length === 0) {
        throw httpError(404, 'NOT_FOUND', 'Service not found or inactive');
      }
      serviceName = serviceName || serviceResult.rows[0].name;
      unitPrice = unitPrice ?? Number(serviceResult.rows[0].price);
    }

    const staffResult = await client.query(
      'SELECT id, name, commission_pct FROM staff WHERE id = $1 AND status = $2',
      [item.professional_id, 'ACTIVE']
    );
    if (staffResult.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Professional not found or inactive');
    }

    enriched.push({
      service_id: item.service_id || null,
      service_name_snap: serviceName,
      unit_price_snap: toNumber(unitPrice),
      is_price_override: Boolean(item.is_price_override),
      quantity: item.quantity || 1,
      professional_id: item.professional_id,
      professional_name_snap: item.professional_name_snap || staffResult.rows[0].name,
      commission_pct_snap: staffResult.rows[0].commission_pct
    });
  }

  return enriched;
}

async function createInvoice(data, user) {
  const client = await db.getClient().catch((err) => {
    ensureDatabaseConfigured(err);
  });

  try {
    await client.query('BEGIN');
    await getActiveCustomer(client, data.customer_id);

    const lineItems = await enrichLineItems(client, data.line_items);
    const discountType = data.discount_type || 'NONE';
    const discountValue = toNumber(data.discount_value || 0);
    const discountOffer = await getDiscountOffer(client, data.discount_offer_id);
    const totals = calculateTotals(lineItems, discountType, discountValue);
    const salon = await getSalonProfile(client);
    const cgstAmount = salon.gst_enabled ? roundMoney(totals.taxableAmount * 0.09) : 0;
    const sgstAmount = salon.gst_enabled ? roundMoney(totals.taxableAmount * 0.09) : 0;
    const grandTotal = roundMoney(totals.taxableAmount + cgstAmount + sgstAmount);
    const invoiceNumber = await generateInvoiceNumber(client);

    const invoiceResult = await client.query(
      `INSERT INTO invoices (
         invoice_number, customer_id, created_by, payment_method,
         subtotal, discount_type, discount_value, discount_amount,
         discount_offer_id, discount_offer_snap, taxable_amount,
         gst_enabled, cgst_amount, sgst_amount, grand_total, status,
         gstin_snap, salon_name_snap, salon_address_snap, salon_phone_snap
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'PAID', $16, $17, $18, $19)
       RETURNING *`,
      [
        invoiceNumber,
        data.customer_id,
        user.id,
        data.payment_method,
        totals.subtotal,
        discountType,
        discountValue,
        totals.discountAmount,
        data.discount_offer_id || null,
        discountOffer ? discountOffer.name : null,
        totals.taxableAmount,
        salon.gst_enabled,
        cgstAmount,
        sgstAmount,
        grandTotal,
        salon.gstin,
        salon.name,
        salon.address,
        salon.phone
      ]
    );

    const invoice = invoiceResult.rows[0];
    for (const item of lineItems) {
      await client.query(
        `INSERT INTO invoice_line_items (
           invoice_id, service_id, service_name_snap, unit_price_snap,
           is_price_override, quantity, professional_id, professional_name_snap,
           commission_pct_snap
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          invoice.id,
          item.service_id,
          item.service_name_snap,
          item.unit_price_snap,
          item.is_price_override,
          item.quantity,
          item.professional_id,
          item.professional_name_snap,
          item.commission_pct_snap
        ]
      );
    }

    await client.query('COMMIT');
    return getInvoice(invoice.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listInvoices(query) {
  try {
    const page = toPositiveInt(query.page, 1, 100000);
    const limit = toPositiveInt(query.limit, 20, 100);
    const offset = (page - 1) * limit;
    const clauses = [];
    const params = [];

    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      clauses.push(`(LOWER(i.invoice_number) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR c.phone LIKE $${params.length})`);
    }
    if (query.start_date) {
      params.push(query.start_date);
      clauses.push(`i.invoice_date >= $${params.length}`);
    }
    if (query.end_date) {
      params.push(query.end_date);
      clauses.push(`i.invoice_date <= $${params.length}`);
    }
    if (query.payment_method) {
      params.push(query.payment_method);
      clauses.push(`i.payment_method = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      clauses.push(`i.status = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await db.query(
      `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
              r.refund_number, r.refund_amount
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN refunds r ON r.invoice_id = i.id
       ${where}
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN refunds r ON r.invoice_id = i.id
       ${where}`,
      params.slice(0, -2)
    );

    return { invoices: result.rows, meta: { page, limit, total: countResult.rows[0].total } };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function getInvoice(id) {
  try {
    const invoiceResult = await db.query(
      `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone,
              r.id AS refund_id, r.refund_number, r.refund_type, r.refund_amount, r.reason, r.processed_at
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       LEFT JOIN refunds r ON r.invoice_id = i.id
       WHERE i.id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Invoice not found');
    }

    const items = await db.query(
      `SELECT *
       FROM invoice_line_items
       WHERE invoice_id = $1
       ORDER BY service_name_snap`,
      [id]
    );

    return {
      ...invoiceResult.rows[0],
      line_items: items.rows
    };
  } catch (err) {
    ensureDatabaseConfigured(err);
  }
}

async function refundInvoice(id, data, user) {
  const client = await db.getClient().catch((err) => {
    ensureDatabaseConfigured(err);
  });

  try {
    await client.query('BEGIN');
    const invoiceResult = await client.query(
      `SELECT id, status, grand_total
       FROM invoices
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      throw httpError(404, 'NOT_FOUND', 'Invoice not found');
    }

    const invoice = invoiceResult.rows[0];
    if (invoice.status !== 'PAID') {
      throw httpError(400, 'VALIDATION_ERROR', 'Invoice is already refunded');
    }

    const grandTotal = toNumber(invoice.grand_total);
    const refundAmount = roundMoney(data.refund_amount);

    if (data.refund_type === 'FULL' && refundAmount !== grandTotal) {
      throw httpError(400, 'VALIDATION_ERROR', 'Full refund amount must equal invoice grand total');
    }
    if (data.refund_type === 'PARTIAL' && refundAmount >= grandTotal) {
      throw httpError(400, 'VALIDATION_ERROR', 'Partial refund amount must be less than invoice grand total');
    }

    const refundNumber = await generateRefundNumber(client);
    const refundResult = await client.query(
      `INSERT INTO refunds (refund_number, invoice_id, refund_type, refund_amount, reason, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [refundNumber, id, data.refund_type, refundAmount, data.reason, user.id]
    );

    const newStatus = data.refund_type === 'FULL' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await client.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, id]);
    await client.query('COMMIT');

    return refundResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw httpError(409, 'CONFLICT', 'Refund already exists for this invoice');
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  refundInvoice
};
