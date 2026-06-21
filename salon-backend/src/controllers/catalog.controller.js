const catalogService = require('../services/catalog.service');

async function listCategories(req, res, next) {
  try {
    const categories = await catalogService.listCategories();
    return res.json({ success: true, data: { categories } });
  } catch (err) {
    return next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await catalogService.createCategory(req.validated.body);
    return res.status(201).json({ success: true, data: { category } });
  } catch (err) {
    return next(err);
  }
}

async function listServices(req, res, next) {
  try {
    const data = await catalogService.listServices(req.validated.query, req.user);
    return res.json({
      success: true,
      data: { services: data.services },
      meta: data.meta
    });
  } catch (err) {
    return next(err);
  }
}

async function createService(req, res, next) {
  try {
    const service = await catalogService.createService(req.validated.body, req.user);
    return res.status(201).json({ success: true, data: { service } });
  } catch (err) {
    return next(err);
  }
}

async function updateService(req, res, next) {
  try {
    const service = await catalogService.updateService(req.validated.params.id, req.validated.body);
    return res.json({ success: true, data: { service } });
  } catch (err) {
    return next(err);
  }
}

async function updateServiceStatus(req, res, next) {
  try {
    const service = await catalogService.updateServiceStatus(
      req.validated.params.id,
      req.validated.body.status
    );
    return res.json({ success: true, data: { service } });
  } catch (err) {
    return next(err);
  }
}

async function deleteService(req, res, next) {
  try {
    const data = await catalogService.deleteService(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCategories,
  createCategory,
  listServices,
  createService,
  updateService,
  updateServiceStatus,
  deleteService
};
