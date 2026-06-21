const express = require('express');
const { z } = require('zod');
const invoicesController = require('../controllers/invoices.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { invoiceRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const emptyBody = z.any().optional();

const idParams = z.object({
  id: z.string().uuid()
});

const listSchema = z.object({
  body: emptyBody,
  query: z.object({
    search: z.string().trim().max(100).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    payment_method: z.enum(['CASH', 'UPI', 'CARD']).optional(),
    status: z.enum(['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: z.object({})
});

const lineItemSchema = z.object({
  service_id: z.string().uuid().nullable().optional(),
  service_name_snap: z.string().trim().min(1).max(100).optional(),
  unit_price_snap: z.coerce.number().min(0).optional(),
  is_price_override: z.boolean().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  professional_id: z.string().uuid(),
  professional_name_snap: z.string().trim().min(1).max(100).optional()
}).refine((item) => item.service_id || (item.service_name_snap && item.unit_price_snap !== undefined), {
  message: 'Either service_id or service snapshot and price are required'
});

const createSchema = z.object({
  body: z.object({
    customer_id: z.string().uuid(),
    payment_method: z.enum(['CASH', 'UPI', 'CARD']),
    discount_type: z.enum(['NONE', 'PERCENTAGE', 'FLAT']).default('NONE'),
    discount_value: z.coerce.number().min(0).default(0),
    discount_offer_id: z.string().uuid().nullable().optional(),
    line_items: z.array(lineItemSchema).min(1)
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const idSchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: idParams
});

const refundSchema = z.object({
  body: z.object({
    refund_type: z.enum(['FULL', 'PARTIAL']),
    refund_amount: z.coerce.number().min(1),
    reason: z.string().trim().min(1).max(1000)
  }),
  query: z.object({}).passthrough(),
  params: idParams
});

router.use(requireRole('OWNER', 'BILLING_PERSON'));
router.post('/', invoiceRateLimiter, validate(createSchema), invoicesController.createInvoice);
router.get('/', validate(listSchema), invoicesController.listInvoices);
router.get('/:id', validate(idSchema), invoicesController.getInvoice);
router.post('/:id/refund', validate(refundSchema), invoicesController.refundInvoice);

module.exports = router;
