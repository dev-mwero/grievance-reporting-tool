import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeWard,
  restoreWard,
  softDeleteWard,
} from "@/server/services/locations.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteWard,
  restore: restoreWard,
  purge: purgeWard,
});

export const DELETE = routes.purge;
