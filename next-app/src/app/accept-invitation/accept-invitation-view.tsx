"use client";

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
  Spinner,
} from "@/components/ui";
import { ApiClientError, apiPost } from "@/lib/api";

export function AcceptInvitationView({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirm;
  const canSubmit =
    token.length > 0 &&
    name.trim().length >= 3 &&
    password.length >= 8 &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/accept-invitation", {
        token,
        name,
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        password,
        confirmPassword: confirm,
      });
      router.replace("/login?invited=1");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Accept invitation
          </h1>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <Alert variant="error">
              This invitation link is missing a token. Please use the link from
              your invitation email.
            </Alert>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Go to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <UserPlus className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Accept invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve been invited to join the grievance handling team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set up your account</CardTitle>
          <CardDescription>
            This invitation is valid for 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Omollo"
                autoComplete="name"
                required
              />
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
                Title <span className="text-muted-foreground">(optional)</span>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
              />
            </div>

            {!passwordsMatch && confirm.length > 0 && (
              <p className="text-sm text-destructive">
                Passwords do not match.
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full"
            >
              {loading && (
                <Spinner className="h-4 w-4 text-primary-foreground" />
              )}
              Create account &amp; continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
