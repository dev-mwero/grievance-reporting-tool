import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeGrievance,
  restoreGrievance,
  softDeleteGrievance,
} from "@/server/services/grievances.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteGrievance,
  restore: restoreGrievance,
  purge: purgeGrievance,
});

export const DELETE = routes.purge;
