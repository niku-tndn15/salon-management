const express = require('express');
const { z } = require('zod');
const customersController = require('../controllers/customers.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();
const emptyBody = z.any().optional();

const idParams = z.object({
  id: z.string().uuid()
});

const baseCustomerBody = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  referral_source: z.enum(['WALK_IN', 'FRIEND_REFERRAL', 'INSTAGRAM', 'GOOGLE', 'FACEBOOK', 'OTHER']),
  notes: z.string().max(1000).optional()
});

const customerBody = baseCustomerBody.refine((body) => new Date(body.date_of_birth) < new Date(), {
  path: ['date_of_birth'],
  message: 'Date of birth must be in the past'
});

const updateCustomerBody = baseCustomerBody.omit({ phone: true }).refine((body) => new Date(body.date_of_birth) < new Date(), {
  path: ['date_of_birth'],
  message: 'Date of birth must be in the past'
});

const listSchema = z.object({
  body: emptyBody,
  query: z.object({
    phone: z.string().regex(/^\d{1,10}$/).optional(),
    name: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: z.object({})
});

const createSchema = z.object({
  body: customerBody,
  query: z.object({}).passthrough(),
  params: z.object({})
});

const updateSchema = z.object({
  body: updateCustomerBody,
  query: z.object({}).passthrough(),
  params: idParams
});

const idSchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: idParams
});

const visitsSchema = z.object({
  body: emptyBody,
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: idParams
});

const lapsedSchema = z.object({
  body: emptyBody,
  query: z.object({
    threshold_days: z.coerce.number().int().min(1).max(3650).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: z.object({})
});

const birthdaysSchema = z.object({
  body: emptyBody,
  query: z.object({
    days_ahead: z.coerce.number().int().min(1).max(365).optional()
  }).passthrough(),
  params: z.object({})
});

const mergeSchema = z.object({
  body: z.object({
    primary_id: z.string().uuid(),
    secondary_id: z.string().uuid()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

router.get('/', requireRole('OWNER', 'BILLING_PERSON'), validate(listSchema), customersController.listCustomers);
router.post('/', requireRole('OWNER', 'BILLING_PERSON'), validate(createSchema), customersController.createCustomer);
router.get('/reports/lapsed', requireRole('OWNER'), validate(lapsedSchema), customersController.getLapsedCustomers);
router.get('/reports/birthdays', requireRole('OWNER', 'BILLING_PERSON'), validate(birthdaysSchema), customersController.getBirthdays);
router.get('/reports/referrals', requireRole('OWNER'), customersController.getReferralReport);
router.post('/merge', requireRole('OWNER'), validate(mergeSchema), customersController.mergeCustomers);
router.get('/:id', requireRole('OWNER', 'BILLING_PERSON'), validate(idSchema), customersController.getCustomer);
router.put('/:id', requireRole('OWNER', 'BILLING_PERSON'), validate(updateSchema), customersController.updateCustomer);
router.delete('/:id', requireRole('OWNER'), validate(idSchema), customersController.deleteCustomer);
router.get('/:id/visits', requireRole('OWNER', 'BILLING_PERSON'), validate(visitsSchema), customersController.getVisits);

module.exports = router;
