import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema } from 'zod';

/**
 * Generic Zod validation middleware.
 * Validates req.body against the provided schema.
 *
 * @example
 * router.post('/login', validate(loginSchema), controller.login);
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });

      _res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
      return;
    }

    // Replace req.body with validated/sanitized data
    req.body = result.data;
    next();
  };
}
