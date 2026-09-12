"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import { ApiClientError, apiPost } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await apiPost<{ message: string }>(
        "/auth/forgot-password",
        {
          email,
        },
      );
      setMessage(
        result.message ?? "If the email exists, a reset link has been sent.",
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Forgot password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <Card>
        <CardContent>
          {message ? (
            <div className="space-y-4">
              <Alert variant="success">{message}</Alert>
              <p className="text-sm text-muted-foreground">
                In development, the reset token is printed to the server
                console.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEmail("")}
              >
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full"
              >
                {loading && (
                  <Spinner className="h-4 w-4 text-primary-foreground" />
                )}
                Send reset link
              </Button>
              <div className="space-y-1 text-center text-sm">
                <Link href="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
