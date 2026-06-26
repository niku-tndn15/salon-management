const express = require('express');
const { z } = require('zod');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginRateLimiter, dummyLoginRateLimiter } = require('../middleware/rateLimiter');
const env = require('../config/env');

const router = express.Router();

// Beta kill switch: when ENABLE_DUMMY_LOGIN is off, the endpoint behaves as if
// it doesn't exist (404), matching the app's not-found shape.
function requireDummyLoginEnabled(req, res, next) {
  if (!env.enableDummyLogin) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found', details: [] }
    });
  }
  return next();
}

const loginSchema = z.object({
  body: z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1)
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
      .min(8)
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/\d/, 'Must contain at least one digit')
  }).refine((body) => body.currentPassword !== body.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from current password'
  }),
  query: z.object({}).passthrough(),
  params: z.object({})
});

router.get('/config', authController.config);
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/dummy-login', requireDummyLoginEnabled, dummyLoginRateLimiter, authController.dummyLogin);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
