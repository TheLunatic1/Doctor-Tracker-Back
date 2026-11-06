import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/database.js';
import { User, IUser } from '../models/User.js';
import { Doctor, IDoctor } from '../models/Doctor.js';
import { Patient, IPatient } from '../models/Patient.js';

const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'Dermatology',
  'General Medicine',
  'Oncology',
  'Gynecology',
  'Psychiatry',
  'Ophthalmology',
  'Gastroenterology',
  'Endocrinology',
];

const HOSPITALS = [
  'Apollo Hospital',
  'City Health Hospital',
  'National Medical Center',
  'Care Medical Center',
  'Skin Care Hospital',
  'Health Plus Hospital',
  'Square Hospital',
  'United Hospital',
  'Evercare Hospital',
  'Central Hospital',
];

const DOCTOR_NAMES = [
  'Dr. Ayesha Rahman', 'Dr. Imran Hossain', 'Dr. Nadia Karim', 'Dr. Rahat Ahmed',
  'Dr. Farzana Islam', 'Dr. Hasan Mahmud', 'Dr. Sarah Ahmed', 'Dr. Tanvir Alam',
  'Dr. Nusrat Jahan', 'Dr. Mahbubur Rahman', 'Dr. Sabrina Chowdhury', 'Dr. Tariqul Islam',
  'Dr. Bilkis Banu', 'Dr. Kazi Mostafa', 'Dr. Rumana Parvin', 'Dr. Arifur Rahman',
  'Dr. Shahida Akhter', 'Dr. Mizanur Rahman', 'Dr. Dilruba Nasrin', 'Dr. Kamrul Hasan',
  'Dr. Fahmida Sultana', 'Dr. Ziaul Haque', 'Dr. Nasreen Begum', 'Dr. Aminul Islam',
  'Dr. Shirin Akter', 'Dr. Rafiqul Bari', 'Dr. Shamima Nasrin', 'Dr. Moniruzzaman',
  'Dr. Rehana Parvin', 'Dr. Golam Sarwar', 'Dr. Afsana Mimi', 'Dr. Asaduzzaman',
  'Dr. Farhana Yeasmin', 'Dr. Rezaul Karim', 'Dr. Selina Hossain', 'Dr. Mahmudul Hasan',
  'Dr. Rubina Yasmin', 'Dr. Anisur Rahman', 'Dr. Tasnim Ara', 'Dr. Delwar Hossain',
  'Dr. Meherun Nesa', 'Dr. Shafiqul Alam', 'Dr. Parveen Sultana', 'Dr. Shamsul Huda',
  'Dr. Rokeya Begum', 'Dr. Zahid Hasan', 'Dr. Shahnaz Parvin', 'Dr. Abul Kashem'
];

const FIRST_NAMES_MALE = ['Karim', 'Rahim', 'Jamal', 'Kamal', 'Rafiq', 'Shafiq', 'Sohail', 'Tanveer', 'Farhan', 'Nayeem', 'Zubair', 'Fahim', 'Tareq', 'Sajid', 'Rashed', 'Jamil', 'Anwar', 'Salim', 'Habib', 'Mostofa'];
const FIRST_NAMES_FEMALE = ['Fatema', 'Amina', 'Sadia', 'Mariam', 'Sumaiya', 'Tahmina', 'Shabnam', 'Nazma', 'Farida', 'Nasima', 'Roksana', 'Salma', 'Khadija', 'Ruma', 'Tamanna', 'Jannat', 'Sultana', 'Shireen', 'Parul', 'Monira'];
const LAST_NAMES = ['Khan', 'Ahmed', 'Chowdhury', 'Hasan', 'Uddin', 'Mahmud', 'Siddiqui', 'Haque', 'Sikder', 'Bhuiyan', 'Talukder', 'Mia', 'Mollah', 'Patwary', 'Dewan', 'Sarker', 'Majumder', 'Kazi', 'Sheikh', 'Ali'];

