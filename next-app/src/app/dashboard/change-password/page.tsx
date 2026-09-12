"use client";

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

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword === confirm;
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await apiPost("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to change password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Change password</h1>

      <Card>
        <CardHeader>
          <CardTitle>Update your password</CardTitle>
          <CardDescription>
            Use at least 8 characters with a mix of types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
