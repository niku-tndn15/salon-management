const express = require('express');
const { z } = require('zod');
const staffController = require('../controllers/staff.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();
const emptyBody = z.any().optional();
const idParams = z.object({ id: z.string().uuid() });

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const staffBody = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  designation: z.string().trim().min(1).max(100),
  commission_pct: z.coerce.number().min(0).max(100),
  join_date: dateString
});

const listSchema = z.object({
  body: emptyBody,
  query: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'all']).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: z.object({})
});

const createSchema = z.object({
  body: staffBody,
  query: z.object({}).passthrough(),
  params: z.object({})
});

const updateSchema = z.object({
  body: staffBody.omit({ commission_pct: true }),
  query: z.object({}).passthrough(),
  params: idParams
});

const idSchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: idParams
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
    deactivation_date: dateString.optional(),
    deactivation_reason: z.string().trim().max(500).optional()
  }),
  query: z.object({}).passthrough(),
  params: idParams
});

const commissionSchema = z.object({
  body: z.object({
    commission_pct: z.coerce.number().min(0).max(100)
  }),
  query: z.object({}).passthrough(),
  params: idParams
});

const rangeSchema = z.object({
  body: emptyBody,
  query: z.object({
    start_date: dateString.optional(),
    end_date: dateString.optional()
  }).passthrough(),
  params: idParams
});

const compareSchema = z.object({
  body: emptyBody,
  query: z.object({
    start_date: dateString.optional(),
    end_date: dateString.optional()
  }).passthrough(),
  params: z.object({})
});

router.get('/', requireRole('OWNER'), validate(listSchema), staffController.listStaff);
router.post('/', requireRole('OWNER'), validate(createSchema), staffController.createStaff);
router.get('/compare', requireRole('OWNER'), validate(compareSchema), staffController.compareStaff);
router.get('/:id', requireRole('OWNER', 'STAFF'), validate(idSchema), staffController.getStaff);
router.put('/:id', requireRole('OWNER'), validate(updateSchema), staffController.updateStaff);
router.patch('/:id/status', requireRole('OWNER'), validate(statusSchema), staffController.updateStaffStatus);
router.delete('/:id', requireRole('OWNER'), validate(idSchema), staffController.deleteStaff);
router.get('/:id/commission-history', requireRole('OWNER'), validate(idSchema), staffController.getCommissionHistory);
router.put('/:id/commission', requireRole('OWNER'), validate(commissionSchema), staffController.updateCommission);
router.get('/:id/performance', requireRole('OWNER', 'STAFF'), validate(rangeSchema), staffController.getPerformance);

module.exports = router;
