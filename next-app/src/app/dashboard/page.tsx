"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, FileText, Target } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { queryFn } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import type { GrievanceStatus } from "@/types";

interface DashboardStats {
  myAssigned: number;
  totalOpen: number;
  recentActivity: Array<{
    _id: string;
    type: string;
    content: string;
    createdAt: string;
    grievanceId: { referenceCode: string; status: string } | null;
  }>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["/grievances/dashboard"],
    queryFn,
  });

  const stats = data as DashboardStats | undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {isLoading ? (
        <Spinner className="h-8 w-8" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.myAssigned ?? 0}</p>
                  <p className="text-sm text-muted-foreground">
                    Assigned to me
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent-foreground">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalOpen ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Total open</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.recentActivity?.length ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    My recent actions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent activity</CardTitle>
                <Link
                  href="/dashboard/grievances"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all grievances
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!stats?.recentActivity?.length ? (
                <p className="py-6 text-center text-muted-foreground">
                  No recent activity.
                </p>
              ) : (
                <ul className="divide-y">
                  {stats.recentActivity.map((item) => (
                    <li
                      key={item._id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.content}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.grievanceId?.referenceCode && (
                            <span className="mr-2 font-mono font-semibold text-primary">
                              {item.grievanceId.referenceCode}
                            </span>
                          )}
                          {item.grievanceId && (
                            <StatusBadge
                              status={
                                item.grievanceId.status as GrievanceStatus
                              }
                            />
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(item.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
