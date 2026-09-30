import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeSubCounty,
  restoreSubCounty,
  softDeleteSubCounty,
} from "@/server/services/locations.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteSubCounty,
  restore: restoreSubCounty,
  purge: purgeSubCounty,
});

export const POST = routes.restore;
