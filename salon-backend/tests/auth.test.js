const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');

function tokenFor(role = 'OWNER') {
  return jwt.sign({
    id: '00000000-0000-0000-0000-000000000001',
    username: role.toLowerCase(),
    role,
    name: `${role} User`
  }, env.JWT_SECRET);
}

describe('M2 auth routes', () => {
  it('rejects missing auth token on /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates login payloads', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED for login when DATABASE_URL is absent', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'Admin@123' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('exposes the dummy-login flag on /api/auth/config', async () => {
    const res = await request(app).get('/api/auth/config');

    expect(res.status).toBe(200);
    expect(typeof res.body.data.dummyLoginEnabled).toBe('boolean');
  });

  it('returns DB_NOT_CONFIGURED for dummy-login when DATABASE_URL is absent', async () => {
    const res = await request(app).post('/api/auth/dummy-login');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('validates weak password changes before hitting the database', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ currentPassword: 'Admin@123', newPassword: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
