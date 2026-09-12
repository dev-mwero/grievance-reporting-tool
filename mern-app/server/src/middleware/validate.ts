import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Generic Zod validation middleware.
 * Validates the specified request part against the provided schema.
 *
 * @example
 * router.post('/login', validate(loginSchema), controller.login);
 * router.get('/users', validate(listUsersQuerySchema, 'query'), controller.listUsers);
 */
export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });

      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
      return;
    }

    // Store the validated/sanitized data on a custom property.
    // NOTE: We cannot assign to req.query/req.params directly because in
    // Express 5 they are getter-only properties (lazy query parsing).
    req.validated = result.data as Record<string, unknown>;

    next();
  };
}
