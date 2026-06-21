async function generateInvoiceNumber(client) {
  const { rows } = await client.query("SELECT nextval('invoice_seq') AS seq");
  const seq = Number(rows[0].seq);
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `SAL-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

async function generateRefundNumber(client) {
  const { rows } = await client.query("SELECT nextval('refund_seq') AS seq");
  const seq = Number(rows[0].seq);
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `REF-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

module.exports = {
  generateInvoiceNumber,
  generateRefundNumber
};
