const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns API status even when DATABASE_URL is not configured', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(['not_configured', 'connected', 'error']).toContain(res.body.db);
  });
});
