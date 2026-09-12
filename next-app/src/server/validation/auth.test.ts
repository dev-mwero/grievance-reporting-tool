import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  createInvitationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/server/validation/auth";

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    expect(
      loginSchema.parse({ email: "officer@gov.go.ke", password: "secret" }),
    ).toBeTruthy();
  });

  it("rejects invalid emails and empty passwords", () => {
    expect(() =>
      loginSchema.parse({ email: "not-an-email", password: "x" }),
    ).toThrow();
    expect(() => loginSchema.parse({ email: "a@b.c", password: "" })).toThrow();
  });
});

describe("password field", () => {
  const valid = "StrongPass1";

  it("rejects weak passwords", () => {
    expect(() =>
      resetPasswordSchema.parse({
        token: "t",
        password: "short",
        confirmPassword: "short",
      }),
    ).toThrow();

    expect(() =>
      resetPasswordSchema.parse({
        token: "t",
        password: "alllowercase1",
        confirmPassword: "alllowercase1",
      }),
    ).toThrow();

    expect(() =>
      changePasswordSchema.parse({
        currentPassword: "old",
        newPassword: "ALLCAPS1",
        confirmPassword: "ALLCAPS1",
      }),
    ).toThrow();
  });

  it("rejects mismatched confirmations", () => {
    expect(() =>
      resetPasswordSchema.parse({
        token: "t",
        password: valid,
        confirmPassword: "Different1",
      }),
    ).toThrow();
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: "old",
        newPassword: valid,
        confirmPassword: "Different1",
      }),
    ).toThrow();
  });

  it("accepts a compliant password", () => {
    expect(
      resetPasswordSchema.parse({
        token: "t",
        password: valid,
        confirmPassword: valid,
      }),
    ).toBeTruthy();
  });
});

describe("forgotPasswordSchema", () => {
  it("trims nothing but validates format", () => {
    expect(
      forgotPasswordSchema.parse({ email: "user@example.com" }),
    ).toBeTruthy();
    expect(() => forgotPasswordSchema.parse({ email: "u@e" })).toThrow();
  });
});

describe("createInvitationSchema", () => {
  it("requires a name, a valid email and a known role", () => {
    expect(
      createInvitationSchema.parse({
        name: "Jane Officer",
        email: "jane@example.com",
        role: "ADMIN",
      }),
    ).toBeTruthy();
    expect(() =>
      createInvitationSchema.parse({
        name: "",
        email: "jane@example.com",
        role: "ADMIN",
      }),
    ).toThrow();
    expect(() =>
      createInvitationSchema.parse({
        name: "Jane",
        email: "bad",
        role: "ADMIN",
      }),
    ).toThrow();
    expect(() =>
      createInvitationSchema.parse({
        name: "Jane",
        email: "jane@example.com",
        role: "HACKER",
      }),
    ).toThrow();
  });
});
