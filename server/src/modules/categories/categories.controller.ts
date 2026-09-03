import type { Request, Response } from 'express';
import * as categoriesService from './categories.service';
import { getParam } from '../../utils/params';
import type {
  ListCategoriesQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './categories.validation';

export async function listCategories(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as ListCategoriesQuery;
  const result = await categoriesService.listCategories(query);

  res.json({
    success: true,
    data: result.categories,
    pagination: result.pagination,
  });
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  const category = await categoriesService.getCategoryById(getParam(req, 'id'));

  res.json({
    success: true,
    data: category,
  });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as CreateCategoryInput;
  const category = await categoriesService.createCategory(input);

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: category,
  });
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const input = req.validated as unknown as UpdateCategoryInput;
  const category = await categoriesService.updateCategory(getParam(req, 'id'), input);

  res.json({
    success: true,
    message: 'Category updated successfully',
    data: category,
  });
}

export async function deactivateCategory(req: Request, res: Response): Promise<void> {
  const category = await categoriesService.deactivateCategory(getParam(req, 'id'));

  res.json({
    success: true,
    message: 'Category deactivated',
    data: category,
  });
}
