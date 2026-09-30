"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch,
  Pencil,
  Plus,
  Power,
  Workflow as WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
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

interface WorkflowRow {
  _id: string;
  name: string;
  description?: string;
  isGlobal: boolean;
  isActive: boolean;
  categoryId?: { _id: string; name: string } | null;
  stages: { key: string; label: string; isFinal: boolean; order: number }[];
  startStageKey: string;
  deletedAt?: string;
  deleteReason?: string;
}

interface CategoryOption {
  _id: string;
  name: string;
}

export default function AdminWorkflowsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scope, setScope] = useState<DeletionScope>("active");

  const [form, setForm] = useState({
    name: "",
    description: "",
    isGlobal: true,
    categoryId: "",
  });

  const { data, isLoading } = useQuery<{ workflows: WorkflowRow[] }>({
    queryKey: ["/admin/workflows", { limit: 100, deletionScope: scope }],
    queryFn,
  });
  const workflows = data?.workflows ?? [];

  const { data: categoryData } = useQuery<{ categories: CategoryOption[] }>({
    queryKey: ["/admin/categories", { limit: 100, isActive: "true" }],
    queryFn,
  });
  const categories = categoryData?.categories ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/admin/workflows"] });
  };
  const showErr = (err: unknown) => setError(apiErrorMessage(err));

  const create = useMutation({
    mutationFn: () =>
      apiPost("/admin/workflows", {
        name: form.name,
        description: form.description || undefined,
        // Exactly one scope: the global workflow, or a category's own.
        isGlobal: form.isGlobal,
        categoryId: form.isGlobal ? null : form.categoryId,
        stages: [
          { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        ],
        transitions: [],
        startStageKey: "SUBMITTED",
        isActive: false,
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setForm({ name: "", description: "", isGlobal: true, categoryId: "" });
      setMessage(
        "Workflow created as a draft. Open it to design the stages and moves.",
      );
      invalidate();
    },
    onError: showErr,
  });

  const update = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/workflows/${editing?._id}`, {
        name: form.name,
        description: form.description || undefined,
        isGlobal: form.isGlobal,
        categoryId: form.isGlobal ? null : form.categoryId,
      }),
    onSuccess: () => {
      setEditing(null);
      setMessage("Workflow updated.");
      invalidate();
    },
    onError: (err) => setEditError(apiErrorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiPost(`/admin/workflows/${id}/deactivate`)
        : apiPost(`/admin/workflows/${id}/activate`),
    onSuccess: () => {
      setMessage("Workflow activation updated.");
      invalidate();
    },
    onError: showErr,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaint cycle</h1>
          <p className="text-sm text-muted-foreground">
            Define the stages a complaint passes through and who may move it
            between them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeletionScopeSelect value={scope} onChange={setScope} />
          <Button size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            New workflow
          </Button>
        </div>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div>
                <Label htmlFor="wf-name">Name *</Label>
                <Input
                  id="wf-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Roads and drainage cycle"
                  required
                />
              </div>
              <div>
                <Label htmlFor="wf-description">Description</Label>
                <Textarea
                  id="wf-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <ScopeFields
                form={form}
                categories={categories}
                onChange={(scope) => setForm((prev) => ({ ...prev, ...scope }))}
                idPrefix="create"
              />
              <Alert variant="info">
                Created as an inactive draft with a single Submitted stage. Open
                the builder to add stages and the moves between them, then
                activate it.
              </Alert>
              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
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
                <thead className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="hidden px-4 py-3 md:table-cell">Stages</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workflows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No workflows yet.
                      </td>
                    </tr>
                  ) : (
                    workflows.map((w) => (
                      <tr
                        key={w._id}
                        className={
                          w.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                        }
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/admin/workflows/${w._id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {w.name}
                          </Link>
                          {w.description && (
                            <span className="block max-w-xs truncate text-xs text-muted-foreground">
                              {w.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {w.isGlobal ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <WorkflowIcon className="h-3.5 w-3.5" />
                              Global
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <GitBranch className="h-3.5 w-3.5" />
                              {w.categoryId?.name ?? "Unscoped"}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {w.stages.length}
                        </td>
                        <td className="px-4 py-3">
                          {w.deletedAt ? (
                            <span
                              className="text-xs font-semibold text-destructive"
                              title={w.deleteReason}
                            >
                              Deleted
                            </span>
                          ) : w.isActive ? (
                            <span className="text-xs font-semibold text-emerald-600">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/dashboard/admin/workflows/${w._id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Open the builder"
                              >
                                <GitBranch className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit name, description and scope"
                              onClick={() => {
                                setEditError(null);
                                setForm({
                                  name: w.name,
                                  description: w.description ?? "",
                                  isGlobal: w.isGlobal,
                                  categoryId: w.categoryId?._id ?? "",
                                });
                                setEditing(w);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!w.deletedAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={
                                  w.isActive
                                    ? "Deactivate — complaints fall back to another workflow"
                                    : "Activate this workflow"
                                }
                                disabled={toggleActive.isPending}
                                onClick={() =>
                                  toggleActive.mutate({
                                    id: w._id,
                                    isActive: w.isActive,
                                  })
                                }
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <DeleteRowActions
                              basePath="/admin/workflows"
                              id={w._id}
                              label={w.name}
                              deleted={Boolean(w.deletedAt)}
                              onDone={invalidate}
                              onError={setError}
                              onMessage={setMessage}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
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
        title="Edit workflow"
        description={editing?.name}
        onSubmit={() => update.mutate()}
        saving={update.isPending}
        error={editError}
      >
        <div>
          <Label htmlFor="edit-wf-name">Name *</Label>
          <Input
            id="edit-wf-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-wf-description">Description</Label>
          <Textarea
            id="edit-wf-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <ScopeFields
          form={form}
          categories={categories}
          onChange={(scope) => setForm((prev) => ({ ...prev, ...scope }))}
          idPrefix="edit"
        />
      </EditDialog>
    </div>
  );
}

/**
 * A workflow is either the global one or belongs to exactly one category, so
 * the two scope controls are mutually exclusive rather than independent.
 */
interface ScopeForm {
  isGlobal: boolean;
  categoryId: string;
}

function ScopeFields({
  form,
  categories,
  onChange,
  idPrefix,
}: {
  form: ScopeForm;
  categories: CategoryOption[];
  /** Receives only the scope slice; the caller merges it into its full form state. */
  onChange: (next: ScopeForm) => void;
  idPrefix: string;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-wf-scope`}>Scope</Label>
        <Select
          id={`${idPrefix}-wf-scope`}
          value={form.isGlobal ? "global" : "category"}
          onChange={(e) =>
            onChange({
              ...form,
              isGlobal: e.target.value === "global",
            })
          }
        >
          <option value="global">
            Global — every complaint without its own cycle
          </option>
          <option value="category">
            Specific category — overrides the global cycle
          </option>
        </Select>
      </div>
      {!form.isGlobal && (
        <div>
          <Label htmlFor={`${idPrefix}-wf-category`}>Category *</Label>
          <Select
            id={`${idPrefix}-wf-category`}
            value={form.categoryId}
            onChange={(e) => onChange({ ...form, categoryId: e.target.value })}
            required
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </>
  );
}
