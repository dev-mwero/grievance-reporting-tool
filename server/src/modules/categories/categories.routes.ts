import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from 'shared';
import {
  listCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from './categories.validation';
import * as categoriesController from './categories.controller';

const router = Router();

// All routes require authentication and ADMIN role or higher
router.use(authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN));

// GET /api/admin/categories
router.get(
  '/',
  validate(listCategoriesQuerySchema, 'query'),
  categoriesController.listCategories
);

// GET /api/admin/categories/:id
router.get('/:id', categoriesController.getCategory);

// POST /api/admin/categories
router.post('/', validate(createCategorySchema), categoriesController.createCategory);

// PATCH /api/admin/categories/:id
router.patch('/:id', validate(updateCategorySchema), categoriesController.updateCategory);

// POST /api/admin/categories/:id/deactivate
router.post('/:id/deactivate', categoriesController.deactivateCategory);

export default router;
