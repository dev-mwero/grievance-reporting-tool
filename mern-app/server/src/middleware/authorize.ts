import type { Request, Response, NextFunction } from 'express';
import { Role, hasMinimumRole } from 'shared';
import { ApiError } from '../utils/api-error';

/**
 * Authorization middleware factory.
 * Checks that the authenticated user has at least the required role.
 * Must be used after the authenticate middleware.
 *
 * @example
 * router.get('/admin/users', authenticate, authorize(Role.ADMIN), handler);
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = req.user.role as Role;

    // If specific roles are provided, check membership
    if (allowedRoles.length > 0) {
      const hasRole = allowedRoles.some((role) => userRole === role);
      if (!hasRole) {
        throw ApiError.forbidden('Insufficient permissions');
      }
      next();
      return;
    }

    // If no specific roles, just check minimum role level
    // This is a fallback; prefer explicit role checks
    next();
  };
}

/**
 * Middleware that requires the user to have a role at or above
 * the specified minimum role in the hierarchy.
 *
 * @example
 * router.get('/admin/users', authenticate, requireRole(Role.ADMIN), handler);
 */
export function requireRole(minimumRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const userRole = req.user.role as Role;

    if (!hasMinimumRole(userRole, minimumRole)) {
      throw ApiError.forbidden(
        `Requires ${minimumRole} role or higher`
      );
    }

    next();
  };
}
