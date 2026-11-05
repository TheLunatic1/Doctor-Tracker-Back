import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/response.js';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, string>;
  path?: string;
  value?: unknown;
  errors?: Record<string, { path: string; message: string }>;
}

export const errorHandler: ErrorRequestHandler = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Operational errors created deliberately via AppError
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.details);
  }

  // MongoDB duplicate key error (E11000)
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return sendError(res, `A record with ${field} '${value}' already exists.`, 409, {
      field,
      value,
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    return sendError(res, `Invalid format for parameter '${err.path}': ${err.value}`, 400);
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 'Validation failed', 400, details);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid authentication token. Please sign in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Authentication token has expired. Please sign in again.', 401);
  }

  // Unhandled internal errors
  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || 500;
  const message = isProd ? 'Internal server error occurred' : err.message || 'Internal server error';

  if (!isProd) {
    console.error('Unhandled Error:', err);
  }

  return sendError(res, message, statusCode, isProd ? undefined : { stack: err.stack });
};
