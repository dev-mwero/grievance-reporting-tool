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
  Select,
  Spinner,
} from "@/components/ui";
import { apiErrorMessage, apiPatch, apiPost, queryFn } from "@/lib/api";

interface SubCountyRow {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt?: string;
}

interface WardRow {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt?: string;
  subCountyId: { _id: string; name: string } | null;
}

type Tab = "sub-counties" | "wards";

export default function AdminLocationsPage() {
  const [tab, setTab] = useState<Tab>("sub-counties");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["sub-counties", "wards"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-card shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>
      {tab === "sub-counties" ? (
        <SubCountiesPanel onError={setError} onMessage={setMessage} />
      ) : (
        <WardsPanel onError={setError} onMessage={setMessage} />
      )}
    </div>
  );
}

// ─── Sub-Counties ───────────────────────────────────────────────────────────

function SubCountiesPanel({
  onError,
  onMessage,
}: {
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubCountyRow | null>(null);
  const [scope, setScope] = useState<DeletionScope>("active");
  const [form, setForm] = useState({ name: "", code: "" });
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    isActive: true,
  });

  const { data, isLoading } = useQuery<{ subCounties: SubCountyRow[] }>({
    queryKey: ["/admin/sub-counties", { limit: 200, deletionScope: scope }],
    queryFn,
  });
  const rows = data?.subCounties ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/admin/sub-counties"] });

  const showErr = (err: unknown) => onError(apiErrorMessage(err));

  const create = useMutation({
    mutationFn: () => apiPost("/admin/sub-counties", form),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", code: "" });
      invalidate();
    },
    onError: showErr,
  });

  const update = useMutation({
    mutationFn: () => apiPatch(`/admin/sub-counties/${editing?._id}`, editForm),
    onSuccess: () => {
      setEditing(null);
      onMessage("Sub-county updated.");
      invalidate();
    },
    onError: showErr,
  });

  const openEdit = (row: SubCountyRow) => {
    setEditForm({ name: row.name, code: row.code, isActive: row.isActive });
    setEditing(row);
  };

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/sub-counties/${id}/deactivate`)
        : apiPatch(`/admin/sub-counties/${id}`, { isActive: true }),
    onSuccess: invalidate,
    onError: showErr,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DeletionScopeSelect value={scope} onChange={setScope} />
        <Button onClick={() => setOpen((v) => !v)} size="sm">
          <Plus className="h-4 w-4" /> Add sub-county
        </Button>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Create sub-county</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Kisumu Central"
                />
              </div>
              <div className="w-full sm:w-40">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  placeholder="e.g. KC"
                />
              </div>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((s) => (
                    <tr
                      key={s._id}
                      className={
                        s.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                      }
                    >
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.code}
                      </td>
                      <td className="px-4 py-3">
                        {s.deletedAt ? (
                          <span className="text-xs font-semibold text-destructive">
                            Deleted
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${s.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            {s.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!s.deletedAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Edit ${s.name}`}
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={
                                  s.isActive
                                    ? `Deactivate ${s.name}`
                                    : `Activate ${s.name}`
                                }
                                onClick={() =>
                                  toggle.mutate({
                                    id: s._id,
                                    isActive: s.isActive,
                                  })
                                }
                              >
                                <Power
                                  className={`h-4 w-4 ${s.isActive ? "text-destructive" : "text-emerald-600"}`}
                                />
                              </Button>
                            </>
                          )}
                          <DeleteRowActions
                            basePath="/admin/sub-counties"
                            id={s._id}
                            label={s.name}
                            deleted={Boolean(s.deletedAt)}
                            onDone={invalidate}
                            onError={showErr}
                            onMessage={onMessage}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No sub-counties.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <EditDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit sub-county"
        description={editing?.name}
        onSubmit={() => update.mutate()}
        saving={update.isPending}
      >
        <div>
          <Label htmlFor="edit-subcounty-name">Name *</Label>
          <Input
            id="edit-subcounty-name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-subcounty-code">Code *</Label>
          <Input
            id="edit-subcounty-code"
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Codes must be unique across the county.
          </p>
        </div>
        <div>
          <Label htmlFor="edit-subcounty-status">Status</Label>
          <Select
            id="edit-subcounty-status"
            value={editForm.isActive ? "true" : "false"}
            onChange={(e) =>
              setEditForm({ ...editForm, isActive: e.target.value === "true" })
            }
          >
            <option value="true">Active — selectable on new complaints</option>
            <option value="false">Inactive — hidden, keeps its wards</option>
          </Select>
        </div>
      </EditDialog>
    </div>
  );
}

// ─── Wards ──────────────────────────────────────────────────────────────────

