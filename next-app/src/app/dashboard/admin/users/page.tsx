"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power } from "lucide-react";
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
  RoleBadge,
  Select,
  Spinner,
} from "@/components/ui";
import {
  ApiClientError,
  apiPatch,
  apiPost,
  formatApiErrors,
  queryFn,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/types";

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  isActive: boolean;
}

interface Paginated<T> {
  users?: T[];
  invitations?: T[];
  logs?: T[];
  pagination: { page: number; total: number; totalPages: number };
}

const roles = Object.values(Role);

export default function AdminUsersPage() {
  const viewer = useAuth().user;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: Role.STAFF,
    phone: "",
    title: "",
    password: "",
  });

  const { data, isLoading } = useQuery<Paginated<UserRow>>({
    queryKey: ["/admin/users", { limit: 50 }],
    queryFn,
  });
  const users = data?.users ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/users"] });
  };

  const create = useMutation({
    mutationFn: () => apiPost("/admin/users", form),
    onSuccess: () => {
      setOpen(false);
      setForm({
        name: "",
        email: "",
        role: Role.STAFF,
        phone: "",
        title: "",
        password: "",
      });
      setMessage("User created.");
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message || formatApiErrors(err.errors)
          : "Failed to create user.",
      ),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/users/${id}/deactivate`)
        : apiPatch(`/admin/users/${id}`, { isActive: true }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update user.",
      ),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch(`/admin/users/${id}`, { role }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update role.",
      ),
  });

  if (isLoading) return <Spinner className="mx-auto h-8 w-8" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <Button onClick={() => setOpen((v) => !v)} size="sm">
          <Plus className="h-4 w-4" /> Add user
        </Button>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Create user</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <div>
                <Label>Full name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as Role })
                  }
                >
                  {roles
                    .filter(
                      (r) =>
                        r !== Role.SUPER_ADMIN ||
                        viewer?.role === Role.SUPER_ADMIN,
                    )
                    .map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Title (role)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Ward Admin"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                  placeholder="Min 8, incl. upper, lower, number"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create user"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.title ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        onChange={(e) =>
                          setRole.mutate({ id: u._id, role: e.target.value })
                        }
                        className="h-8 w-36"
                      >
                        {roles
                          .filter(
                            (r) =>
                              r !== Role.SUPER_ADMIN ||
                              viewer?.role === Role.SUPER_ADMIN,
                          )
                          .map((r) => (
                            <option key={r} value={r}>
                              {r.replace("_", " ")}
                            </option>
                          ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                      <span
                        className={`ml-2 text-xs ${u.isActive ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleActive.mutate({
                            id: u._id,
                            isActive: u.isActive,
                          })
                        }
                        title={u.isActive ? "Deactivate" : "Activate"}
                      >
                        <Power
                          className={`h-4 w-4 ${u.isActive ? "text-destructive" : "text-emerald-600"}`}
                        />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
