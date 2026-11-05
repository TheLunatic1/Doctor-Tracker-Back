import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { COOKIE_NAME } from '../src/services/token.service.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();

  // Create a known test user
  const passwordHash = await User.hashPassword('Secret123!');
  await User.create({
    name: 'Dr. Jane Doe',
    email: 'jane.doe@example.com',
    passwordHash,
    role: 'doctor',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 2 Quality Gate: Authentication API', () => {
  it('Valid login sets httpOnly cookie and returns user and token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane.doe@example.com', password: 'Secret123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('jane.doe@example.com');
    expect(res.body.data.user.name).toBe('Dr. Jane Doe');
    expect(res.body.data.token).toBeDefined();

    // Check Set-Cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : (cookies as string);
    expect(cookieHeader).toContain(COOKIE_NAME);
    expect(cookieHeader.toLowerCase()).toContain('httponly');
  });

  it('Login with incorrect password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane.doe@example.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid email or password');
  });

  it('Login with non-existent email returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'Secret123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid email or password');
  });

  it('Login with invalid input format returns 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invalid-email-format', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details).toBeDefined();
  });

  it('Protected route GET /api/v1/auth/me returns 401 without cookie or token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('token missing');
  });

  it('Protected route GET /api/v1/auth/me returns 200 with valid cookie', async () => {
    // First login to get the cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane.doe@example.com', password: 'Secret123!' });

    const cookie = loginRes.headers['set-cookie'];

    // Now call /auth/me with cookie
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('jane.doe@example.com');
  });

  it('Protected route GET /api/v1/auth/me returns 200 with Bearer authorization header', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane.doe@example.com', password: 'Secret123!' });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('jane.doe@example.com');
  });

  it('POST /api/v1/auth/logout clears auth cookie', async () => {
    const logoutRes = await request(app).post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const cookies = logoutRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : (cookies as string);
    // Cleared cookie has dt_auth_token=; and expires in past (1970)
    expect(cookieHeader).toContain(COOKIE_NAME);
  });
});
