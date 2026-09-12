"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { queryFn } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { GrievanceStatus } from "@/types";

interface GrievanceRow {
  _id: string;
  referenceCode: string;
  status: string;
  submittedAt?: string;
  createdAt: string;
  categoryId?: { name: string } | null;
  primaryAssigneeId?: { name: string } | null;
}

interface GrievanceListResponse {
  grievances: GrievanceRow[];
  pagination: { page: number; total: number; totalPages: number };
}

const PAGE_SIZE = 15;

const statusOptions = Object.values(GrievanceStatus);

export default function GrievanceListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<GrievanceListResponse>({
    queryKey: [
      "/grievances",
      {
        limit: PAGE_SIZE,
        page,
        search: debouncedSearch || undefined,
        status: status || undefined,
      },
    ],
    queryFn,
  });

  const grievances = data?.grievances ?? [];
  const pagination = data?.pagination;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setDebouncedSearch(search);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Grievances</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Input
                placeholder="Search reference code or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
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
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden md:table-cell">Category</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Assignee</th>
                    <th className="px-4 py-3 hidden lg:table-cell">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grievances.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No grievances found.
                      </td>
                    </tr>
                  )}
                  {grievances.map((g: GrievanceRow) => (
                    <tr key={g._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold tracking-wide text-primary">
                        {g.referenceCode}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={g.status as GrievanceStatus} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {g.categoryId?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {g.primaryAssigneeId?.name ?? (
                          <span className="italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {formatDate(g.submittedAt ?? g.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/grievances/${g._id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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
    </div>
  );
}
