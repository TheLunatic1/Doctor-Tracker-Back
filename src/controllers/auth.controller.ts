import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/AppError.js';
import { User, IUser } from '../models/User.js';
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

  const safeUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

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

  const safeUser = {
    id: (req.user as IUser & { _id: unknown })._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt,
  };

  return sendSuccess(res, { user: safeUser }, 200);
});
