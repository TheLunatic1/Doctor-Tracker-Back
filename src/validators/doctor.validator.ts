import { z } from 'zod';

export const createDoctorSchema = {
  body: z.object({
    name: z.string({ required_error: 'Doctor name is required' }).min(2, 'Name must be at least 2 characters').max(100),
    specialization: z.string({ required_error: 'Specialization is required' }).min(2),
    hospital: z.string({ required_error: 'Hospital is required' }).min(2),
    phone: z.string({ required_error: 'Phone number is required' }).min(5),
    email: z.string({ required_error: 'Email is required' }).email('Valid email address is required').toLowerCase().trim(),
    status: z.enum(['Active', 'Inactive']).optional().default('Active'),
    avatar: z.string().optional().or(z.literal('')),
    qualification: z.string().optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    rating: z.number().min(1).max(5).optional(),
    bio: z.string().max(1000).optional(),
  }),
};

export const updateDoctorSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    specialization: z.string().min(2).optional(),
    hospital: z.string().min(2).optional(),
    phone: z.string().min(5).optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    avatar: z.string().optional(),
    qualification: z.string().optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    rating: z.number().min(1).max(5).optional(),
    bio: z.string().max(1000).optional(),
  }),
};

export const doctorQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().optional(),
    specialization: z.string().optional(),
    hospital: z.string().optional(),
    status: z.string().optional(),
    dateFrom: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    dateTo: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest', 'rating_desc']).optional().default('newest'),
  }),
};

export const doctorParamsSchema = {
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Doctor ID'),
  }),
};
