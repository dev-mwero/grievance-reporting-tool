"use client";

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RoleBadge,
  Spinner,
} from "@/components/ui";
import { ApiClientError, apiPost, queryFn } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser, Role } from "@/types";

interface InvitationPreview {
  name: string;
  email: string;
  role: Role;
  title: string;
  expiresAt: string;
}

/** Mirrors `passwordField` in `server/validation/auth.ts` so the submit gate matches. */
function passwordProblem(password: string): string | null {
  if (password.length === 0) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 128) return "Password cannot exceed 128 characters";
  if (!/(?=.*[a-z])/.test(password) || !/(?=.*[A-Z])/.test(password)) {
    return "Password needs an uppercase and a lowercase letter";
  }
  if (!/(?=.*\d)/.test(password)) return "Password needs a number";
  return null;
}

export function AcceptInvitationView({ token }: { token: string }) {
  const preview = useQuery<InvitationPreview>({
    queryKey: ["/auth/accept-invitation", { token }],
    queryFn,
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });

  if (!token) {
    return (
      <Shell>
        <Alert variant="error">
          This invitation link is missing a token. Please use the link from your
          invitation email.
        </Alert>
        <SignInLink />
      </Shell>
    );
  }

  if (preview.isError) {
    return (
      <Shell>
        <Alert variant="error">
          {preview.error instanceof ApiClientError
            ? preview.error.message
            : "We could not verify this invitation link."}
        </Alert>
        <SignInLink />
      </Shell>
    );
  }

  if (preview.isLoading || !preview.data) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Verifying your invitation…
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <AcceptInvitationForm invite={preview.data} token={token} />
    </Shell>
  );
}

function AcceptInvitationForm({
  invite,
  token,
}: {
  invite: InvitationPreview;
  token: string;
}) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [name, setName] = useState(invite.name);
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState(invite.title);
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordError = passwordProblem(password);
  const passwordsMatch = password === confirm;
  const canSubmit =
    name.trim().length >= 3 &&
    passwordError === null &&
    confirm.length > 0 &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await apiPost<{ user: AuthUser }>(
        "/auth/accept-invitation",
        {
          token,
          name: name.trim(),
          phone: phone.trim() || undefined,
          title: title.trim() || undefined,
          department: department.trim() || undefined,
          password,
          confirmPassword: confirm,
        },
      );
      // The route already set the session cookies; adopt the user so the
      // dashboard renders authenticated without a second sign-in.
      setUser(user);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete your profile</CardTitle>
        <CardDescription>
          This invitation expires on{" "}
          {new Date(invite.expiresAt).toLocaleDateString(undefined, {
            dateStyle: "long",
          })}
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={invite.email} readOnly />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Set by the administrator who invited you.
            </p>
          </div>

          <div>
            <Label>Role</Label>
            <div className="flex h-10 items-center">
              <RoleBadge role={invite.role} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Contact an administrator to request a different role.
            </p>
          </div>

          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pre-filled by the administrator — correct it if it is wrong.
            </p>
          </div>

          <div>
            <Label htmlFor="phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7xx xxx xxx"
            />
          </div>

          <div>
            <Label htmlFor="title">
              Job title{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="title"
              autoComplete="organization-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Human Resources Officer"
            />
          </div>

          <div>
            <Label htmlFor="department">
              Department{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="department"
              autoComplete="organization"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Human Resources"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={password.length > 0 && passwordError !== null}
              required
            />
            {password.length > 0 && passwordError ? (
              <p className="mt-1.5 text-sm text-destructive">{passwordError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                At least 8 characters, with an uppercase letter, a lowercase
                letter and a number.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={confirm.length > 0 && !passwordsMatch}
              required
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-sm text-destructive">
                Passwords do not match.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full"
          >
            {loading && <Spinner className="h-4 w-4 text-primary-foreground" />}
            Create account &amp; continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SignInLink() {
  return (
    <Link href="/login" className="block">
      <Button variant="outline" className="w-full">
        Go to sign in
      </Button>
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <UserPlus className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Accept invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve been invited to join the grievance handling team.
        </p>
      </div>
      {children}
    </div>
  );
}
