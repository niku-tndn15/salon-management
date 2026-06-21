function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');

  if (status >= 500 && !['DB_NOT_CONFIGURED', 'DB_UNAVAILABLE'].includes(code)) {
    console.error(err);
  }

  return res.status(status).json({
    success: false,
    error: {
      code,
      message: status >= 500 ? 'Internal server error' : err.message,
      details: err.details || []
    }
  });
}

module.exports = errorHandler;
