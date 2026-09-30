"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Inbox, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { apiErrorMessage, apiPost, queryFn } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "SUPERSEDED";

interface TransitionRequest {
  _id: string;
  referenceCode: string;
  grievanceId: string;
  actionLabel: string;
  fromStage: string;
  toStage: string;
  reason: string;
  status: RequestStatus;
  proposedByName: string;
  reviewedByName?: string;
  decisionNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface ListResponse {
  requests: TransitionRequest[];
  pagination: { page: number; total: number; totalPages: number };
}

/**
 * Human wording per outcome. `SUPERSEDED` is deliberately not phrased as a
 * rejection — nobody turned this down, the complaint simply moved on — because a
 * proposer reading "declined" would wrongly conclude someone judged their work.
 */
const STATUS_COPY: Record<RequestStatus, string> = {
  PENDING: "Awaiting decision",
  APPROVED: "Approved",
  REJECTED: "Declined",
  WITHDRAWN: "Withdrawn by proposer",
  SUPERSEDED: "Closed — complaint moved on",
};

export default function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RequestStatus | "">("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<TransitionRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // queryFn derives the request from the key: path first, params second.
  const query = useQuery<ListResponse>({
    queryKey: [
      "/transition-requests",
      { limit: 50, ...(status ? { status } : {}) },
    ],
    queryFn,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/transition-requests"] });
    // Approving applies a move, so the complaint itself and its move list change.
    queryClient.invalidateQueries({ queryKey: ["/grievances"] });
  }

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/transition-requests/${id}/approve`, {}),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/transition-requests/${id}/reject`, {
        note: rejectNote || undefined,
      }),
    onSuccess: () => {
      setRejecting(null);
      setRejectNote("");
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const requests = query.data?.requests ?? [];
  const pending = query.data?.pagination.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Move approvals</h1>
          <p className="text-sm text-muted-foreground">
            Staff asking to move a complaint to a stage that needs your
            sign-off.
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus | "")}
          className="w-auto"
        >
          <option value="PENDING">Awaiting decision ({pending})</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Declined</option>
          <option value="WITHDRAWN">Withdrawn</option>
          <option value="SUPERSEDED">Closed — moved on</option>
          <option value="">All</option>
        </Select>
      </div>

      {query.isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nothing waiting</p>
            <p className="text-sm text-muted-foreground">
              Staff proposals will appear here for a decision.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r._id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/grievances/${r.grievanceId}`}
                        className="font-semibold hover:underline"
                      >
                        {r.referenceCode}
                      </Link>
                      <p className="text-sm">
                        {r.proposedByName} asked to{" "}
                        <strong>{r.actionLabel}</strong>
                        <span className="text-muted-foreground">
                          {" "}
                          {r.fromStage.replace(/_/g, " ")} →{" "}
                          {r.toStage.replace(/_/g, " ")}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Proposed {formatDate(r.createdAt)}
                        {r.reviewedAt && r.reviewedByName
                          ? ` · ${STATUS_COPY[r.status].toLowerCase()} by ${r.reviewedByName}`
                          : ""}
                      </p>
                    </div>

                    {r.status === "PENDING" ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(r._id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejecting(r);
                            setRejectNote("");
                          }}
                          disabled={approve.isPending || reject.isPending}
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {STATUS_COPY[r.status]}
                      </span>
                    )}
                  </div>

                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      Reason given
                    </p>
                    {r.reason}
                  </div>

                  {r.decisionNote && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Note: </span>
                      {r.decisionNote}
                    </p>
                  )}

                  {rejecting?._id === r._id && (
                    <div className="space-y-2 rounded-md border p-3">
                      <label
                        className="text-sm font-medium"
                        htmlFor="reject-note"
                      >
                        Note to {r.proposedByName}
                      </label>
                      <Textarea
                        id="reject-note"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Explain what is needed before this can move. Optional, but a proposer is left guessing without it."
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => reject.mutate(r._id)}
                          disabled={reject.isPending}
                        >
                          Confirm decline
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejecting(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
