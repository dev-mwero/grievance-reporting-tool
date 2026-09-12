import type { Request } from 'express';
import { ApiError } from './api-error';

/**
 * Safely extract a string param from req.params.
 * Express 5 types params as string | string[].
 */
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`Invalid ${name} parameter`);
  }
  return value;
}
