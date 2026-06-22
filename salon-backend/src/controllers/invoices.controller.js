const invoicesService = require('../services/invoices.service');

async function createInvoice(req, res, next) {
  try {
    const invoice = await invoicesService.createInvoice(req.validated.body, req.user);
    return res.status(201).json({ success: true, data: { invoice } });
  } catch (err) {
    return next(err);
  }
}

async function listInvoices(req, res, next) {
  try {
    const data = await invoicesService.listInvoices(req.validated.query);
    return res.json({ success: true, data: { invoices: data.invoices }, meta: data.meta });
  } catch (err) {
    return next(err);
  }
}

async function getInvoice(req, res, next) {
  try {
    const invoice = await invoicesService.getInvoice(req.validated.params.id);
    return res.json({ success: true, data: { invoice } });
  } catch (err) {
    return next(err);
  }
}

async function refundInvoice(req, res, next) {
  try {
    const refund = await invoicesService.refundInvoice(req.validated.params.id, req.validated.body, req.user);
    return res.status(201).json({ success: true, data: { refund } });
  } catch (err) {
    return next(err);
  }
}

async function deleteInvoice(req, res, next) {
  try {
    const data = await invoicesService.deleteInvoice(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  refundInvoice,
  deleteInvoice
};
