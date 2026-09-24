import bcrypt from "bcryptjs";
import { Role } from "@/types";
import { env } from "./env";
import { User } from "./models/user.model";
import { ActorType, AuditAction } from "./services/audit.service";
import { auditService } from "./services/audit-impl";

const SALT_ROUNDS = 12;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const globalWithBootstrap = globalThis as typeof globalThis & {
  adminBootstrapAttempted?: boolean;
};

/**
 * Creates the initial SUPER_ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD when no
 * system admin exists yet. Safe on serverless: guarded by a per-lambda flag
 * plus a duplicate-key-tolerant insert, so concurrent cold starts cannot mint
 * more than one account. Never logs the password.
 */
export async function bootstrapSystemAdmin(): Promise<void> {
  if (globalWithBootstrap.adminBootstrapAttempted) return;
  globalWithBootstrap.adminBootstrapAttempted = true;

  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;

  if (!email || !password) return;

  if (!EMAIL_PATTERN.test(email)) {
    console.warn(
      "[BOOTSTRAP] ADMIN_EMAIL is not a valid email; skipping system admin creation",
    );
    return;
  }

  if (!STRONG_PASSWORD_PATTERN.test(password)) {
    console.warn(
      "[BOOTSTRAP] ADMIN_PASSWORD must be at least 8 characters and include an uppercase letter, lowercase letter, and number; skipping system admin creation",
    );
    return;
  }

  try {
    const existing = await User.findOne({ role: Role.SUPER_ADMIN }).select(
      "_id",
    );
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name: "System Administrator",
      email,
      role: Role.SUPER_ADMIN,
      passwordHash,
      isActive: true,
    });

    await auditService.log({
      action: AuditAction.USER_CREATED,
      entityType: "User",
      entityId: user._id.toString(),
      actorType: ActorType.SYSTEM,
      metadata: { email, role: Role.SUPER_ADMIN, source: "bootstrap" },
    });

    console.warn(
      `[BOOTSTRAP] Initial System Administrator created for ${email}. Sign in, change the password, then remove ADMIN_PASSWORD (and ADMIN_EMAIL) from your environment variables.`,
    );
  } catch (error) {
    // Duplicate email key (code 11000) from a parallel cold start — another
    // instance already created the admin, so this is a no-op.
    const code = (error as { code?: number })?.code;
    if (code === 11000) return;
    console.error("[BOOTSTRAP] Failed to create system administrator:", error);
  }
}
