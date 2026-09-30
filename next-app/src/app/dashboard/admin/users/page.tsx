"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power } from "lucide-react";
import { useState } from "react";
import {
  DeleteRowActions,
  type DeletionScope,
  DeletionScopeSelect,
} from "@/components/deletion-controls";
import { EditDialog } from "@/components/edit-dialog";
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
import { apiErrorMessage, apiPatch, apiPost, queryFn } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/types";

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  department?: string;
  phone?: string;
  isActive: boolean;
  deletedAt?: string;
}

interface Paginated<T> {
  users?: T[];
  invitations?: T[];
  logs?: T[];
  pagination: { page: number; total: number; totalPages: number };
}

const roles = Object.values(Role);

const EMPTY_EDIT = {
  name: "",
  phone: "",
  title: "",
  department: "",
  role: Role.STAFF,
  isActive: true,
};

export default function AdminUsersPage() {
  const viewer = useAuth().user;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<DeletionScope>("active");

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: Role.STAFF,
    phone: "",
    title: "",
    password: "",
  });

  const { data, isLoading } = useQuery<Paginated<UserRow>>({
    queryKey: ["/admin/users", { limit: 50, deletionScope: scope }],
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
    onError: (err) => setError(apiErrorMessage(err, "Failed to create user.")),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/users/${id}/deactivate`)
        : apiPatch(`/admin/users/${id}`, { isActive: true }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err, "Failed to update user.")),
  });

  const update = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/users/${editing?._id}`, {
        name: editForm.name,
        phone: editForm.phone,
        title: editForm.title,
        department: editForm.department,
        role: editForm.role,
        isActive: editForm.isActive,
      }),
    onSuccess: () => {
      setEditing(null);
      setMessage("User updated.");
      invalidate();
    },
    onError: (err) =>
      setEditError(apiErrorMessage(err, "Failed to save user.")),
  });

  const openEdit = (row: UserRow) => {
    setEditError(null);
    setEditForm({
      name: row.name,
      phone: row.phone ?? "",
      title: row.title ?? "",
      department: row.department ?? "",
      role: row.role as Role,
      isActive: row.isActive,
    });
    setEditing(row);
  };

  if (isLoading) return <Spinner className="mx-auto h-8 w-8" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <div className="flex items-center gap-2">
          <DeletionScopeSelect value={scope} onChange={setScope} />
          <Button onClick={() => setOpen((v) => !v)} size="sm">
            <Plus className="h-4 w-4" /> Add user
          </Button>
        </div>
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
                {users.map((u) => {
                  const isSelf = u._id === viewer?.id;
                  return (
                    <tr
                      key={u._id}
                      className={
                        u.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                      }
                    >
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.title ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        {u.deletedAt ? (
                          <span className="text-xs font-semibold text-destructive">
                            Deleted
                          </span>
                        ) : (
                          <span
                            className={`text-xs ${u.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!u.deletedAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(u)}
                                title={`Edit ${u.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
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
                            </>
                          )}
                          <DeleteRowActions
                            basePath="/admin/users"
                            id={u._id}
                            label={isSelf ? "your account" : u.name}
                            deleted={Boolean(u.deletedAt)}
                            disabled={isSelf && !u.deletedAt}
                            disabledReason="You cannot delete your own account"
                            onDone={invalidate}
                            onError={setError}
                            onMessage={setMessage}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EditDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit user"
        description={editing?.name}
        onSubmit={() => update.mutate()}
        saving={update.isPending}
        error={editError}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-user-name">Full name *</Label>
            <Input
              id="edit-user-name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-user-email">Email</Label>
            <Input id="edit-user-email" value={editing?.email ?? ""} disabled />
            <p className="mt-1 text-xs text-muted-foreground">
              Changing an email address requires sending a new invitation.
            </p>
          </div>
          <div>
            <Label htmlFor="edit-user-phone">Phone</Label>
            <Input
              id="edit-user-phone"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="edit-user-title">Title</Label>
            <Input
              id="edit-user-title"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              placeholder="e.g. Ward Admin"
            />
          </div>
          <div>
            <Label htmlFor="edit-user-department">Department</Label>
            <Input
              id="edit-user-department"
              value={editForm.department}
              onChange={(e) =>
                setEditForm({ ...editForm, department: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="edit-user-role">Role</Label>
            <Select
              id="edit-user-role"
              value={editForm.role}
              onChange={(e) =>
                setEditForm({ ...editForm, role: e.target.value as Role })
              }
            >
              {roles
                .filter(
                  (r) =>
                    r !== Role.SUPER_ADMIN || viewer?.role === Role.SUPER_ADMIN,
                )
                .map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              A role change takes effect on the user&apos;s next request.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-user-status">Status</Label>
            <Select
              id="edit-user-status"
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  isActive: e.target.value === "true",
                })
              }
            >
              <option value="true">Active — can sign in and be assigned</option>
              <option value="false">
                Inactive — sign-in blocked, history preserved
              </option>
            </Select>
          </div>
        </div>
      </EditDialog>
    </div>
  );
}
