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
  Textarea,
} from "@/components/ui";
import { apiErrorMessage, apiPatch, apiPost, queryFn } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface CategoryRow {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  deletedAt?: string;
  deleteReason?: string;
  createdAt: string;
}

const EMPTY_FORM = { name: "", description: "", isActive: true };

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<DeletionScope>("active");

  const [form, setForm] = useState({ name: "", description: "" });
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const { data, isLoading } = useQuery<{ categories: CategoryRow[] }>({
    queryKey: ["/admin/categories", { limit: 100, deletionScope: scope }],
    queryFn,
  });
  const categories = data?.categories ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/categories"] });
  };

  const showErr = (err: unknown) => setError(apiErrorMessage(err));

  const create = useMutation({
    mutationFn: () => apiPost("/admin/categories", form),
    onSuccess: () => {
      setCreateOpen(false);
      setForm({ name: "", description: "" });
      setMessage("Category created.");
      invalidate();
    },
    onError: showErr,
  });

  const update = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/categories/${editing?._id}`, {
        name: editForm.name,
        description: editForm.description,
        isActive: editForm.isActive,
      }),
    onSuccess: () => {
      setEditing(null);
      setMessage("Category updated.");
      invalidate();
    },
    onError: (err) => setEditError(apiErrorMessage(err)),
  });

  const openEdit = (row: CategoryRow) => {
    setEditError(null);
    setEditForm({
      name: row.name,
      description: row.description ?? "",
      isActive: row.isActive,
    });
    setEditing(row);
  };

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/categories/${id}/deactivate`)
        : apiPatch(`/admin/categories/${id}`, { isActive: true }),
    onSuccess: invalidate,
    onError: showErr,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <div className="flex items-center gap-2">
          <DeletionScopeSelect value={scope} onChange={setScope} />
          <Button onClick={() => setCreateOpen((v) => !v)} size="sm">
            <Plus className="h-4 w-4" /> Add category
          </Button>
        </div>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create category</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
              </div>
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
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="hidden px-4 py-3 md:table-cell">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categories.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No categories.
                      </td>
                    </tr>
                  )}
                  {categories.map((c) => (
                    <tr
                      key={c._id}
                      className={
                        c.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                      }
                    >
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.deletedAt ? (
                          <span
                            className="text-xs font-semibold text-destructive"
                            title={
                              c.deleteReason
                                ? `Reason: ${c.deleteReason}`
                                : undefined
                            }
                          >
                            Deleted
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold ${c.isActive ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            {c.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!c.deletedAt && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Edit ${c.name}`}
                                onClick={() => openEdit(c)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={
                                  c.isActive
                                    ? `Deactivate ${c.name}`
                                    : `Activate ${c.name}`
                                }
                                onClick={() =>
                                  toggleActive.mutate({
                                    id: c._id,
                                    isActive: c.isActive,
                                  })
                                }
                              >
                                <Power
                                  className={`h-4 w-4 ${c.isActive ? "text-destructive" : "text-emerald-600"}`}
                                />
                              </Button>
                            </>
                          )}
                          <DeleteRowActions
                            basePath="/admin/categories"
                            id={c._id}
                            label={c.name}
                            deleted={Boolean(c.deletedAt)}
                            onDone={invalidate}
                            onError={setError}
                            onMessage={setMessage}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <EditDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit category"
        description={editing?.name}
        onSubmit={() => update.mutate()}
        saving={update.isPending}
        error={editError}
      >
        <div>
          <Label htmlFor="edit-category-name">Name *</Label>
          <Input
            id="edit-category-name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-category-description">Description</Label>
          <Textarea
            id="edit-category-description"
            rows={4}
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor="edit-category-status">Status</Label>
          <Select
            id="edit-category-status"
            value={editForm.isActive ? "true" : "false"}
            onChange={(e) =>
              setEditForm({ ...editForm, isActive: e.target.value === "true" })
            }
          >
            <option value="true">Active — offered for new complaints</option>
            <option value="false">Inactive — hidden, keeps its history</option>
          </Select>
        </div>
      </EditDialog>
    </div>
  );
}
