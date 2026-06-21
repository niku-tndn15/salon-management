const express = require('express');
const { z } = require('zod');
const syncController = require('../controllers/sync.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { syncPushRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const emptyBody = z.any().optional();

const recordSchema = z.object({
  entity_type: z.enum(['customer', 'invoice']),
  operation: z.enum(['CREATE', 'UPDATE']),
  local_id: z.string().min(1),
  payload: z.record(z.any())
});

const pushSchema = z.object({
  body: z.object({
    device_id: z.string().min(1).max(100),
    records: z.array(recordSchema).min(1).max(100)
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const pullSchema = z.object({
  body: emptyBody,
  query: z.object({
    since: z.string().datetime().optional(),
    device_id: z.string().min(1).max(100)
  }).passthrough(),
  params: z.object({})
});

router.use(requireRole('OWNER', 'BILLING_PERSON'));
router.post('/push', syncPushRateLimiter, validate(pushSchema), syncController.push);
router.get('/pull', validate(pullSchema), syncController.pull);

module.exports = router;
