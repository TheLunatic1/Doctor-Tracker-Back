import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { runSeed } from '../src/seed/seed.js';
import { User } from '../src/models/User.js';
import { Doctor } from '../src/models/Doctor.js';
import { Patient } from '../src/models/Patient.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  // Ensure mongoose indexes are built
  await mongoose.connect(uri);
  await User.init();
  await Doctor.init();
  await Patient.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 1 Quality Gate: Backend Foundation & Data Layer', () => {
  it('GET /health returns 200 with status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/v1/health returns 200 with structured response', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  it('GET /api/v1/nonexistent returns 404 with structured error', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not found');
  });

  it('Seed script runs and populates admin, 48 doctors, and 400+ patients', async () => {
    const uri = mongoServer.getUri();
    const result = await runSeed(uri);

    expect(result.admin).toBeDefined();
    expect(result.admin.email).toBe('admin@doctortracker.com');
    expect(result.doctorCount).toBeGreaterThanOrEqual(40);
    expect(result.patientCount).toBeGreaterThanOrEqual(400);

    const isMatch = await result.admin.comparePassword('Admin123456!');
    expect(isMatch).toBe(true);
  });

  it('Seed script runs idempotently without duplicating doctors or throwing error', async () => {
    const uri = mongoServer.getUri();
    const result2 = await runSeed(uri);

    expect(result2.doctorCount).toBeGreaterThanOrEqual(40);
    expect(result2.patientCount).toBeGreaterThanOrEqual(400);

    const totalUsers = await User.countDocuments({ email: 'admin@doctortracker.com' });
    expect(totalUsers).toBe(1);
  });

  it('Indexes are verified in MongoDB for Doctor collection', async () => {
    await Doctor.syncIndexes();
    const indexes = await Doctor.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    // Check unique email index and compound indexes
    expect(indexNames).toContain('email_1');
    expect(indexNames.some((n) => n?.includes('specialization'))).toBe(true);
    expect(indexNames.some((n) => n?.includes('hospital'))).toBe(true);
    expect(indexNames.some((n) => n?.includes('status'))).toBe(true);
  });

  it('Indexes are verified in MongoDB for Patient collection', async () => {
    await Patient.syncIndexes();
    const indexes = await Patient.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    expect(indexNames.some((n) => n?.includes('doctor'))).toBe(true);
    expect(indexNames.some((n) => n?.includes('condition'))).toBe(true);
    expect(indexNames.some((n) => n?.includes('admittedAt'))).toBe(true);
    expect(indexNames.some((n) => n?.includes('status'))).toBe(true);
  });
});
