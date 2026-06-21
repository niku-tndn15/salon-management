const express = require('express');
const { z } = require('zod');
const usersController = require('../controllers/users.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();
const emptyBody = z.any().optional();

const createSchema = z.object({
  body: z.object({
    username: z.string().trim().min(3).max(50),
    password: z.string().min(8).optional(),
    full_name: z.string().trim().min(1),
    role: z.enum(['OWNER', 'BILLING_PERSON', 'STAFF']),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const idParams = z.object({ id: z.string().uuid() });

const idSchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: idParams
});

const statusSchema = z.object({
  body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }),
  query: z.object({}).passthrough(),
  params: idParams
});

router.use(requireRole('OWNER'));
router.get('/', usersController.listUsers);
router.post('/', validate(createSchema), usersController.createUser);
router.patch('/:id/status', validate(statusSchema), usersController.updateUserStatus);
router.post('/:id/reset-password', validate(idSchema), usersController.resetPassword);
router.delete('/:id', validate(idSchema), usersController.deleteUser);

module.exports = router;
