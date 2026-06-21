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

describe('M7 dashboard routes', () => {
  it('requires auth for dashboard routes', async () => {
    const res = await request(app).get('/api/dashboard/kpis');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks STAFF from dashboard KPIs', async () => {
    const res = await request(app)
      .get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor('STAFF')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates date ranges', async () => {
    const res = await request(app)
      .get('/api/dashboard/kpis?start_date=bad-date')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED for KPIs without DATABASE_URL', async () => {
    const res = await request(app)
      .get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });
});
