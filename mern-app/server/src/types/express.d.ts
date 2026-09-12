import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      /**
       * Validated and sanitized data from the `validate` middleware.
       * Populated for the target part (body/query/params) after validation.
       */
      validated?: Record<string, unknown>;
    }
  }
}

export {};
