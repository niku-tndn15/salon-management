async function getCommissionRateOnDate(staffId, serviceDate, dbClient) {
  const { rows } = await dbClient.query(
    `SELECT commission_pct
     FROM commission_rate_history
     WHERE staff_id = $1
       AND effective_from <= $2
       AND (effective_to IS NULL OR effective_to >= $2)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [staffId, serviceDate]
  );

  return Number(rows[0]?.commission_pct || 0);
}

module.exports = {
  getCommissionRateOnDate
};
