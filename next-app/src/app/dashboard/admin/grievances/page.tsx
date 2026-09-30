"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Search } from "lucide-react";
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
  Input,
  Label,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { apiErrorMessage, apiPatch, queryFn } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { GrievanceStatus } from "@/types";

interface GrievanceRow {
  _id: string;
  referenceCode: string;
  status: string;
  submittedAt?: string;
  createdAt: string;
  description: string;
  subCountyId: { _id: string; name: string };
  wardId: { _id: string; name: string };
  categoryId: { _id: string; name: string } | null;
  primaryAssigneeId: { _id: string; name: string } | null;
  deletedAt?: string;
  deleteReason?: string;
}

interface ListResponse {
  grievances: GrievanceRow[];
  pagination: { page: number; total: number; totalPages: number };
}

interface SubCountyOption {
  _id: string;
  name: string;
}
interface WardOption {
  _id: string;
  name: string;
  subCountyId: { _id: string };
}
interface CategoryOption {
  _id: string;
  name: string;
}

const PAGE_SIZE = 15;

const statusOptions = Object.values(GrievanceStatus);

export default function AdminGrievancesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState<DeletionScope>("active");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [amending, setAmending] = useState<GrievanceRow | null>(null);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: [
      "/admin/grievances",
      {
        limit: PAGE_SIZE,
        page,
        search: debouncedSearch || undefined,
        status: status || undefined,
        deletionScope: scope,
      },
    ],
    queryFn,
  });

  const grievances = data?.grievances ?? [];
  const pagination = data?.pagination;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/admin/grievances"] });

  const showErr = (err: unknown) =>
    setError(apiErrorMessage(err, "Operation failed."));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints</h1>
          <p className="text-sm text-muted-foreground">
            Every grievance submitted by the public, including deleted records.
          </p>
        </div>
        <DeletionScopeSelect value={scope} onChange={setScope} />
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setDebouncedSearch(search);
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label>Search</Label>
              <Input
                placeholder="Reference code or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label>Status</Label>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 hidden md:table-cell">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Assignee</th>
                    <th className="px-4 py-3 hidden lg:table-cell">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grievances.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No complaints found.
                      </td>
                    </tr>
                  )}
                  {grievances.map((g) => (
                    <tr
                      key={g._id}
                      className={
                        g.deletedAt ? "bg-destructive/5" : "hover:bg-muted/30"
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold tracking-wide text-primary">
                        {g.referenceCode}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.wardId?.name ?? "—"}
                        <span className="block text-xs">
                          {g.subCountyId?.name ?? "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {g.categoryId?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {g.deletedAt ? (
                          <span
                            className="text-xs font-semibold text-destructive"
                            title={g.deleteReason}
                          >
                            Deleted
                          </span>
                        ) : (
                          <StatusBadge status={g.status as GrievanceStatus} />
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {g.primaryAssigneeId?.name ?? (
                          <span className="italic">Unassigned</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatDate(g.submittedAt ?? g.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!g.deletedAt && (
                            <>
                              <Link href={`/dashboard/grievances/${g._id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Open the full case file"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={`Amend ${g.referenceCode}`}
                                onClick={() => setAmending(g)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <DeleteRowActions
                            basePath="/admin/grievances"
                            id={g._id}
                            label={g.referenceCode}
                            deleted={Boolean(g.deletedAt)}
                            onDone={invalidate}
                            onError={showErr}
                            onMessage={setMessage}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AmendDialog
        key={amending?._id ?? "closed"}
        grievance={amending}
        onClose={() => setAmending(null)}
        onSaved={(code) => {
          setAmending(null);
          setMessage(`${code} amended.`);
          invalidate();
        }}
        onError={showErr}
      />
    </div>
  );
}

/**
 * Corrects a misfiled complaint. The public submission endpoint stays
 * immutable, so this is the only way to re-point a case at the right category
 * or location once it has been received.
 */
function AmendDialog({
  grievance,
  onClose,
  onSaved,
  onError,
}: {
  grievance: GrievanceRow | null;
  onClose: () => void;
  onSaved: (referenceCode: string) => void;
  onError: (message: string) => void;
}) {
  // Seeded from props on mount; the parent keys this component by id so
  // opening a different complaint remounts it with fresh values.
  const [form, setForm] = useState({
    subCountyId: grievance?.subCountyId?._id ?? "",
    wardId: grievance?.wardId?._id ?? "",
    categoryId: grievance?.categoryId?._id ?? "",
    description: grievance?.description ?? "",
  });
  const [loadError] = useState<string | null>(null);

  const subCounties = useQuery<{ subCounties: SubCountyOption[] }>({
    queryKey: ["/admin/sub-counties", { limit: 200, isActive: "true" }],
    queryFn,
  });
  const wards = useQuery<{ wards: WardOption[] }>({
    queryKey: ["/admin/wards", { limit: 500, isActive: "true" }],
    queryFn,
  });
  const categories = useQuery<{ categories: CategoryOption[] }>({
    queryKey: ["/admin/categories", { limit: 100, isActive: "true" }],
    queryFn,
  });

  const save = useMutation({
    mutationFn: () =>
      apiPatch(`/admin/grievances/${grievance?._id}`, {
        subCountyId: form.subCountyId,
        wardId: form.wardId,
        categoryId: form.categoryId,
        description: form.description,
      }),
    onSuccess: () => {
      if (grievance) onSaved(grievance.referenceCode);
    },
    onError,
  });

  // The API rejects a ward that is not inside the chosen sub-county, so keep
  // the picker honest instead of surfacing the error after the fact.
  const wardOptions = (wards.data?.wards ?? []).filter(
    (w) => w.subCountyId?._id === form.subCountyId,
  );

  const busy = save.isPending;

  return (
    <EditDialog
      open={Boolean(grievance)}
      onClose={onClose}
      size="lg"
      title="Amend complaint"
      description={
        grievance
          ? `${grievance.referenceCode} · ${grievance.status.replace("_", " ").toLowerCase()}`
          : undefined
      }
      submitLabel="Save amendment"
      saving={busy}
      error={loadError}
      onSubmit={() => save.mutate()}
    >
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Changes are recorded in the audit log with your name. The original
        submission stays on the record.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="amend-subcounty">Sub-County</Label>
          <Select
            id="amend-subcounty"
            value={form.subCountyId}
            onChange={(e) =>
              setForm({ ...form, subCountyId: e.target.value, wardId: "" })
            }
          >
            {(subCounties.data?.subCounties ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amend-ward">Ward</Label>
          <Select
            id="amend-ward"
            value={form.wardId}
            onChange={(e) => setForm({ ...form, wardId: e.target.value })}
          >
            <option value="">Select…</option>
            {wardOptions.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amend-category">Category</Label>
          <Select
            id="amend-category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {(categories.data?.categories ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="amend-description">Description</Label>
        <Textarea
          id="amend-description"
          rows={8}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
    </EditDialog>
  );
}
