import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/AppError.js';
import { User, IUser } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../services/token.service.js';

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Explicitly select passwordHash which is hidden by default
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  setAuthCookie(res, token);

  const safeUser: Record<string, unknown> = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };

  if (user.role === 'doctor') {
    const doc = await Doctor.findOne({
      $or: [{ email: user.email }, { name: user.name }],
    });
    if (doc) {
      safeUser.doctorProfile = doc;
      if (!safeUser.avatar && doc.avatar) {
        safeUser.avatar = doc.avatar;
      }
    }
  } else if (user.role === 'patient') {
    const pat = await Patient.findOne({ name: user.name }).populate('doctor');
    if (pat) {
      safeUser.patientProfile = pat;
      if (!safeUser.avatar && (pat as unknown as { avatar?: string }).avatar) {
        safeUser.avatar = (pat as unknown as { avatar?: string }).avatar;
      }
    }
  }

  return sendSuccess(
    res,
    {
      user: safeUser,
      token,
    },
    200,
    undefined,
    'Signed in successfully'
  );
});

export const logout = catchAsync(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return sendSuccess(res, { loggedOut: true }, 200, undefined, 'Signed out successfully');
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const userId = (req.user as IUser & { _id: unknown })._id;
  const safeUser: Record<string, unknown> = {
    id: userId,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    avatar: req.user.avatar,
    createdAt: req.user.createdAt,
  };

  if (req.user.role === 'doctor') {
    const doc = await Doctor.findOne({
      $or: [{ email: req.user.email }, { name: req.user.name }],
    });
    if (doc) {
      safeUser.doctorProfile = doc;
      if (!safeUser.avatar && doc.avatar) {
        safeUser.avatar = doc.avatar;
      }
    }
  } else if (req.user.role === 'patient') {
    const pat = await Patient.findOne({ name: req.user.name }).populate('doctor');
    if (pat) {
      safeUser.patientProfile = pat;
      if (!safeUser.avatar && (pat as unknown as { avatar?: string }).avatar) {
        safeUser.avatar = (pat as unknown as { avatar?: string }).avatar;
      }
    }
  }

  return sendSuccess(res, { user: safeUser }, 200);
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const userId = (req.user as IUser & { _id: unknown })._id;
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const {
    name,
    phone,
    avatar,
    specialization,
    hospital,
    qualification,
    yearsExperience,
    bio,
    notes,
    currentPassword,
    newPassword,
  } = req.body;

  const previousName = user.name;

  if (name && typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  if (avatar !== undefined && typeof avatar === 'string') {
    user.avatar = avatar.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new BadRequestError('Current password is required to change your password.');
    }
    const isCurrentValid = await user.comparePassword(currentPassword);
    if (!isCurrentValid) {
      throw new UnauthorizedError('Current password is incorrect.');
    }
    if (newPassword.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters long.');
    }
    user.passwordHash = await User.hashPassword(newPassword);
  }

  await user.save();

  // Sync with doctor or patient profile
  let doctorProfile: unknown = undefined;
  let patientProfile: unknown = undefined;

  if (user.role === 'doctor') {
    const doc = await Doctor.findOne({
      $or: [{ email: user.email }, { name: previousName }, { name: user.name }],
    });
    if (doc) {
      if (name && typeof name === 'string' && name.trim()) doc.name = user.name;
      if (phone && typeof phone === 'string') doc.phone = phone.trim();
      if (avatar !== undefined && typeof avatar === 'string') doc.avatar = avatar.trim();
      if (specialization && typeof specialization === 'string') doc.specialization = specialization;
      if (hospital && typeof hospital === 'string') doc.hospital = hospital;
      if (qualification && typeof qualification === 'string') doc.qualification = qualification;
      if (yearsExperience !== undefined && !isNaN(Number(yearsExperience))) {
        doc.yearsExperience = Number(yearsExperience);
      }
      if (bio !== undefined && typeof bio === 'string') doc.bio = bio;
      await doc.save();
      doctorProfile = doc;
    }
  } else if (user.role === 'patient') {
    const pat = await Patient.findOne({
      $or: [{ name: previousName }, { name: user.name }],
    }).populate('doctor');
    if (pat) {
      if (name && typeof name === 'string' && name.trim()) pat.name = user.name;
      if (phone && typeof phone === 'string') pat.phone = phone.trim();
      if (avatar !== undefined && typeof avatar === 'string') {
        (pat as unknown as { avatar?: string }).avatar = avatar.trim();
      }
      if (notes !== undefined && typeof notes === 'string') pat.notes = notes;
      await pat.save();
      patientProfile = pat;
    }
  }

  const safeUser: Record<string, unknown> = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
    doctorProfile,
    patientProfile,
  };

  return sendSuccess(res, { user: safeUser }, 200, undefined, 'Profile updated successfully');
});
