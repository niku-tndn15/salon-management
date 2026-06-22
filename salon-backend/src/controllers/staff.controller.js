const staffService = require('../services/staff.service');

async function listStaff(req, res, next) {
  try {
    const data = await staffService.listStaff(req.validated.query);
    return res.json({ success: true, data: { staff: data.staff }, meta: data.meta });
  } catch (err) {
    return next(err);
  }
}

async function getStaff(req, res, next) {
  try {
    const staff = await staffService.getStaff(req.validated.params.id, req.user);
    return res.json({ success: true, data: { staff } });
  } catch (err) {
    return next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const data = await staffService.createStaff(req.validated.body, req.user);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateStaff(req, res, next) {
  try {
    const staff = await staffService.updateStaff(req.validated.params.id, req.validated.body);
    return res.json({ success: true, data: { staff } });
  } catch (err) {
    return next(err);
  }
}

async function updateStaffStatus(req, res, next) {
  try {
    const staff = await staffService.updateStaffStatus(req.validated.params.id, req.validated.body);
    return res.json({ success: true, data: { staff } });
  } catch (err) {
    return next(err);
  }
}

async function deleteStaff(req, res, next) {
  try {
    const data = await staffService.deleteStaff(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getCommissionHistory(req, res, next) {
  try {
    const history = await staffService.getCommissionHistory(req.validated.params.id);
    return res.json({ success: true, data: { history } });
  } catch (err) {
    return next(err);
  }
}

async function updateCommission(req, res, next) {
  try {
    const data = await staffService.updateCommission(
      req.validated.params.id,
      req.validated.body.commission_pct,
      req.user
    );
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getPerformance(req, res, next) {
  try {
    const data = await staffService.getPerformance(req.validated.params.id, req.validated.query, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function compareStaff(req, res, next) {
  try {
    const staff = await staffService.compareStaff(req.validated.query);
    return res.json({ success: true, data: { staff } });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
  getCommissionHistory,
  updateCommission,
  getPerformance,
  compareStaff
};
