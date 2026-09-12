"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RichTextView } from "@/components/rich-text-view";
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
  Select,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { ApiClientError, apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/utils";
import { canTransition, GrievanceStatus } from "@/types";

interface GrievanceDetail {
  grievance: {
    _id: string;
    referenceCode: string;
    status: string;
    description: string;
    submittedAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    closedAt?: string;
    subCountyId: { name: string } | null;
    wardId: { name: string } | null;
    categoryId: { name: string } | null;
    primaryAssigneeId?: { name: string; email: string; title?: string };
  };
  updates: Array<{
    _id: string;
    type: string;
    content: string;
    authorId: { name: string } | null;
    createdAt: string;
  }>;
  assignments: Array<{
    _id: string;
    assigneeId: { name: string; email: string };
    role: string;
    assignedAt: string;
  }>;
}

export default function GrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const [newUpdate, setNewUpdate] = useState("");
  const [updateType, setUpdateType] = useState<
    "PUBLIC_UPDATE" | "INTERNAL_NOTE"
  >("PUBLIC_UPDATE");
  const [error, setError] = useState<string | null>(null);

  // Status transition
  const [newStatus, setNewStatus] = useState<GrievanceStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const opts = Object.values(GrievanceStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["/grievances", id],
    queryFn: async ({ signal }) => {
      const result = await apiGet<GrievanceDetail>(`/grievances/${id}`, signal);
      return result;
    },
    enabled: Boolean(id),
  });

  const addUpdateMutation = useMutation({
    mutationFn: () =>
      apiPost(`/grievances/${id}/updates`, {
        type: updateType,
        content: newUpdate,
      }),
    onSuccess: () => {
      setNewUpdate("");
      queryClient.invalidateQueries({ queryKey: ["/grievances", id] });
    },
    onError: () => setError("Failed to add update."),
  });

  const statusMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/grievances/${id}/status`, {
        status: newStatus,
        note: statusNote || undefined,
      }),
    onSuccess: () => {
      setNewStatus("");
      setStatusNote("");
      queryClient.invalidateQueries({ queryKey: ["/grievances", id] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to update status.",
      ),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/grievances"
          className="text-sm text-primary hover:underline"
        >
          ← Back to grievances
        </Link>
        <Spinner className="mx-auto h-8 w-8" />
      </div>
    );
  }

  const g = data.grievance;
  const transitions = opts.filter((s) =>
    canTransition(g.status as GrievanceStatus, s),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/grievances"
        className="text-sm text-primary hover:underline"
      >
        <ArrowLeft className="mr-1 inline h-4 w-4" /> Back to grievances
      </Link>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {g.referenceCode}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {g.subCountyId?.name && g.wardId?.name
              ? `${g.wardId.name}, ${g.subCountyId.name}`
              : "Location not set"}
          </p>
        </div>
        <StatusBadge
          status={g.status as GrievanceStatus}
          className="self-start sm:self-auto"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextView html={g.description} />
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Submitted{" "}
                  {formatDate(g.submittedAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />{" "}
                  {g.categoryId?.name ?? "No category"}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {g.primaryAssigneeId?.name ?? "Unassigned"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Updates
              </CardTitle>
              <CardDescription>
                Public updates are shown to the complainant; internal notes are
                only visible here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.updates.length === 0 && (
                <p className="text-sm text-muted-foreground">No updates yet.</p>
              )}
              {data.updates.map((update) => (
                <div
                  key={update._id}
                  className={`rounded-lg border p-4 ${
                    update.type === "INTERNAL_NOTE"
                      ? "border-dashed bg-muted/30"
                      : "bg-card"
                  }`}
                >
                  <RichTextView html={update.content} />
                  <p className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {update.authorId?.name ?? "Officer"}
                    </span>
                    <span>{formatRelative(update.createdAt)}</span>
                  </p>
                </div>
              ))}

              <div className="rounded-lg border border-dashed p-4">
                <div className="mb-3 flex gap-2">
                  <Select
                    value={updateType}
                    onChange={(e) =>
                      setUpdateType(
                        e.target.value as "PUBLIC_UPDATE" | "INTERNAL_NOTE",
                      )
                    }
                    className="w-44"
                  >
                    <option value="PUBLIC_UPDATE">Public update</option>
                    <option value="INTERNAL_NOTE">Internal note</option>
                  </Select>
                  <Input
                    placeholder="Write an update…"
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                  />
                  <Button
                    onClick={() => addUpdateMutation.mutate()}
                    disabled={!newUpdate.trim() || addUpdateMutation.isPending}
                  >
                    {addUpdateMutation.isPending ? "Posting…" : "Post"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="update-status">Change status</Label>
                <Select
                  id="update-status"
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as GrievanceStatus | "")
                  }
                >
                  <option value="">Select status…</option>
                  {transitions.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
                <Textarea
                  className="mt-2"
                  placeholder="Note shown to the complainant (optional)"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                <Button
                  className="mt-2 w-full"
                  onClick={() => statusMutation.mutate()}
                  disabled={!newStatus || statusMutation.isPending}
                >
                  {statusMutation.isPending ? "Updating…" : "Update status"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