const CONDITIONS_BY_SPECIALTY: Record<string, string[]> = {
  Cardiology: ['Hypertension', 'Arrhythmia', 'Coronary Artery Disease', 'Heart Failure', 'Cardiac Checkup'],
  Neurology: ['Migraine', 'Epilepsy', 'Peripheral Neuropathy', 'Stroke Recovery', 'Parkinsonism'],
  Pediatrics: ['Viral Fever', 'Asthma (Pediatric)', 'Bronchitis', 'Nutritional Deficiency', 'Routine Child Checkup'],
  Orthopedics: ['Osteoarthritis', 'Lumbar Strain', 'Fracture Rehab', 'Tendonitis', 'Cervical Spondylosis'],
  Dermatology: ['Eczema', 'Psoriasis', 'Acne Vulgaris', 'Fungal Infection', 'Contact Dermatitis'],
  'General Medicine': ['Type 2 Diabetes', 'Acute Pharyngitis', 'Dyspepsia', 'Fatigue / Anemia', 'General Health Checkup'],
  Oncology: ['Breast Mass Evaluation', 'Chemotherapy Followup', 'Post-Op Monitoring', 'Lymphadenopathy', 'Screening'],
  Gynecology: ['Prenatal Care', 'PCOS', 'Pelvic Pain', 'Postpartum Followup', 'Menopausal Transition'],
  Psychiatry: ['Generalized Anxiety', 'Major Depressive Episode', 'Insomnia', 'Panic Disorder', 'Stress Management'],
  Ophthalmology: ['Cataract Evaluation', 'Glaucoma Followup', 'Diabetic Retinopathy', 'Conjunctivitis', 'Refractive Error'],
  Gastroenterology: ['GERD', 'Irritable Bowel Syndrome', 'Fatty Liver Disease', 'Gastritis', 'Peptic Ulcer'],
  Endocrinology: ['Hypothyroidism', 'Hyperthyroidism', 'Gestational Diabetes', 'Metabolic Syndrome', 'Osteoporosis'],
};

