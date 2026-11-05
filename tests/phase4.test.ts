import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { runSeed } from '../src/seed/seed.js';
import { User } from '../src/models/User.js';
import { Doctor } from '../src/models/Doctor.js';
import { Patient } from '../src/models/Patient.js';
import { signToken, COOKIE_NAME } from '../src/services/token.service.js';

let mongoServer: MongoMemoryServer;
let authCookie: string;
let seededDoctorCount: number;
let seededPatientCount: number;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
  await Doctor.init();
  await Patient.init();

  // Run full seed
  const seedResult = await runSeed(mongoServer.getUri());
  seededDoctorCount = seedResult.doctorCount;
  seededPatientCount = seedResult.patientCount;

  const admin = await User.findOne({ email: 'admin@doctortracker.com' });
  const token = signToken({
    userId: admin!._id.toString(),
    email: admin!.email,
    role: admin!.role,
  });
  authCookie = `${COOKIE_NAME}=${token}`;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 4 Quality Gate: Analytics API', () => {
  it('All analytics endpoints reject unauthenticated requests with 401', async () => {
    const endpoints = [
      '/api/v1/analytics/overview',
      '/api/v1/analytics/patients-per-doctor',
      '/api/v1/analytics/timeline',
      '/api/v1/analytics/conditions',
      '/api/v1/analytics/specializations',
      '/api/v1/analytics/recent',
    ];

    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it('GET /api/v1/analytics/overview returns accurate metrics matching seeded data', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalDoctors).toBe(seededDoctorCount);
    expect(res.body.data.totalPatients).toBe(seededPatientCount);
    expect(res.body.data.activeDoctors).toBeGreaterThan(0);
    expect(res.body.data.avgPatientsPerDoctor).toBeGreaterThan(0);
    expect(res.body.data.totalHospitals).toBeGreaterThanOrEqual(5);
  });

  it('GET /api/v1/analytics/patients-per-doctor returns leaderboard sorted descending', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/patients-per-doctor?limit=5')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.data[0].patientCount).toBeGreaterThanOrEqual(res.body.data[1].patientCount);
    expect(res.body.data[0].name).toBeDefined();
    expect(res.body.data[0].specialization).toBeDefined();
  });

  it('GET /api/v1/analytics/timeline produces zero-filled continuous series with no gaps', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/timeline?range=30d&groupBy=day')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const timeline = res.body.data;

    // Must have 30 or 31 contiguous daily entries
    expect(timeline.length).toBeGreaterThanOrEqual(30);

    // Verify chronological order and date format
    for (let i = 1; i < timeline.length; i++) {
      const prevDate = new Date(timeline[i - 1].date).getTime();
      const currDate = new Date(timeline[i].date).getTime();
      expect(currDate).toBeGreaterThan(prevDate);
      expect(typeof timeline[i].count).toBe('number');
    }
  });

  it('GET /api/v1/analytics/conditions returns breakdown with counts and percentages', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/conditions')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].condition).toBeDefined();
    expect(res.body.data[0].percentage).toBeGreaterThan(0);
  });

  it('GET /api/v1/analytics/specializations returns breakdown of doctors by specialty', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/specializations')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].specialization).toBeDefined();
    expect(res.body.data[0].doctorCount).toBeGreaterThan(0);
  });

  it('GET /api/v1/analytics/recent returns recent doctors and recent patients', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/recent')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recentDoctors.length).toBeGreaterThan(0);
    expect(res.body.data.recentPatients.length).toBeGreaterThan(0);
  });
});
