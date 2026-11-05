import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { Response, CookieOptions } from 'express';

const JWT_SECRET: Secret =
  process.env.JWT_SECRET || 'super_secret_jwt_key_doctor_tracker_change_in_production_32chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const COOKIE_NAME = 'dt_auth_token';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const signToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: (JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
};

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
};

export const clearAuthCookie = (res: Response): void => {
  const options = getCookieOptions();
  res.clearCookie(COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: '/',
  });
};
