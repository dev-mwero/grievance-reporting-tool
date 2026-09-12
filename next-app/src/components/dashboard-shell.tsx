"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Building2,
  FileText,
  Home,
  LogOut,
  Settings,
  Shield,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { queryFn } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@/types";

interface NotificationCount {
  count: number;
}

const navSections = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: Home, exact: true },
      {
        href: "/dashboard/grievances",
        label: "Grievances",
        icon: FileText,
        exact: false,
      },
      {
        href: "/dashboard/notifications",
        label: "Notifications",
        icon: Bell,
        exact: false,
      },
    ],
  },
  {
    label: "Analytics",
    roles: ["ADMIN", "SUPER_ADMIN"],
    items: [
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: BarChart3,
        exact: false,
      },
    ],
  },
  {
    label: "Administration",
    roles: ["ADMIN", "SUPER_ADMIN"],
    items: [
      {
        href: "/dashboard/admin/users",
        label: "Users",
        icon: Users,
        exact: false,
      },
      {
        href: "/dashboard/admin/invitations",
        label: "Invitations",
        icon: Shield,
        exact: false,
      },
      {
        href: "/dashboard/admin/categories",
        label: "Categories",
        icon: Tags,
        exact: false,
      },
      {
        href: "/dashboard/admin/locations",
        label: "Locations",
        icon: Building2,
        exact: false,
      },
    ],
  },
];

export function DashboardShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const unread = useQuery({
    queryKey: ["/notifications/unread-count"],
    queryFn,
    refetchInterval: 30_000,
  });
  const unreadCount: number =
    typeof unread.data === "number"
      ? unread.data
      : ((unread.data as NotificationCount | undefined)?.count ?? 0);

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-bold text-primary"
          >
            <Settings className="h-5 w-5" />
            Grievance System
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navSections.map((section) => {
            if (section.roles && !section.roles.includes(user.role))
              return null;
            return (
              <div key={section.label ?? "main"}>
                {section.label && (
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                          {item.label === "Notifications" &&
                            unreadCount > 0 && (
                              <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t px-4 py-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile-visible hamburger, profile, sign-out) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 lg:px-6">
          <span className="lg:hidden text-sm font-bold text-primary">
            Dashboard
          </span>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {user.name}
            </Link>
            <Link
              href="/dashboard/notifications"
              className="relative rounded-lg p-2 hover:bg-muted"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
