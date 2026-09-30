"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  MessageSquare,
  Paperclip,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AttachmentPanel } from "@/components/attachment-panel";
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
import { ApiClientError, apiGet, apiPatch, apiPost, queryFn } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { StageDescriptor } from "@/lib/stages";
import { formatDate, formatRelative } from "@/lib/utils";

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
    stage?: StageDescriptor;
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

/** A staff request to move a complaint, awaiting or past an admin's decision. */
interface TransitionRequest {
  _id: string;
  actionLabel: string;
  fromStage: string;
  toStage: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SUPERSEDED";
  proposedByName: string;
  reviewedByName?: string;
  decisionNote?: string;
  createdAt: string;
}

/** A move the server says this actor may take right now. */
interface GrievanceMove {
  to: string;
  toLabel: string;
  actionLabel: string;
  requiresApproval: boolean;
  requiresReason: boolean;
  requiresAttachment: boolean;
  isReopen: boolean;
  /** False for a move staff must propose rather than apply. */
  canApply: boolean;
}

export default function GrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [newUpdate, setNewUpdate] = useState("");
  const [updateType, setUpdateType] = useState<
    "PUBLIC_UPDATE" | "INTERNAL_NOTE"
  >("PUBLIC_UPDATE");
  const [error, setError] = useState<string | null>(null);

  // Which configured move to apply. The options come from the server, which runs
  // the same check that authorises the move — so the UI cannot offer something
  // that would then be refused.
  const [chosenMove, setChosenMove] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/grievances", id],
    queryFn: async ({ signal }) => {
      const result = await apiGet<GrievanceDetail>(`/grievances/${id}`, signal);
      return result;
    },
    enabled: Boolean(id),
  });

  const [assigneeId, setAssigneeId] = useState("");
  const staff = useQuery<{
    users: Array<{ _id: string; name: string; email: string }>;
  }>({
    queryKey: ["/admin/users", { limit: 100 }],
    queryFn,
    enabled: isAdmin,
  });

  const assignMutation = useMutation({
    mutationFn: (primaryAssigneeId: string) =>
      apiPost(`/grievances/${id}/assign`, {
        primaryAssigneeId,
        supportingAssigneeIds: [],
      }),
    onSuccess: () => {
      setAssigneeId("");
      queryClient.invalidateQueries({ queryKey: ["/grievances", id] });
      queryClient.invalidateQueries({ queryKey: ["/grievances/dashboard"] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to assign.",
      ),
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

  const { data: moves = [] } = useQuery({
    queryKey: ["/grievances", id, "moves"],
    queryFn: async ({ signal }) => {
      const result = await apiGet<GrievanceMove[]>(
        `/grievances/${id}/moves`,
        signal,
      );
      return result;
    },
    enabled: Boolean(id),
  });

  const selectedMove = moves.find((m) => m.to === chosenMove);

  /**
   * Whether any evidence exists, so the panel can hide its dropzone once the
   * requirement is met. Counted on the server rather than inferred from the
   * list so the button's enabled state and the panel agree.
   */
  const { data: evidence } = useQuery<{ count: number }>({
    queryKey: ["/grievances", id, "attachment-count"],
    queryFn: ({ signal }) =>
      apiGet<{ count: number }>(`/grievances/${id}/attachments/count`, signal),
    enabled: Boolean(id),
  });
  const hasEvidence = (evidence?.count ?? 0) > 0;

  // Keys uploaded in this session that the service has not yet been asked to
  // attach. Held so a proposal can claim them in the same request; cleared once
  // they have been, so a later proposal does not try to re-claim them.
  const [pendingAttachmentKeys, setPendingAttachmentKeys] = useState<string[]>(
    [],
  );

  const statusMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/grievances/${id}/status`, {
        status: chosenMove,
        note: statusNote || undefined,
      }),
    onSuccess: () => {
      setChosenMove("");
      setStatusNote("");
      queryClient.invalidateQueries({ queryKey: ["/grievances", id] });
      queryClient.invalidateQueries({
        queryKey: ["/grievances", id, "moves"],
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to update status.",
      ),
  });

  const { data: requestHistory = [] } = useQuery({
    queryKey: ["/grievances", id, "transition-requests"],
    queryFn: async ({ signal }) =>
      apiGet<TransitionRequest[]>(
        `/grievances/${id}/transition-requests`,
        signal,
      ),
    enabled: Boolean(id),
  });

  const pendingRequest = requestHistory.find((r) => r.status === "PENDING");

  const proposeMutation = useMutation({
    mutationFn: () =>
      apiPost(`/grievances/${id}/transition-requests`, {
        to: chosenMove,
        reason: statusNote,
        // Evidence uploaded moments earlier is still unclaimed in storage; the
        // service verifies each key against its own record of the upload before
        // attaching it alongside the proposal.
        ...(pendingAttachmentKeys.length > 0
          ? { attachmentKeys: pendingAttachmentKeys }
          : {}),
      }),
    onSuccess: () => {
      setChosenMove("");
      setStatusNote("");
      setPendingAttachmentKeys([]);
      queryClient.invalidateQueries({
        queryKey: ["/grievances", id, "transition-requests"],
      });
      // The count changed server-side, so the evidence gate must re-read it
      // before the next move can be applied.
      queryClient.invalidateQueries({
        queryKey: ["/grievances", id, "attachment-count"],
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to send request.",
      ),
  });

  const withdrawMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiPost(`/transition-requests/${requestId}/withdraw`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/grievances", id, "transition-requests"],
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiClientError ? err.message : "Failed to withdraw.",
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
          status={g.status}
          label={g.stage?.label}
          color={g.stage?.color}
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
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-primary" /> Evidence
              </CardTitle>
              <CardDescription>
                Files supporting this complaint. Moves configured to require
                evidence cannot be applied until something is attached.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentPanel
                grievanceId={id}
                hasEvidence={hasEvidence}
                onUploaded={(keys) =>
                  setPendingAttachmentKeys((prev) => [...prev, ...keys])
                }
              />
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> Assignment
                </CardTitle>
                <CardDescription>
                  Currently assigned to{" "}
                  <span className="font-medium text-foreground">
                    {g.primaryAssigneeId?.name ?? "no one"}
                  </span>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="assign-staff">Assign to staff member</Label>
                  <Select
                    id="assign-staff"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Select staff…</option>
                    {staff.data?.users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => assignMutation.mutate(assigneeId)}
                  disabled={!assigneeId || assignMutation.isPending}
                >
                  {assignMutation.isPending ? "Assigning…" : "Assign grievance"}
                </Button>
              </CardContent>
            </Card>
          )}

          {moves.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Move this complaint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="update-status">Next step</Label>
                  <Select
                    id="update-status"
                    value={chosenMove}
                    onChange={(e) => {
                      setChosenMove(e.target.value);
                      // Drop a stale reason when switching between moves, so
                      // text typed for one is not silently reused on another.
                      setStatusNote("");
                    }}
                  >
                    <option value="">Select an action…</option>
                    {moves.map((m) => (
                      <option key={m.to} value={m.to}>
                        {m.actionLabel} → {m.toLabel}
                        {m.canApply ? "" : " (needs approval)"}
                      </option>
                    ))}
                  </Select>
                </div>

                {pendingRequest && (
                  <Alert variant="info">
                    <div className="space-y-2">
                      <p>
                        <strong>{pendingRequest.proposedByName}</strong> asked
                        to {pendingRequest.actionLabel.toLowerCase()} →{" "}
                        {pendingRequest.toStage.replace(/_/g, " ")}. Awaiting an
                        admin&apos;s decision.
                      </p>
                      {pendingRequest.proposedByName === user?.name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            withdrawMutation.mutate(pendingRequest._id)
                          }
                          disabled={withdrawMutation.isPending}
                        >
                          Withdraw my request
                        </Button>
                      )}
                    </div>
                  </Alert>
                )}

                {selectedMove?.isReopen && (
                  <Alert variant="info">
                    Reopening returns this complaint to active work. Say why.
                  </Alert>
                )}

                <div>
                  <Label htmlFor="status-note">
                    {selectedMove?.requiresApproval
                      ? "Why this move is needed (required)"
                      : selectedMove?.requiresReason
                        ? "Reason (required)"
                        : "Reason (optional)"}
                  </Label>
                  <Textarea
                    id="status-note"
                    className="mt-1"
                    placeholder="Shown to the complainant in the tracking timeline."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>

                {/* Evidence requirement. Surfaced here rather than left to the
                    service's error, because the fix is to upload a file — and
                    the server refuses the move for the same reason. */}
                {selectedMove?.requiresAttachment === true && !hasEvidence && (
                  <Alert variant="info">
                    This action needs evidence attached first. Add a file in
                    Evidence above, then come back to apply it.
                  </Alert>
                )}

                <Button
                  className="w-full"
                  onClick={() => {
                    if (selectedMove?.canApply === false) {
                      proposeMutation.mutate(undefined);
                    } else {
                      statusMutation.mutate();
                    }
                  }}
                  disabled={
                    !chosenMove ||
                    statusMutation.isPending ||
                    proposeMutation.isPending ||
                    // A reason is required both where the move asks for one and
                    // wherever an approval is involved — an admin approving a
                    // reasonless request has nothing to judge.
                    (statusNote.trim() === "" &&
                      (selectedMove?.requiresReason === true ||
                        selectedMove?.requiresApproval === true)) ||
                    (pendingRequest !== undefined &&
                      selectedMove?.canApply === false) ||
                    // Disabled rather than left to fail: the remedy is visible
                    // in the notice above.
                    (selectedMove?.requiresAttachment === true && !hasEvidence)
                  }
                >
                  {proposeMutation.isPending
                    ? "Sending…"
                    : selectedMove?.canApply === false
                      ? "Send for approval"
                      : statusMutation.isPending
                        ? "Applying…"
                        : "Apply move"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            // An admin with nothing available is a workflow gap, so say that
            // rather than showing an empty panel they cannot act on.
            isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Move this complaint</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert variant="info">
                    No moves are available from{" "}
                    <strong>{g.stage?.label ?? g.status}</strong>. Add a move
                    out of this stage in the complaint cycle, or reopen it.
                  </Alert>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
