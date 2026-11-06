import { Request, Response } from 'express';
import mongoose, { FilterQuery } from 'mongoose';
import { Patient, IPatient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/sanitize.js';

interface PatientQueryParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  condition?: string;
  doctorId?: string;
  gender?: 'Male' | 'Female' | 'Other';
  status?: 'Active' | 'Discharged' | 'Critical';
  dateFrom?: string;
  dateTo?: string;
  sort?:
    | 'name_asc'
    | 'name_desc'
    | 'newest'
    | 'oldest'
    | 'age_asc'
    | 'age_desc'
    | 'condition_asc'
    | 'condition_desc'
    | 'status_asc'
    | 'status_desc';
}

export const listPatients = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as PatientQueryParams;
  const {
    page = 1,
    limit = 10,
    search,
    condition,
    doctorId,
    gender,
    status,
    dateFrom,
    dateTo,
    sort = 'newest',
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter: FilterQuery<IPatient> = {};

  // Patient role isolation: Patients can only retrieve their own record
  if (req.user && req.user.role === 'patient') {
    filter.name = { $regex: new RegExp(`^${escapeRegex(req.user.name)}$`, 'i') };
  }

  if (search && search.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { medicalRecordNumber: { $regex: escaped, $options: 'i' } },
      { condition: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (condition && condition !== 'all') {
    filter.condition = condition;
  }

  if (doctorId && doctorId !== 'all') {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestError('Invalid doctorId parameter');
    }
    filter.doctor = new mongoose.Types.ObjectId(doctorId);
  }

  if (gender) {
    filter.gender = gender;
  }

  if (status) {
    filter.status = status;
  }

  if (dateFrom || dateTo) {
    filter.admittedAt = {};
    if (dateFrom) {
      filter.admittedAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filter.admittedAt.$lte = endOfDay;
    }
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') sortOption = { createdAt: 1 };
  if (sort === 'newest') sortOption = { createdAt: -1 };
  if (sort === 'name_asc') sortOption = { name: 1 };
  if (sort === 'name_desc') sortOption = { name: -1 };
  if (sort === 'age_asc') sortOption = { age: 1 };
  if (sort === 'age_desc') sortOption = { age: -1 };
  if (sort === 'condition_asc') sortOption = { condition: 1 };
  if (sort === 'condition_desc') sortOption = { condition: -1 };
  if (sort === 'status_asc') sortOption = { status: 1 };
  if (sort === 'status_desc') sortOption = { status: -1 };

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .populate('doctor', 'name specialization hospital email avatar')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return sendSuccess(res, patients, 200, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages,
    hasNext: pageNum < totalPages,
    hasPrev: pageNum > 1,
  });
});

export const getPatient = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const patient = await Patient.findById(id)
    .populate('doctor', 'name specialization hospital email avatar phone')
    .lean();

  if (!patient) {
    throw new NotFoundError(`Patient with ID ${id} was not found.`);
  }

  // Patients can only view their own record
  if (req.user && req.user.role === 'patient' && patient.name.toLowerCase() !== req.user.name.toLowerCase()) {
    throw new ForbiddenError('You can only access your own patient medical record.');
  }

  return sendSuccess(res, patient, 200);
});

export const createPatient = catchAsync(async (req: Request, res: Response) => {
  const doctor = await Doctor.findById(req.body.doctor);
  if (!doctor) {
    throw new BadRequestError(`Assigned doctor with ID ${req.body.doctor} does not exist.`);
  }

  let mrn = req.body.medicalRecordNumber;
  if (!mrn) {
    const initials = req.body.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase();
    const count = await Patient.countDocuments();
    mrn = `${initials}${String(count + 1).padStart(4, '0')}`;
  }

  const patient = await Patient.create({
    ...req.body,
    medicalRecordNumber: mrn,
  });

  const populated = await Patient.findById(patient._id)
    .populate('doctor', 'name specialization hospital email')
    .lean();

  return sendSuccess(res, populated, 201, undefined, 'Patient registered successfully');
});

export const updatePatient = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (req.body.doctor) {
    const doctor = await Doctor.findById(req.body.doctor);
    if (!doctor) {
      throw new BadRequestError(`Assigned doctor with ID ${req.body.doctor} does not exist.`);
    }
  }

  const patient = await Patient.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate('doctor', 'name specialization hospital email')
    .lean();

  if (!patient) {
    throw new NotFoundError(`Patient with ID ${id} was not found.`);
  }

  return sendSuccess(res, patient, 200, undefined, 'Patient updated successfully');
});

export const deletePatient = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) {
    throw new NotFoundError(`Patient with ID ${id} was not found.`);
  }

  return sendSuccess(res, { id, deleted: true }, 200, undefined, 'Patient deleted successfully');
});
