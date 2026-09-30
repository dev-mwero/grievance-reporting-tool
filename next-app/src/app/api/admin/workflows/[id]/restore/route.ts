import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeWorkflow,
  restoreWorkflow,
  softDeleteWorkflow,
} from "@/server/services/workflows.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteWorkflow,
  restore: restoreWorkflow,
  purge: purgeWorkflow,
});

export const POST = routes.restore;
