const { generateInvoiceNumber, generateRefundNumber } = require('../../src/utils/invoiceNumber');

function mockClient(seq) {
  return {
    query: jest.fn().mockResolvedValue({ rows: [{ seq }] })
  };
}

describe('invoice and refund number generators', () => {
  it('generates SAL-YYYYMM-NNNN invoice numbers from the database sequence', async () => {
    const client = mockClient(42);

    const number = await generateInvoiceNumber(client);

    expect(number).toMatch(/^SAL-\d{6}-0042$/);
    expect(client.query).toHaveBeenCalledWith("SELECT nextval('invoice_seq') AS seq");
  });

  it('generates REF-YYYYMM-NNNN refund numbers from the database sequence', async () => {
    const client = mockClient(7);

    const number = await generateRefundNumber(client);

    expect(number).toMatch(/^REF-\d{6}-0007$/);
    expect(client.query).toHaveBeenCalledWith("SELECT nextval('refund_seq') AS seq");
  });
});
