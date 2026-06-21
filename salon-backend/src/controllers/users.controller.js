const usersService = require('../services/users.service');

async function listUsers(req, res, next) {
  try {
    const users = await usersService.listUsers();
    return res.json({ success: true, data: { users } });
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const data = await usersService.createUser(req.validated.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const user = await usersService.updateUserStatus(req.validated.params.id, req.validated.body.status, req.user);
    return res.json({ success: true, data: { user } });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const data = await usersService.resetPassword(req.validated.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const data = await usersService.deleteUser(req.validated.params.id, req.user);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUserStatus,
  resetPassword,
  deleteUser
};