function WardsPanel({
  onError,
  onMessage,
}: {
  onError: (msg: string | null) => void;
  onMessage: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subCountyId, setSubCountyId] = useState("");
  const [editing, setEditing] = useState<WardRow | null>(null);
  const [scope, setScope] = useState<DeletionScope>("active");
  const [form, setForm] = useState({ name: "", code: "", subCountyId: "" });
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    subCountyId: "",
    isActive: true,
  });

  // The parent picker only ever lists live sub-counties: a ward cannot be moved
  // into one that is deleted or deactivated.
  const subCounties = useQuery<{ subCounties: SubCountyRow[] }>({
    queryKey: ["/admin/sub-counties", { limit: 200, isActive: "true" }],
    queryFn,
  });

  const wards = useQuery<{ wards: WardRow[] }>({
    queryKey: [
      "/admin/wards",
      {
        limit: 500,
        subCountyId: subCountyId || undefined,
        deletionScope: scope,
      },
    ],
    queryFn,
  });
  const rows = wards.data?.wards ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/wards"] });
  };

  const showErr = (err: unknown) => onError(apiErrorMessage(err));

  const create = useMutation({
    mutationFn: () => apiPost("/admin/wards", form),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", code: "", subCountyId: "" });
      invalidate();
    },
    onError: showErr,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/wards/${id}/deactivate`)
        : apiPatch(`/admin/wards/${id}`, { isActive: true }),
    onSuccess: invalidate,
    onError: showErr,
  });

  const update = useMutation({
    mutationFn: () => apiPatch(`/admin/wards/${editing?._id}`, editForm),
    onSuccess: () => {
      setEditing(null);
      onMessage("Ward updated.");
      invalidate();
    },
    onError: showErr,
  });

  const openEdit = (row: WardRow) => {
    setEditForm({
      name: row.name,
      code: row.code,
      subCountyId: row.subCountyId?._id ?? "",
      isActive: row.isActive,
    });
    setEditing(row);
  };

  const options = subCounties.data?.subCounties ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Select
          value={subCountyId}
          onChange={(e) => setSubCountyId(e.target.value)}
          className="w-full sm:w-64"
        >
          <option value="">All sub-counties</option>
          {options.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <DeletionScopeSelect value={scope} onChange={setScope} />
          <Button onClick={() => setOpen((v) => !v)} size="sm">
            <Plus className="h-4 w-4" /> Add ward
          </Button>
        </div>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Create ward</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Kaloleni"
                />
              </div>
              <div className="w-full sm:w-40">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  placeholder="e.g. KL"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label>Sub-county</Label>
                <Select
                  value={form.subCountyId}
                  onChange={(e) =>
                    setForm({ ...form, subCountyId: e.target.value })
                  }
                  required
                >
                  <option value="">Select…</option>
                  {options.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {wards.isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Sub-county</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((w) => (
                    <tr
                      key={w._id}
                      className={
                        w.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                      }
                    >
                      <td className="px-4 py-3 font-medium">{w.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {w.code}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.subCountyId?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {w.deletedAt ? (
                          <span className="text-xs font-semibold text-destructive">
                            Deleted
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${w.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            {w.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!w.deletedAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Edit ${w.name}`}
                                onClick={() => openEdit(w)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={
                                  w.isActive
                                    ? `Deactivate ${w.name}`
                                    : `Activate ${w.name}`
                                }
                                onClick={() =>
                                  toggle.mutate({
                                    id: w._id,
                                    isActive: w.isActive,
                                  })
                                }
                              >
                                <Power
                                  className={`h-4 w-4 ${w.isActive ? "text-destructive" : "text-emerald-600"}`}
                                />
                              </Button>
                            </>
                          )}
                          <DeleteRowActions
                            basePath="/admin/wards"
                            id={w._id}
                            label={w.name}
                            deleted={Boolean(w.deletedAt)}
                            onDone={invalidate}
                            onError={showErr}
                            onMessage={onMessage}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No wards.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <EditDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit ward"
        description={editing ? `${editing.name} (${editing.code})` : undefined}
        onSubmit={() => update.mutate()}
        saving={update.isPending}
      >
        <div>
          <Label htmlFor="edit-ward-name">Name *</Label>
          <Input
            id="edit-ward-name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-ward-code">Code *</Label>
          <Input
            id="edit-ward-code"
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-ward-subcounty">Sub-county *</Label>
          <Select
            id="edit-ward-subcounty"
            value={editForm.subCountyId}
            onChange={(e) =>
              setEditForm({ ...editForm, subCountyId: e.target.value })
            }
            required
          >
            <option value="">Select…</option>
            {options.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Moving a ward re-files the complaints already filed under it.
          </p>
        </div>
        <div>
          <Label htmlFor="edit-ward-status">Status</Label>
          <Select
            id="edit-ward-status"
            value={editForm.isActive ? "true" : "false"}
            onChange={(e) =>
              setEditForm({ ...editForm, isActive: e.target.value === "true" })
            }
          >
            <option value="true">Active — selectable on new complaints</option>
            <option value="false">
              Inactive — hidden from the public form
            </option>
          </Select>
        </div>
      </EditDialog>
    </div>
  );
}
