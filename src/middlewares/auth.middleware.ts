import { Request, Response, NextFunction } from 'express';
import { verifyToken, COOKIE_NAME } from '../services/token.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';
import { User, IUser } from '../models/User.js';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // 1. Check cookies (preferred for browser/Next.js proxy)
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }
  // 2. Check Authorization Bearer header (fallback for external clients/API tests)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new UnauthorizedError('Authentication token missing. Please sign in.'));
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId).lean();

    if (!user) {
      return next(new UnauthorizedError('The user associated with this session no longer exists.'));
    }

    req.tokenPayload = payload;
    req.user = user as unknown as IUser;
    next();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Your session has expired. Please sign in again.'));
    }
    return next(new UnauthorizedError('Invalid authentication token.'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }
    next();
  };
};
