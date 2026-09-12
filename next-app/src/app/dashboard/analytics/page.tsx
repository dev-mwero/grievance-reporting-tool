"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import { queryFn } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Overview {
  grievances: {
    total: number;
    open: number;
    resolved: number;
    closed: number;
    rejected: number;
    avgResolutionDays: number | null;
  };
  users: { total: number; active: number };
  configuration: { categories: number; subCounties: number };
}

interface StatusDistribution {
  distribution: Record<string, number>;
  total: number;
}

interface CategoryBreakdown {
  breakdown: Array<{ _id: string; count: number; categoryName?: string }>;
  total: number;
}

export default function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [range, setRange] = useState<{ dateFrom?: string; dateTo?: string }>(
    {},
  );

  const overview = useQuery({
    queryKey: ["/admin/analytics/overview", range],
    queryFn,
  });
  const distribution = useQuery({
    queryKey: ["/admin/analytics/status-distribution", range],
    queryFn,
  });
  const categories = useQuery({
    queryKey: ["/admin/analytics/category-breakdown", range],
    queryFn,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setRange({
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            });
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm">
            Apply
          </Button>
          {(dateFrom || dateTo) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setRange({});
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </div>

      {overview.isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : (
        <>
          <OverviewCards data={overview.data as Overview} />
          <div className="grid gap-6 lg:grid-cols-2">
            <StatusCard
              data={distribution.data as StatusDistribution | undefined}
            />
            <CategoryCard
              data={categories.data as CategoryBreakdown | undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OverviewCards({ data }: { data?: Overview }) {
  if (!data) return null;
  const stats = [
    { label: "Total grievances", value: data.grievances.total },
    { label: "Open", value: data.grievances.open },
    {
      label: "Resolved",
      value: data.grievances.resolved,
      tone: "text-emerald-600",
    },
    { label: "Closed", value: data.grievances.closed },
    { label: "Rejected", value: data.grievances.rejected },
    {
      label: "Avg resolution (days)",
      value: data.grievances.avgResolutionDays ?? "—",
    },
    {
      label: "Active users",
      value: `${data.users.active}/${data.users.total}`,
    },
    {
      label: "Categories / Sub-counties",
      value: `${data.configuration.categories} / ${data.configuration.subCounties}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="card-hover">
          <CardContent className="p-4">
            <p
              className={cn("text-2xl font-bold", s.tone && "text-emerald-600")}
            >
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusCard({ data }: { data?: StatusDistribution }) {
  if (!data) return null;
  const entries = Object.entries(data.distribution);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <Card>
      <CardHeader>
        <CardTitle>By status</CardTitle>
        <CardDescription>Total {data.total}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([status, count]) => (
          <div key={status} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{status.replace("_", " ")}</span>
              <span className="text-muted-foreground">{count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CategoryCard({ data }: { data?: CategoryBreakdown }) {
  if (!data) return null;
  const max = Math.max(1, ...data.breakdown.map((b) => b.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
        <CardDescription>Total {data.total}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.breakdown.length === 0 && (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
        {data.breakdown.map((b) => (
          <div key={b._id ?? "none"} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate font-medium">
                {b.categoryName ?? "Uncategorised"}
              </span>
              <span className="text-muted-foreground">{b.count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-accent transition-all"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
