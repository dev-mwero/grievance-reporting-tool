"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  Select,
  Spinner,
} from "@/components/ui";
import {
  ApiClientError,
  apiDelete,
  apiPost,
  formatApiErrors,
  queryFn,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import { Role } from "@/types";

interface InvitationRow {
  _id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const roles = Object.values(Role);

const statusColor: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export default function AdminInvitationsPage() {
  const viewer = useAuth().user;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: Role.STAFF,
  });

  const { data, isLoading } = useQuery<{
    invitations: InvitationRow[];
  }>({
    queryKey: [
      "/admin/users/invitations",
      { status: status || undefined, limit: 50 },
    ],
    queryFn,
  });
  const invitations = data?.invitations ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/users/invitations"] });
  };

  const create = useMutation({
    mutationFn: () => apiPost("/admin/users/invitations", form),
    onSuccess: () => {
      setOpen(false);
      setForm({ email: "", name: "", role: Role.STAFF });
      setMessage("Invitation sent.");
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message || formatApiErrors(err.errors)
          : "Failed to invite.",
      ),
  });

  const resend = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/admin/users/invitations/${id}/resend`),
    onSuccess: () => setMessage("Invitation resent."),
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to resend.",
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/users/invitations/${id}`),
    onSuccess: invalidate,
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete.",
      ),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
        <Button onClick={() => setOpen((v) => !v)} size="sm">
          <Plus className="h-4 w-4" /> Invite user
        </Button>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Send invitation</CardTitle>
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
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Sending…" : "Send invitation"}
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

      <div className="flex items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
        </Select>
      </div>

      {isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invitations.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No invitations.
                      </td>
                    </tr>
                  )}
                  {invitations.map((inv) => (
                    <tr key={inv._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {inv.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3">
                        {inv.role.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor[inv.status] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(inv.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resend.mutate(inv._id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => remove.mutate(inv._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
