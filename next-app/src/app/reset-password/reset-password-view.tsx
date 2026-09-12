"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import { ApiClientError, apiPost } from "@/lib/api";

export function ResetPasswordView({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirm;
  const canSubmit = password.length >= 8 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
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
      <Centered title="Reset password">
        <Alert variant="error">
          The reset link is missing a token. Please use the link from your
          email.
        </Alert>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full">
            Request a new link
          </Button>
        </Link>
      </Centered>
    );
  }

  return (
    <Centered title="Reset password">
      {done ? (
        <Alert variant="success">
          Your password has been reset. Redirecting you to sign in…
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div>
            <Label htmlFor="password">New password</Label>
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
            <p className="text-sm text-destructive">Passwords do not match.</p>
          )}
          <Button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full"
          >
            {loading && <Spinner className="h-4 w-4 text-primary-foreground" />}
            Reset password
          </Button>
        </form>
      )}
    </Centered>
  );
}

function Centered({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
