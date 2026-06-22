const settingsService = require('../services/settings.service');

async function getSalon(req, res, next) {
  try {
    const salon = await settingsService.getSalon();
    return res.json({ success: true, data: { salon } });
  } catch (err) {
    return next(err);
  }
}

async function updateSalon(req, res, next) {
  try {
    const salon = await settingsService.updateSalon(req.validated.body);
    return res.json({ success: true, data: { salon } });
  } catch (err) {
    return next(err);
  }
}

async function listDiscounts(req, res, next) {
  try {
    const discounts = await settingsService.listDiscounts(req.validated.query);
    return res.json({ success: true, data: { discounts } });
  } catch (err) {
    return next(err);
  }
}

async function createDiscount(req, res, next) {
  try {
    const discount = await settingsService.createDiscount(req.validated.body);
    return res.status(201).json({ success: true, data: { discount } });
  } catch (err) {
    return next(err);
  }
}

async function updateDiscountStatus(req, res, next) {
  try {
    const discount = await settingsService.updateDiscountStatus(req.validated.params.id, req.validated.body.status);
    return res.json({ success: true, data: { discount } });
  } catch (err) {
    return next(err);
  }
}

async function deleteDiscount(req, res, next) {
  try {
    const data = await settingsService.deleteDiscount(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSalon,
  updateSalon,
  listDiscounts,
  createDiscount,
  updateDiscountStatus,
  deleteDiscount
};
