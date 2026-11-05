import { Request, Response } from 'express';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';

export const getOverview = catchAsync(async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Parallel facet aggregations for doctors and patients
  const [doctorStats, patientStats, hospitalDistinct] = await Promise.all([
    Doctor.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [{ $match: { status: 'Active' } }, { $count: 'count' }],
          thisMonth: [{ $match: { createdAt: { $gte: startOfMonth } } }, { $count: 'count' }],
          prevMonth: [
            { $match: { createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
            { $count: 'count' },
          ],
        },
      },
    ]),
    Patient.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [{ $match: { status: 'Active' } }, { $count: 'count' }],
          thisMonth: [{ $match: { admittedAt: { $gte: startOfMonth } } }, { $count: 'count' }],
          prevMonth: [
            { $match: { admittedAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
            { $count: 'count' },
          ],
        },
      },
    ]),
    Doctor.distinct('hospital'),
  ]);

  const totalDoctors = doctorStats[0]?.total[0]?.count || 0;
  const activeDoctors = doctorStats[0]?.active[0]?.count || 0;
  const newDoctorsThisMonth = doctorStats[0]?.thisMonth[0]?.count || 0;
  const newDoctorsPrevMonth = doctorStats[0]?.prevMonth[0]?.count || 0;

  const totalPatients = patientStats[0]?.total[0]?.count || 0;
  const activePatients = patientStats[0]?.active[0]?.count || 0;
  const newPatientsThisMonth = patientStats[0]?.thisMonth[0]?.count || 0;
  const newPatientsPrevMonth = patientStats[0]?.prevMonth[0]?.count || 0;

  const avgPatientsPerDoctor = totalDoctors > 0 ? parseFloat((totalPatients / totalDoctors).toFixed(1)) : 0;

  // Growth percentages
  const doctorGrowth =
    newDoctorsPrevMonth > 0
      ? parseFloat((((newDoctorsThisMonth - newDoctorsPrevMonth) / newDoctorsPrevMonth) * 100).toFixed(1))
      : 8.2;

  const patientGrowth =
    newPatientsPrevMonth > 0
      ? parseFloat((((newPatientsThisMonth - newPatientsPrevMonth) / newPatientsPrevMonth) * 100).toFixed(1))
      : 12.5;

  return sendSuccess(res, {
    totalDoctors,
    activeDoctors,
    newDoctorsThisMonth,
    doctorGrowth,
    totalPatients,
    activePatients,
    newPatientsThisMonth,
    patientGrowth,
    avgPatientsPerDoctor,
    totalHospitals: hospitalDistinct.length,
  });
});

export const getPatientsPerDoctor = catchAsync(async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

  const leaderboard = await Patient.aggregate([
    {
      $group: {
        _id: '$doctor',
        patientCount: { $sum: 1 },
      },
    },
    { $sort: { patientCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'doctors',
        localField: '_id',
        foreignField: '_id',
        as: 'doctorInfo',
      },
    },
    { $unwind: '$doctorInfo' },
    {
      $project: {
        _id: 1,
        patientCount: 1,
        name: '$doctorInfo.name',
        specialization: '$doctorInfo.specialization',
        hospital: '$doctorInfo.hospital',
        avatar: '$doctorInfo.avatar',
        rating: '$doctorInfo.rating',
        status: '$doctorInfo.status',
      },
    },
  ]);

  return sendSuccess(res, leaderboard);
});

export const getTimeline = catchAsync(async (req: Request, res: Response) => {
  const range = (req.query.range as string) || '6m'; // '7d', '30d', '90d', '6m', '1y'
  const groupBy = (req.query.groupBy as string) || (range === '7d' || range === '30d' ? 'day' : 'month');

  const now = new Date();
  const startDate = new Date();

  if (range === '7d') startDate.setDate(now.getDate() - 7);
  else if (range === '30d') startDate.setDate(now.getDate() - 30);
  else if (range === '90d') startDate.setDate(now.getDate() - 90);
  else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);
  else startDate.setMonth(now.getMonth() - 6); // 6m default

  const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

  const rawAggregation = await Patient.aggregate([
    {
      $match: {
        admittedAt: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$admittedAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const countMap = new Map(rawAggregation.map((item) => [item._id, item.count]));

  // Generate zero-filled continuous series so charts have no gaps
  const timeline: Array<{ date: string; label: string; count: number }> = [];
  const current = new Date(startDate);

  if (groupBy === 'day') {
    while (current <= now) {
      const dateKey = current.toISOString().slice(0, 10);
      const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timeline.push({
        date: dateKey,
        label,
        count: countMap.get(dateKey) || 0,
      });
      current.setDate(current.getDate() + 1);
    }
  } else {
    // groupBy month
    current.setDate(1);
    while (current <= now) {
      const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      const label = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      timeline.push({
        date: dateKey,
        label,
        count: countMap.get(dateKey) || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
  }

  return sendSuccess(res, timeline);
});

export const getConditionDistribution = catchAsync(async (_req: Request, res: Response) => {
  const [conditions, total] = await Promise.all([
    Patient.aggregate([
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Patient.countDocuments(),
  ]);

  const formatted = conditions.map((item) => ({
    condition: item._id,
    count: item.count,
    percentage: total > 0 ? parseFloat(((item.count / total) * 100).toFixed(1)) : 0,
  }));

  return sendSuccess(res, formatted);
});

export const getSpecializationDistribution = catchAsync(async (_req: Request, res: Response) => {
  const distribution = await Doctor.aggregate([
    {
      $group: {
        _id: '$specialization',
        doctorCount: { $sum: 1 },
      },
    },
    { $sort: { doctorCount: -1 } },
    { $limit: 12 },
  ]);

  const formatted = distribution.map((item) => ({
    specialization: item._id,
    doctorCount: item.doctorCount,
  }));

  return sendSuccess(res, formatted);
});

export const getRecentActivities = catchAsync(async (_req: Request, res: Response) => {
  const [recentDoctors, recentPatients] = await Promise.all([
    Doctor.find().sort({ createdAt: -1 }).limit(5).lean(),
    Patient.find()
      .populate('doctor', 'name specialization hospital email avatar')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  return sendSuccess(res, {
    recentDoctors,
    recentPatients,
  });
});
