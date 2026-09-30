import { createDeletionRoutes } from "@/server/deletion-routes";
import {
  purgeInvitation,
  restoreInvitation,
  revokeInvitation,
} from "@/server/services/users.service";

const routes = createDeletionRoutes({
  softDelete: revokeInvitation,
  restore: restoreInvitation,
  purge: purgeInvitation,
});

export const POST = routes.restore;
