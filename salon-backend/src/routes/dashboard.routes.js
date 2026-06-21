const express = require('express');
const { z } = require('zod');
const dashboardController = require('../controllers/dashboard.controller');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');

const router = express.Router();
const emptyBody = z.any().optional();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const rangeSchema = z.object({
  body: emptyBody,
  query: z.object({
    start_date: dateString.optional(),
    end_date: dateString.optional()
  }).passthrough(),
  params: z.object({})
});

const emptySchema = z.object({
  body: emptyBody,
  query: z.object({}).passthrough(),
  params: z.object({})
});

router.use(requireRole('OWNER'));
router.get('/kpis', validate(rangeSchema), dashboardController.kpis);
router.get('/revenue-trend', validate(emptySchema), dashboardController.revenueTrend);
router.get('/category-split', validate(rangeSchema), dashboardController.categorySplit);
router.get('/top-services', validate(rangeSchema), dashboardController.topServices);
router.get('/staff-leaderboard', validate(rangeSchema), dashboardController.staffLeaderboard);
router.get('/birthdays', validate(emptySchema), dashboardController.birthdays);

module.exports = router;
