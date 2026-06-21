const { getCommissionRateOnDate } = require('../../src/utils/commission');

describe('commission rate resolver', () => {
  it('returns the active commission rate for the requested service date', async () => {
    const dbClient = {
      query: jest.fn().mockResolvedValue({ rows: [{ commission_pct: '12.50' }] })
    };

    const rate = await getCommissionRateOnDate('staff-id', '2026-06-16', dbClient);

    expect(rate).toBe(12.5);
    expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining('effective_from <= $2'), ['staff-id', '2026-06-16']);
  });

  it('falls back to 0 when no commission history exists', async () => {
    const dbClient = {
      query: jest.fn().mockResolvedValue({ rows: [] })
    };

    await expect(getCommissionRateOnDate('staff-id', '2026-06-16', dbClient)).resolves.toBe(0);
  });
});
