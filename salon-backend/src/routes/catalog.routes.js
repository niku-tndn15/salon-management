const express = require('express');
const { z } = require('zod');
const catalogController = require('../controllers/catalog.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();

const emptyBody = z.any().optional();
const emptyParams = z.object({});

const categorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(50)
  }),
  query: z.object({}).passthrough(),
  params: emptyParams
});

const listServicesSchema = z.object({
  body: emptyBody,
  query: z.object({
    status: z.enum(['active', 'inactive', 'all']).optional(),
    category_id: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }).passthrough(),
  params: emptyParams
});

const serviceBody = z.object({
  name: z.string().trim().min(1).max(100),
  category_id: z.string().uuid(),
  price: z.coerce.number().min(0),
  duration_minutes: z.coerce.number().int().min(1),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['active', 'inactive']).default('active')
});

const serviceSchema = z.object({
  body: serviceBody,
  query: z.object({}).passthrough(),
  params: emptyParams
});

const serviceIdSchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const updateServiceSchema = z.object({
  body: serviceBody,
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'inactive'])
  }),
  query: z.object({}).passthrough(),
  params: z.object({
    id: z.string().uuid()
  })
});

router.get('/categories', catalogController.listCategories);
router.post('/categories', requireRole('OWNER'), validate(categorySchema), catalogController.createCategory);

router.get('/services', validate(listServicesSchema), catalogController.listServices);
router.post('/services', requireRole('OWNER'), validate(serviceSchema), catalogController.createService);
router.put('/services/:id', requireRole('OWNER'), validate(updateServiceSchema), catalogController.updateService);
router.patch('/services/:id/status', requireRole('OWNER'), validate(statusSchema), catalogController.updateServiceStatus);
router.delete('/services/:id', requireRole('OWNER'), validate(serviceIdSchema), catalogController.deleteService);

module.exports = router;
