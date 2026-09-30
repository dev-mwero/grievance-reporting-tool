import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeUser,
  restoreUser,
  softDeleteUser,
} from "@/server/services/users.service";

const routes = createDeletionRoutes({
  softDelete: softDeleteUser,
  restore: restoreUser,
  purge: purgeUser,
});

export const DELETE = routes.purge;
