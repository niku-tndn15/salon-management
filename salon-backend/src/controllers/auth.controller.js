const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const data = await authService.login(req.validated.body);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  return res.json({
    success: true,
    data: { message: 'Logged out successfully' }
  });
}

async function me(req, res, next) {
  try {
    const data = await authService.getCurrentUser(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const data = await authService.changePassword(req.user.id, req.validated.body);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  login,
  logout,
  me,
  changePassword
};
