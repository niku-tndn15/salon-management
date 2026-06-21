const syncService = require('../services/sync.service');

async function push(req, res, next) {
  try {
    const data = await syncService.push(req.validated.body.device_id, req.validated.body.records, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function pull(req, res, next) {
  try {
    const data = await syncService.pull(req.validated.query.since, req.validated.query.device_id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  push,
  pull
};
