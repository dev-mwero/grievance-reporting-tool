"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, SearchX } from "lucide-react";
import { useState } from "react";
import { RichTextView } from "@/components/rich-text-view";
import {
  Button,
  Card,
  CardContent,
  FormError,
  Input,
  Label,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { ApiClientError, apiGet } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/utils";

interface TrackResult {
  referenceCode: string;
  status: string;
  subCountyName: string;
  wardName: string;
  categoryName: string;
  description: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  updates: Array<{
    _id: string;
    content: string;
    authorName: string;
    createdAt: string;
  }>;
}

export function TrackView({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode);

  const query = useQuery({
    queryKey: ["/public/grievances", submittedCode],
    queryFn: async ({ signal }) => {
      if (!submittedCode || submittedCode.length < 14) return null;
      try {
        return await apiGet<TrackResult>(
          `/public/grievances/${encodeURIComponent(submittedCode)}`,
          signal,
        );
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: submittedCode.length >= 14,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
          <Search className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Track a grievance</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Enter the reference code you received when submitting your grievance
          (e.g. GRV-2026-1A2B3C4D).
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedCode(code.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Label htmlFor="code">Reference code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GRV-2026-XXXXXXXX"
                className="font-mono uppercase"
              />
            </div>
            <Button type="submit" disabled={code.trim().length < 14}>
              Track
            </Button>
          </form>
          <FormError
            message={
              query.isError ? "Failed to load this grievance." : undefined
            }
          />

          {query.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner className="h-7 w-7" />
            </div>
          )}

          {query.isSuccess && query.data && <ResultView data={query.data} />}

          {query.isSuccess && !query.data && submittedCode.length >= 14 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                No grievance found with reference code{" "}
                <span className="font-mono font-semibold">{submittedCode}</span>
                . Double-check the code and try again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultView({ data }: { data: TrackResult }) {
  const statuses = [
    { label: "Submitted", date: data.submittedAt, done: true },
    {
      label: "Acknowledged",
      date: data.acknowledgedAt,
      done: Boolean(data.acknowledgedAt),
    },
    {
      label: "Resolved",
      date: data.resolvedAt,
      done: Boolean(data.resolvedAt),
    },
    { label: "Closed", date: data.closedAt, done: Boolean(data.closedAt) },
  ];

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm font-bold tracking-widest text-primary">
            {data.referenceCode}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.wardName}, {data.subCountyName} · {data.categoryName}
          </p>
        </div>
        <StatusBadge
          status={data.status as never}
          className="self-start sm:self-auto"
        />
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Your submission</h3>
        <Card>
          <CardContent className="p-5">
            <RichTextView html={data.description} />
            <p className="mt-3 text-xs text-muted-foreground">
              Submitted {formatRelative(data.submittedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Progress</h3>
        <ol className="space-y-0">
          {statuses.map((s) => (
            <li key={s.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1.5 h-3 w-3 rounded-full ${
                    s.done ? "bg-primary" : "border-2 border-border bg-card"
                  }`}
                />
                {s.label !== "Closed" && (
                  <span className="h-6 w-px bg-border" />
                )}
              </div>
              <div className="pb-6">
                <p className="text-sm font-medium">{s.label}</p>
                {s.date && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(s.date)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {data.updates.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Public updates</h3>
          <div className="space-y-3">
            {data.updates.map((update, i) => (
              <Card key={update._id} className="bg-muted/20">
                <CardContent className="p-4">
                  <RichTextView html={update.content} />
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {update.authorName || "Officer"}
                    </span>
                    {i > 0 && "·"} {formatRelative(update.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
