import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  if (err instanceof ApiError && err.isOperational) {
    logger.warn({ err: err.message, path: req.path, method: req.method }, 'Operational error');
  } else {
    logger.error({ err, path: req.path, method: req.method }, 'Unexpected error');
  }

  // Handle known error types
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(e.message);
    });
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
    });
    return;
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation error',
    });
    return;
  }

  // Handle MongoDB duplicate key
  if (err instanceof Error && 'code' in err && (err as { code: unknown }).code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Resource already exists',
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
