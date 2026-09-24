"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { Button, Card, CardContent, Spinner } from "@/components/ui";
import { apiPost, queryFn } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  grievanceId?: string;
  referenceCode?: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ notifications: NotificationItem[] }>({
    queryKey: ["/notifications", { limit: 50 }],
    queryFn,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/notifications/unread-count"],
      });
    },
  });

  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        {notifications.some((n) => !n.isRead) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n._id}
              className={`card-hover ${n.isRead ? "opacity-70" : "border-primary/40"}`}
            >
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        n.isRead ? "bg-muted-foreground/40" : "bg-primary"
                      }`}
                    />
                    <p className="text-sm font-semibold">{n.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {n.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </p>
                </div>
                {n.grievanceId && (
                  <Link
                    href={`/dashboard/grievances/${n.grievanceId}`}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
