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

describe('M4 customer routes', () => {
  it('requires auth for customer routes', async () => {
    const res = await request(app).get('/api/customers');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks STAFF from customer list', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenFor('STAFF')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates customer create payloads', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: '', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED for listing customers without DATABASE_URL', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });
});
