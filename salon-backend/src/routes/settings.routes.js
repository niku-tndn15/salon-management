const express = require('express');
const { z } = require('zod');
const settingsController = require('../controllers/settings.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();
const emptyBody = z.any().optional();

const salonSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    address: z.string().trim().min(1),
    phone: z.string().trim().min(1).max(15),
    gst_enabled: z.boolean(),
    gstin: z.string().trim().length(15).optional().nullable()
  }).refine((body) => !body.gst_enabled || Boolean(body.gstin), {
    path: ['gstin'],
    message: 'GSTIN is required when GST is enabled'
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const listDiscountsSchema = z.object({
  body: emptyBody,
  query: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'all']).optional()
  }).passthrough(),
  params: z.object({})
});

const discountSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    discount_type: z.enum(['PERCENTAGE', 'FLAT']),
    discount_value: z.coerce.number().positive(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  }).refine((body) => body.discount_type !== 'PERCENTAGE' || body.discount_value <= 100, {
    path: ['discount_value'],
    message: 'Percentage discount cannot exceed 100'
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const statusSchema = z.object({
  body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().uuid() })
});

router.get('/salon', requireRole('OWNER'), settingsController.getSalon);
router.put('/salon', requireRole('OWNER'), validate(salonSchema), settingsController.updateSalon);
router.get('/discounts', requireRole('OWNER', 'BILLING_PERSON'), validate(listDiscountsSchema), settingsController.listDiscounts);
router.post('/discounts', requireRole('OWNER'), validate(discountSchema), settingsController.createDiscount);
router.patch('/discounts/:id/status', requireRole('OWNER'), validate(statusSchema), settingsController.updateDiscountStatus);

module.exports = router;
