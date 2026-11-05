import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: PaginationMeta,
  message?: string
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
    ...(message ? { message } : {}),
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  details?: unknown
) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(details ? { details } : {}),
    },
  });
};
