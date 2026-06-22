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

describe('M3 catalog routes', () => {
  it('requires auth for catalog routes', async () => {
    const res = await request(app).get('/api/catalog/categories');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('enforces OWNER role for category creation', async () => {
    const res = await request(app)
      .post('/api/catalog/categories')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`)
      .send({ name: 'Test Category' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates service list query params', async () => {
    const res = await request(app)
      .get('/api/catalog/services?status=archived')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED when listing categories without DATABASE_URL', async () => {
    const res = await request(app)
      .get('/api/catalog/categories')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('blocks BILLING_PERSON from deleting a service (owner-only)', async () => {
    const res = await request(app)
      .delete('/api/catalog/services/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates the service id on delete', async () => {
    const res = await request(app)
      .delete('/api/catalog/services/not-a-uuid')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED when deleting a service without DATABASE_URL', async () => {
    const res = await request(app)
      .delete('/api/catalog/services/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });
});
