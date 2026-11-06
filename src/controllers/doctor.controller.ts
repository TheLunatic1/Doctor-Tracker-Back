import { Request, Response } from 'express';
import mongoose, { FilterQuery } from 'mongoose';
import { Doctor, IDoctor } from '../models/Doctor.js';
import { Patient, IPatient } from '../models/Patient.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ConflictError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/sanitize.js';

interface DoctorQueryParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  specialization?: string;
  hospital?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?:
    | 'newest'
    | 'oldest'
    | 'name_asc'
    | 'name_desc'
    | 'specialization_asc'
    | 'specialization_desc'
    | 'hospital_asc'
    | 'hospital_desc'
    | 'phone_asc'
    | 'phone_desc'
    | 'email_asc'
    | 'email_desc'
    | 'patients_desc'
    | 'patients_asc'
    | 'status_asc'
    | 'status_desc'
    | 'rating_desc'
    | 'rating_asc';
}

export const listDoctors = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as DoctorQueryParams;
  const {
    page = 1,
    limit = 10,
    search,
    specialization,
    hospital,
    status,
    dateFrom,
    dateTo,
    sort = 'newest',
  } = query;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Build filter query utilizing indexes
  const filter: FilterQuery<IDoctor> = {};

  // Patient role: default to their assigned attending doctor
  if (req.user && req.user.role === 'patient' && (query as Record<string, unknown>).scope !== 'all') {
    const pat = await Patient.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(req.user.name)}$`, 'i') },
    });
    if (pat && pat.doctor) {
      filter._id = pat.doctor;
    }
  }

  if (search && search.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { specialization: { $regex: escaped, $options: 'i' } },
      { hospital: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (specialization && specialization !== 'all') {
    filter.specialization = specialization;
  }

  if (hospital && hospital !== 'all') {
    filter.hospital = hospital;
  }

  if (status && status !== 'all') {
    filter.status = status as 'Active' | 'Inactive';
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      filter.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endOfDay;
    }
  }

  // Handle specialized sorting by patient count via aggregation pipeline
  if (sort === 'patients_desc' || sort === 'patients_asc') {
    const sortDir = sort === 'patients_desc' ? -1 : 1;
    const [doctorsWithPatients, countResult] = await Promise.all([
      Doctor.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'patients',
            localField: '_id',
            foreignField: 'doctor',
            as: 'patientDocs',
          },
        },
        {
          $addFields: {
            patientCount: { $size: '$patientDocs' },
          },
        },
        { $project: { patientDocs: 0 } },
        { $sort: { patientCount: sortDir, createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
      ]),
      Doctor.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(countResult / limitNum);
    return sendSuccess(res, doctorsWithPatients, 200, {
      page: pageNum,
      limit: limitNum,
      total: countResult,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
    });
  }

  // Determine standard sort options
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort === 'oldest') sortOption = { createdAt: 1 };
  if (sort === 'newest') sortOption = { createdAt: -1 };
  if (sort === 'name_asc') sortOption = { name: 1 };
  if (sort === 'name_desc') sortOption = { name: -1 };
  if (sort === 'specialization_asc') sortOption = { specialization: 1 };
  if (sort === 'specialization_desc') sortOption = { specialization: -1 };
  if (sort === 'hospital_asc') sortOption = { hospital: 1 };
  if (sort === 'hospital_desc') sortOption = { hospital: -1 };
  if (sort === 'phone_asc') sortOption = { phone: 1 };
  if (sort === 'phone_desc') sortOption = { phone: -1 };
  if (sort === 'email_asc') sortOption = { email: 1 };
  if (sort === 'email_desc') sortOption = { email: -1 };
  if (sort === 'status_asc') sortOption = { status: 1 };
  if (sort === 'status_desc') sortOption = { status: -1 };
  if (sort === 'rating_desc') sortOption = { rating: -1, createdAt: -1 };
  if (sort === 'rating_asc') sortOption = { rating: 1, createdAt: 1 };

  // Parallel count + lean query for optimal performance
  const [doctors, total] = await Promise.all([
    Doctor.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
    Doctor.countDocuments(filter),
  ]);

  // Efficient batch count of patients per doctor
  const doctorIds = doctors.map((d) => d._id);
  const patientCounts = await Patient.aggregate([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(patientCounts.map((pc) => [pc._id.toString(), pc.count as number]));

  const enrichedDoctors = doctors.map((doc) => ({
    ...doc,
    patientCount: countMap.get(doc._id.toString()) || 0,
  }));

  const totalPages = Math.ceil(total / limitNum);

  return sendSuccess(res, enrichedDoctors, 200, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages,
    hasNext: pageNum < totalPages,
    hasPrev: pageNum > 1,
  });
});

export const getDoctor = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const doctor = await Doctor.findById(id).lean();

  if (!doctor) {
    throw new NotFoundError(`Doctor with ID ${id} was not found.`);
  }

  const patientCount = await Patient.countDocuments({ doctor: doctor._id });

  return sendSuccess(res, {
    ...doctor,
    patientCount,
  });
});

export const createDoctor = catchAsync(async (req: Request, res: Response) => {
  const existing = await Doctor.findOne({ email: req.body.email.toLowerCase() });
  if (existing) {
    throw new ConflictError(`A doctor with email '${req.body.email}' already exists.`);
  }

  const doctor = await Doctor.create(req.body);
  return sendSuccess(res, doctor, 201, undefined, 'Doctor created successfully');
});

export const updateDoctor = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (req.body.email) {
    const existing = await Doctor.findOne({
      email: req.body.email.toLowerCase(),
      _id: { $ne: id },
    });
    if (existing) {
      throw new ConflictError(`A doctor with email '${req.body.email}' already exists.`);
    }
  }

  const doctor = await Doctor.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!doctor) {
    throw new NotFoundError(`Doctor with ID ${id} was not found.`);
  }

  return sendSuccess(res, doctor, 200, undefined, 'Doctor updated successfully');
});

export const deleteDoctor = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cascade } = req.query;

  const doctor = await Doctor.findById(id);
  if (!doctor) {
    throw new NotFoundError(`Doctor with ID ${id} was not found.`);
  }

  const patientCount = await Patient.countDocuments({ doctor: id });

  if (patientCount > 0 && cascade !== 'true') {
    throw new ConflictError(
      `Cannot delete doctor '${doctor.name}'. They have ${patientCount} assigned patient(s). Reassign them first or specify ?cascade=true.`,
      { patientCount }
    );
  }

  // If cascade is requested or 0 patients, proceed with deletion
  if (patientCount > 0 && cascade === 'true') {
    await Patient.deleteMany({ doctor: id });
  }

  await Doctor.findByIdAndDelete(id);

  return sendSuccess(
    res,
    { id, deleted: true, deletedPatientsCount: cascade === 'true' ? patientCount : 0 },
    200,
    undefined,
    'Doctor deleted successfully'
  );
});

// Nested Doctor Patients
export const getDoctorPatients = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search } = req.query as { page?: string; limit?: string; search?: string };

  const doctor = await Doctor.findById(id).lean();
  if (!doctor) {
    throw new NotFoundError(`Doctor with ID ${id} was not found.`);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const doctorObjectId = new mongoose.Types.ObjectId(id as string);
  const filter: FilterQuery<IPatient> = { doctor: doctorObjectId as unknown as mongoose.Types.ObjectId };

  if (search && search.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { condition: { $regex: escaped, $options: 'i' } },
      { medicalRecordNumber: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
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

export const addDoctorPatient = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const doctor = await Doctor.findById(id);
  if (!doctor) {
    throw new NotFoundError(`Doctor with ID ${id} was not found.`);
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
    doctor: doctor._id,
    medicalRecordNumber: mrn,
  });

  return sendSuccess(res, patient, 201, undefined, 'Patient added under doctor successfully');
});

export const deleteDoctorPatient = catchAsync(async (req: Request, res: Response) => {
  const { id, patientId } = req.params;

  const patient = await Patient.findOneAndDelete({
    _id: patientId,
    doctor: id,
  });

  if (!patient) {
    throw new NotFoundError(`Patient with ID ${patientId} not found under doctor ${id}.`);
  }

  return sendSuccess(res, { id: patientId, deleted: true }, 200, undefined, 'Patient removed from doctor successfully');
});
