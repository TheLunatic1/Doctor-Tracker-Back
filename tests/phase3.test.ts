import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Doctor } from '../src/models/Doctor.js';
import { Patient } from '../src/models/Patient.js';
import { signToken, COOKIE_NAME } from '../src/services/token.service.js';

let mongoServer: MongoMemoryServer;
let authCookie: string;
let testDoctorId: string;
let testPatientId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
  await Doctor.init();
  await Patient.init();
  await Doctor.syncIndexes();
  await Patient.syncIndexes();

  const user = await User.create({
    name: 'Admin Tester',
    email: 'admin.tester@example.com',
    passwordHash: await User.hashPassword('Pass123!'),
    role: 'admin',
  });

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  authCookie = `${COOKIE_NAME}=${token}`;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 3 Quality Gate: Doctors & Patients API', () => {
  it('POST /api/v1/doctors creates a doctor successfully (201)', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', authCookie)
      .send({
        name: 'Dr. John Smith',
        specialization: 'Cardiology',
        hospital: 'Apollo Hospital',
        phone: '+880 1711 000111',
        email: 'john.smith@apollo.com',
        qualification: 'MBBS, MD',
        yearsExperience: 10,
        rating: 4.9,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Dr. John Smith');
    testDoctorId = res.body.data._id;
  });

  it('POST /api/v1/doctors fails with 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', authCookie)
      .send({
        name: 'Duplicate Doctor',
        specialization: 'Cardiology',
        hospital: 'Apollo Hospital',
        phone: '+880 1711 000222',
        email: 'john.smith@apollo.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already exists');
  });

  it('POST /api/v1/doctors fails with 400 for validation errors', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', authCookie)
      .send({
        name: 'A', // too short
        email: 'invalid-email',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/doctors/:id returns the doctor with patient count', async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${testDoctorId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Dr. John Smith');
    expect(res.body.data.patientCount).toBe(0);
  });

  it('GET /api/v1/doctors/:id returns 404 for non-existent doctor', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/doctors/${fakeId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('PUT /api/v1/doctors/:id updates doctor successfully', async () => {
    const res = await request(app)
      .put(`/api/v1/doctors/${testDoctorId}`)
      .set('Cookie', authCookie)
      .send({ rating: 5.0, qualification: 'MBBS, MD, FACC' });

    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5.0);
    expect(res.body.data.qualification).toBe('MBBS, MD, FACC');
  });

  it('POST /api/v1/doctors/:id/patients adds a nested patient under doctor', async () => {
    const res = await request(app)
      .post(`/api/v1/doctors/${testDoctorId}/patients`)
      .set('Cookie', authCookie)
      .send({
        name: 'Patient Alice',
        age: 32,
        gender: 'Female',
        phone: '+880 1811 123456',
        condition: 'Hypertension',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Patient Alice');
    expect(res.body.data.doctor.toString()).toBe(testDoctorId);
    testPatientId = res.body.data._id;
  });

  it('GET /api/v1/doctors/:id/patients lists patients under doctor', async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${testDoctorId}/patients`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('DELETE /api/v1/doctors/:id blocks deletion when doctor has active patients', async () => {
    const res = await request(app)
      .delete(`/api/v1/doctors/${testDoctorId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('assigned patient(s)');
  });

  it('DELETE /api/v1/doctors/:id/patients/:patientId removes patient from doctor', async () => {
    const res = await request(app)
      .delete(`/api/v1/doctors/${testDoctorId}/patients/${testPatientId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/v1/doctors/:id succeeds after patients are removed', async () => {
    const res = await request(app)
      .delete(`/api/v1/doctors/${testDoctorId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Patients API: dedicated list, pagination, filtering, update, delete', async () => {
    // Create a new doctor and 25 patients to test pagination math
    const doc = await Doctor.create({
      name: 'Dr. Sarah Connor',
      specialization: 'Neurology',
      hospital: 'City Health Hospital',
      phone: '+880 1711 999888',
      email: 'sarah.connor@cityhealth.com',
    });

    const patientPromises = Array.from({ length: 25 }).map((_, i) =>
      Patient.create({
        name: `Test Patient ${i + 1}`,
        age: 20 + i,
        gender: i % 2 === 0 ? 'Male' : 'Female',
        phone: `+880 1700 000${String(i).padStart(3, '0')}`,
        condition: i % 2 === 0 ? 'Migraine' : 'Epilepsy',
        doctor: doc._id,
        admittedAt: new Date(Date.now() - i * 86400000),
      })
    );
    await Promise.all(patientPromises);

    // Test Pagination math (page 2, limit 10)
    const page2Res = await request(app)
      .get('/api/v1/patients?page=2&limit=10')
      .set('Cookie', authCookie);

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.meta.page).toBe(2);
    expect(page2Res.body.meta.limit).toBe(10);
    expect(page2Res.body.meta.total).toBe(25);
    expect(page2Res.body.meta.totalPages).toBe(3);
    expect(page2Res.body.meta.hasNext).toBe(true);
    expect(page2Res.body.meta.hasPrev).toBe(true);
    expect(page2Res.body.data.length).toBe(10);

    // Test Search & Filter
    const searchRes = await request(app)
      .get('/api/v1/patients?condition=Migraine&limit=50')
      .set('Cookie', authCookie);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.every((p: any) => p.condition === 'Migraine')).toBe(true);

    // Test Patient Update
    const patientToUpdate = page2Res.body.data[0];
    const updateRes = await request(app)
      .put(`/api/v1/patients/${patientToUpdate._id}`)
      .set('Cookie', authCookie)
      .send({ status: 'Discharged' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('Discharged');

    // Test Patient Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/patients/${patientToUpdate._id}`)
      .set('Cookie', authCookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);
  });

  it('Index usage verification via .explain() confirms IXSCAN', async () => {
    // Main doctor query with specialization & createdAt sort
    const docExplain = await Doctor.find({ specialization: 'Neurology' })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    // Execution plan verification
    const plan = docExplain.queryPlanner || (docExplain.stages && docExplain.stages[0]?.queryPlanner);
    const winningStage = plan?.winningPlan?.stage || plan?.winningPlan?.inputStage?.stage;
    
    // Check that MongoDB utilized IXSCAN for indexed fields
    const isUsingIndex =
      JSON.stringify(docExplain).includes('IXSCAN') ||
      winningStage === 'IXSCAN' ||
      plan?.winningPlan?.inputStage?.inputStage?.stage === 'IXSCAN';

    expect(isUsingIndex).toBe(true);

    // Main patient query with doctor & createdAt sort
    const patientExplain = await Patient.find({ doctor: new mongoose.Types.ObjectId() })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    const isPatientUsingIndex = JSON.stringify(patientExplain).includes('IXSCAN');
    expect(isPatientUsingIndex).toBe(true);
  });
});
