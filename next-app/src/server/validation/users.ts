import { z } from "zod";
import { Role } from "@/types";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254),
  phone: z.string().max(20).optional(),
  role: z.nativeEnum(Role).default(Role.STAFF),
  title: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  phone: z.string().max(20).optional(),
  role: z.nativeEnum(Role).optional(),
  title: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createInvitationSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(254),
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(20).optional(),
  title: z.string().max(200).optional(),
  role: z.nativeEnum(Role).default(Role.STAFF),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const listInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "accepted", "expired"]).optional(),
});

export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;

export const userParamsSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

export type UserParams = z.infer<typeof userParamsSchema>;
