const request = require('supertest');
const app = require('../src/app');

describe('Security hardening', () => {
  it('trusts exactly one proxy hop (required for correct rate limiting on Render)', () => {
    // Without this, req.ip collapses to the proxy IP for every client and the
    // IP-based login limiter buckets all users together. "1" (not true) also
    // prevents clients from spoofing X-Forwarded-For to evade the limit.
    expect(app.get('trust proxy')).toBe(1);
  });

  it('sends HSTS and clickjacking-protection headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['x-frame-options']).toBe('DENY');
    // Helmet removes the framework fingerprint.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a structured 404 for unknown routes without leaking internals', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found', details: [] }
    });
  });

  it('rejects oversized JSON bodies (>1mb)', async () => {
    const big = 'a'.repeat(1024 * 1024 + 10);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"username":"x","password":"${big}"}`);
    expect(res.status).toBe(413);
  });
});