export async function runSeed(customUri?: string): Promise<{
  admin: IUser;
  doctorCount: number;
  patientCount: number;
}> {
  await connectDB(customUri);

  console.info('--- Starting Idempotent Database Seed ---');

  // 1. Seed or update Users for all roles (Admin, Doctor, Staff, Patient)
  const USERS_TO_SEED: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'doctor' | 'staff' | 'patient';
  }[] = [
    {
      name: process.env.ADMIN_NAME || 'Admin User',
      email: (process.env.ADMIN_EMAIL || 'admin@doctortracker.com').toLowerCase(),
      password: process.env.ADMIN_PASSWORD || 'Admin123456!',
      role: 'admin',
    },
    {
      name: 'Dr. S. M. Toha',
      email: 'doctor@doctortracker.com',
      password: 'Doctor123456!',
      role: 'doctor',
    },
    {
      name: 'Clinical Staff Coordinator',
      email: 'staff@doctortracker.com',
      password: 'Staff123456!',
      role: 'staff',
    },
    {
      name: 'Kazi Nazrul Islam',
      email: 'patient@doctortracker.com',
      password: 'Patient123456!',
      role: 'patient',
    },
  ];

  let admin: IUser | null = null;
  for (const userDef of USERS_TO_SEED) {
    let u = await User.findOne({ email: userDef.email });
    const passwordHash = await User.hashPassword(userDef.password);
    if (!u) {
      u = await User.create({
        name: userDef.name,
        email: userDef.email,
        passwordHash,
        role: userDef.role,
      });
      console.info(`User created [${userDef.role}]: ${userDef.email}`);
    } else {
      u.name = userDef.name;
      u.role = userDef.role;
      u.passwordHash = passwordHash;
      await u.save();
      console.info(`User verified [${userDef.role}]: ${userDef.email}`);
    }
    if (userDef.role === 'admin') {
      admin = u;
    }
  }

  if (!admin) {
    throw new Error('Failed to initialize admin user');
  }

  // 2. Check existing doctors and patients
  const forceSeed = process.argv.includes('--force') || process.env.FORCE_SEED === 'true';
  const existingDoctorCount = await Doctor.countDocuments();
  if (existingDoctorCount >= 40 && !forceSeed) {
    // Ensure all existing doctors have local avatar image paths
    const docs = await Doctor.find({}).sort({ createdAt: 1 });
    let updatedCount = 0;
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const localAvatar = `/images/doctors/doctor-${(i % 16) + 1}.jpg`;
      if (doc.avatar !== localAvatar) {
        doc.avatar = localAvatar;
        await doc.save();
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.info(`Updated avatars for ${updatedCount} existing doctors with local images.`);
    }
    const patientCount = await Patient.countDocuments();
    console.info(`Database already seeded with ${existingDoctorCount} doctors and ${patientCount} patients.`);
    return { admin, doctorCount: existingDoctorCount, patientCount };
  }

  // Clear existing non-admin data for fresh seed if partially populated
  await Doctor.deleteMany({});
  await Patient.deleteMany({});

  // 3. Create 48 Doctors
  const doctorsToInsert: Array<Partial<IDoctor>> = DOCTOR_NAMES.map((name, index) => {
    const specialization = SPECIALIZATIONS[index % SPECIALIZATIONS.length];
    const hospital = HOSPITALS[index % HOSPITALS.length];
    const cleanName = name.replace('Dr. ', '').toLowerCase().replace(/[^a-z]/g, '');
    const email = `${cleanName}${index + 1}@${hospital.toLowerCase().replace(/[^a-z]/g, '')}.com`;
    const phone = `+880 1${Math.floor(600000000 + Math.random() * 399999999)}`;
    const qualifications = ['MBBS, MD', 'MBBS, FCPS', 'MBBS, MS', 'MBBS, MRCP', 'MBBS, MPH'];
    const qualification = qualifications[index % qualifications.length];

    // Distribute creation dates over past 12 months
    const now = new Date();
    const createdDaysAgo = Math.floor(Math.random() * 330) + 10;
    const createdAt = new Date(now.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);

    return {
      name,
      specialization,
      hospital,
      phone,
      email,
      status: 'Active' as const,
      qualification,
      yearsExperience: Math.floor(Math.random() * 20) + 3,
      rating: parseFloat((4.3 + Math.random() * 0.7).toFixed(1)),
      bio: `Dedicated specialist in ${specialization} at ${hospital} with over ${Math.floor(Math.random() * 15) + 5} years of healthcare practice.`,
      avatar: `/images/doctors/doctor-${(index % 16) + 1}.jpg`,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const createdDoctors = await Doctor.insertMany(doctorsToInsert);
  console.info(`Created ${createdDoctors.length} doctors.`);

  // 4. Create 480 Patients distributed across doctors
  const patientsToInsert: Array<Partial<IPatient>> = [];
  let patientCounter = 1;

  for (const doc of createdDoctors) {
    // Generate between 6 and 18 patients per doctor (totaling ~500)
    const patientCountForDoc = Math.floor(Math.random() * 12) + 6;
    const specialtyConditions = CONDITIONS_BY_SPECIALTY[doc.specialization || 'Cardiology'] || ['General Checkup'];

    for (let p = 0; p < patientCountForDoc; p++) {
      const isMale = Math.random() > 0.48;
      const firstName = isMale
        ? FIRST_NAMES_MALE[Math.floor(Math.random() * FIRST_NAMES_MALE.length)]
        : FIRST_NAMES_FEMALE[Math.floor(Math.random() * FIRST_NAMES_FEMALE.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const gender = isMale ? 'Male' : 'Female';
      const age = Math.floor(Math.random() * 70) + 12;
      const condition = specialtyConditions[Math.floor(Math.random() * specialtyConditions.length)];
      const phone = `+880 1${Math.floor(300000000 + Math.random() * 699999999)}`;
      
      const statuses: ('Active' | 'Discharged' | 'Critical')[] = ['Active', 'Active', 'Active', 'Discharged', 'Critical'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      // Generate date after doctor was created
      const docCreatedTime = new Date(doc.createdAt || new Date()).getTime();
      const nowTime = Date.now();
      const admittedTimestamp = docCreatedTime + Math.random() * (nowTime - docCreatedTime);
      const admittedAt = new Date(admittedTimestamp);

      const initials = patientName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase();
      const mrn = `${initials}${String(patientCounter).padStart(4, '0')}`;

      patientsToInsert.push({
        name: patientName,
        age,
        gender,
        phone,
        condition,
        doctor: doc._id,
        status,
        medicalRecordNumber: mrn,
        admittedAt,
        notes: `Clinical observation for ${condition}. Regular follow-up scheduled.`,
        createdAt: admittedAt,
        updatedAt: admittedAt,
      });

      patientCounter++;
    }
  }

  const createdPatients = await Patient.insertMany(patientsToInsert);
  console.info(`Created ${createdPatients.length} patients.`);
  console.info('--- Database Seed Completed Successfully ---');

  return {
    admin,
    doctorCount: createdDoctors.length,
    patientCount: createdPatients.length,
  };
}

// Direct execution from CLI
if (process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'))) {
  runSeed()
    .then(() => disconnectDB())
    .catch((err) => {
      console.error('Seed script encountered error:', err);
      process.exit(1);
    });
}
