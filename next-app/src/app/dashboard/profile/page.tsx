"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { ApiClientError, apiPatch, formatApiErrors, queryFn } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@/types";

interface Profile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  role: string;
}

export default function ProfilePage() {
  const { setUser } = useAuth();
  const { data, isLoading } = useQuery<Profile>({
    queryKey: ["/auth/profile"],
    queryFn,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setTitle(data.title ?? "");
      setDepartment(data.department ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch<Profile>("/auth/profile", { name, phone, title, department }),
    onSuccess: (updated) => {
      setMessage("Profile updated.");
      setError(null);
      if (updated) setUser(updated as unknown as AuthUser);
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message || formatApiErrors(err.errors)
          : "Failed to update profile.",
      ),
  });

  if (isLoading || !data) {
    return <Spinner className="mx-auto h-8 w-8" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" /> Your details
          </CardTitle>
          <CardDescription>
            Your email is your login and cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-4"
          >
            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={data.email} disabled />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254…"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Title / role</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sub-County Officer"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Public Health"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Link
                href="/dashboard/change-password"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <KeyRound className="h-4 w-4" /> Change password
              </Link>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && (
                  <Spinner className="h-4 w-4 text-primary-foreground" />
                )}
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
