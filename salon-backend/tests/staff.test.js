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

describe('M6 staff routes', () => {
  it('requires auth for staff routes', async () => {
    const res = await request(app).get('/api/staff');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks BILLING_PERSON from staff list', async () => {
    const res = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates staff create payloads', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: '', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED for staff list without DATABASE_URL', async () => {
    const res = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('blocks BILLING_PERSON from deleting staff (owner-only)', async () => {
    const res = await request(app)
      .delete('/api/staff/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates the staff id on delete', async () => {
    const res = await request(app)
      .delete('/api/staff/not-a-uuid')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED when deleting staff without DATABASE_URL', async () => {
    const res = await request(app)
      .delete('/api/staff/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });
});
