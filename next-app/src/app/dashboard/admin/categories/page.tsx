"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power } from "lucide-react";
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
  Textarea,
} from "@/components/ui";
import {
  ApiClientError,
  apiPatch,
  apiPost,
  formatApiErrors,
  queryFn,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface CategoryRow {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery<{ categories: CategoryRow[] }>({
    queryKey: ["/admin/categories", { limit: 100, isActive: "true" }],
    queryFn,
  });
  const categories = data?.categories ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/categories"] });
  };

  const showErr = (err: unknown) =>
    setError(
      err instanceof ApiClientError
        ? err.message || formatApiErrors(err.errors)
        : "Operation failed.",
    );

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
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { name: string; description: string };
    }) => apiPatch(`/admin/categories/${id}`, body),
    onSuccess: () => {
      setEditId(null);
      setForm({ name: "", description: "" });
      setMessage("Category updated.");
      invalidate();
    },
    onError: showErr,
  });

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <Button onClick={() => setCreateOpen((v) => !v)} size="sm">
          <Plus className="h-4 w-4" /> Add category
        </Button>
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
                    <th className="px-4 py-3 hidden md:table-cell">Created</th>
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
                    <tr key={c._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {editId === c._id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={form.name}
                              onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                              }
                              className="w-44"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                update.mutate({ id: c._id, body: form })
                              }
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold ${c.isActive ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditId(c._id);
                            setForm({
                              name: c.name,
                              description: c.description ?? "",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
