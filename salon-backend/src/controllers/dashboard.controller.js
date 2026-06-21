const dashboardService = require('../services/dashboard.service');

async function kpis(req, res, next) {
  try {
    const data = await dashboardService.getKpis(req.validated.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function revenueTrend(req, res, next) {
  try {
    const trend = await dashboardService.getRevenueTrend();
    return res.json({ success: true, data: { trend } });
  } catch (err) {
    return next(err);
  }
}

async function categorySplit(req, res, next) {
  try {
    const categories = await dashboardService.getCategorySplit(req.validated.query);
    return res.json({ success: true, data: { categories } });
  } catch (err) {
    return next(err);
  }
}

async function topServices(req, res, next) {
  try {
    const services = await dashboardService.getTopServices(req.validated.query);
    return res.json({ success: true, data: { services } });
  } catch (err) {
    return next(err);
  }
}

async function staffLeaderboard(req, res, next) {
  try {
    const staff = await dashboardService.getStaffLeaderboard(req.validated.query);
    return res.json({ success: true, data: { staff } });
  } catch (err) {
    return next(err);
  }
}

async function birthdays(req, res, next) {
  try {
    const customers = await dashboardService.getBirthdays();
    return res.json({ success: true, data: { customers } });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  kpis,
  revenueTrend,
  categorySplit,
  topServices,
  staffLeaderboard,
  birthdays
};
