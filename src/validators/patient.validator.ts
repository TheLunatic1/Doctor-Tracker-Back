import { z } from 'zod';

export const createPatientSchema = {
  body: z.object({
    name: z.string({ required_error: 'Patient name is required' }).min(2, 'Name must be at least 2 characters').max(100),
    age: z.coerce.number({ required_error: 'Age is required' }).int().min(0, 'Age must be >= 0').max(130, 'Age must be <= 130'),
    gender: z.enum(['Male', 'Female', 'Other'], { required_error: 'Gender is required' }),
    phone: z.string({ required_error: 'Phone number is required' }).min(5),
    condition: z.string({ required_error: 'Condition is required' }).min(2),
    doctor: z.string({ required_error: 'Assigned doctor is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID'),
    status: z.enum(['Active', 'Discharged', 'Critical']).optional().default('Active'),
    medicalRecordNumber: z.string().optional(),
    admittedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    notes: z.string().max(2000).optional(),
  }),
};

export const updatePatientSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Patient ID'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    age: z.coerce.number().int().min(0).max(130).optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    phone: z.string().min(5).optional(),
    condition: z.string().min(2).optional(),
    doctor: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID').optional(),
    status: z.enum(['Active', 'Discharged', 'Critical']).optional(),
    medicalRecordNumber: z.string().optional(),
    admittedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    notes: z.string().max(2000).optional(),
  }),
};

export const createNestedPatientSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID'),
  }),
  body: z.object({
    name: z.string({ required_error: 'Patient name is required' }).min(2).max(100),
    age: z.coerce.number({ required_error: 'Age is required' }).int().min(0).max(130),
    gender: z.enum(['Male', 'Female', 'Other']),
    phone: z.string({ required_error: 'Phone number is required' }).min(5),
    condition: z.string({ required_error: 'Condition is required' }).min(2),
    status: z.enum(['Active', 'Discharged', 'Critical']).optional().default('Active'),
    medicalRecordNumber: z.string().optional(),
    admittedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    notes: z.string().max(2000).optional(),
  }),
};

export const patientQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().optional(),
    condition: z.string().optional(),
    doctorId: z.string().optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    status: z.enum(['Active', 'Discharged', 'Critical']).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest', 'age_asc', 'age_desc']).optional().default('newest'),
  }),
};

export const patientParamsSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Patient ID'),
  }),
};

export const nestedPatientParamsSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID'),
    patientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Patient ID'),
  }),
};
