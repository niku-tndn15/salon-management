const customersService = require('../services/customers.service');

async function listCustomers(req, res, next) {
  try {
    const data = await customersService.listCustomers(req.validated.query);
    return res.json({ success: true, data: { customers: data.customers }, meta: data.meta });
  } catch (err) {
    return next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await customersService.createCustomer(req.validated.body, req.user);
    return res.status(201).json({ success: true, data: { customer } });
  } catch (err) {
    return next(err);
  }
}

async function getCustomer(req, res, next) {
  try {
    const customer = await customersService.getCustomer(req.validated.params.id);
    return res.json({ success: true, data: { customer } });
  } catch (err) {
    return next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const customer = await customersService.updateCustomer(req.validated.params.id, req.validated.body, req.user);
    return res.json({ success: true, data: { customer } });
  } catch (err) {
    return next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const data = await customersService.deleteCustomer(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getVisits(req, res, next) {
  try {
    const data = await customersService.getVisits(req.validated.params.id, req.validated.query);
    return res.json({ success: true, data: { visits: data.visits }, meta: data.meta });
  } catch (err) {
    return next(err);
  }
}

async function getLapsedCustomers(req, res, next) {
  try {
    const data = await customersService.getLapsedCustomers(req.validated.query);
    return res.json({ success: true, data: { customers: data.customers }, meta: data.meta });
  } catch (err) {
    return next(err);
  }
}

async function getBirthdays(req, res, next) {
  try {
    const customers = await customersService.getBirthdays(req.validated?.query || {});
    return res.json({ success: true, data: { customers } });
  } catch (err) {
    return next(err);
  }
}

async function getReferralReport(req, res, next) {
  try {
    const referrals = await customersService.getReferralReport();
    return res.json({ success: true, data: { referrals } });
  } catch (err) {
    return next(err);
  }
}

async function mergeCustomers(req, res, next) {
  try {
    const data = await customersService.mergeCustomers(req.validated.body, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getVisits,
  getLapsedCustomers,
  getBirthdays,
  getReferralReport,
  mergeCustomers
};
