const express = require('express');
const { checkConnection } = require('../config/db');

const router = express.Router();

router.get('/health', async (req, res) => {
  const db = await checkConnection();

  return res.json({
    status: 'ok',
    db: db.status,
    ...(db.message ? { db_error: db.message } : {})
  });
});

module.exports = router;
