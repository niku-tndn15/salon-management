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

describe('M8 users routes', () => {
  it('requires OWNER for users list', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor('BILLING_PERSON')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates user creation payloads', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({ username: 'ab', full_name: '', role: 'NOPE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prevents deleting your own user account', async () => {
    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
