import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeCategory,
  restoreCategory,
  softDeleteCategory,
} from "@/server/services/categories.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteCategory,
  restore: restoreCategory,
  purge: purgeCategory,
});

export const POST = routes.restore;
