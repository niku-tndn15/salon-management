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

describe('M8 settings routes', () => {
  it('requires auth for settings routes', async () => {
    const res = await request(app).get('/api/settings/salon');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks BILLING_PERSON from salon settings', async () => {
    const res = await request(app)
      .get('/api/settings/salon')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates salon GST payloads', async () => {
    const res = await request(app)
      .put('/api/settings/salon')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: 'Salon', address: 'Address', phone: '1234567890', gst_enabled: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED for discounts without DATABASE_URL', async () => {
    const res = await request(app)
      .get('/api/settings/discounts')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('accepts a partial salon profile update (name only)', async () => {
    const res = await request(app)
      .put('/api/settings/salon')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ name: 'Glamour Salon' });

    // Passes validation (partial allowed) and reaches the service layer.
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('accepts a partial GST-only salon update', async () => {
    const res = await request(app)
      .put('/api/settings/salon')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ gst_enabled: false });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });

  it('blocks BILLING_PERSON from deleting a discount offer', async () => {
    const res = await request(app)
      .delete('/api/settings/discounts/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates the discount id on delete', async () => {
    const res = await request(app)
      .delete('/api/settings/discounts/not-a-uuid')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_NOT_CONFIGURED when deleting a discount without DATABASE_URL', async () => {
    const res = await request(app)
      .delete('/api/settings/discounts/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED');
  });
});
