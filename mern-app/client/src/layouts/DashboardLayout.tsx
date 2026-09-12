import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/button';
import NotificationBell from '../components/NotificationBell';
import {
  LayoutDashboard,
  FileText,
  User,
  KeyRound,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/dashboard/grievances', label: 'Grievances', icon: FileText },
    { to: '/dashboard/profile', label: 'My Profile', icon: User },
    { to: '/dashboard/change-password', label: 'Change Password', icon: KeyRound },
  ];

  const adminItems = [
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/dashboard/admin', label: 'Administration', icon: Settings },
  ];

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const renderNav = (items: { to: string; label: string; icon: typeof LayoutDashboard }[]) =>
    items.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        onClick={closeSidebar}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive(to)
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </Link>
    ));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent/60"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-lg font-bold truncate text-foreground">
                Grievance Portal
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <NotificationBell />
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">
                {user?.name}
              </span>
              <span className="text-xs text-muted-foreground">{user?.role.replace(/_/g, ' ')}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 border-r bg-card p-4 shrink-0">
          <nav className="space-y-1 sticky top-20">
            {renderNav(navItems)}
            {isAdmin && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Administration
                  </span>
                </div>
                {renderNav(adminItems)}
              </>
            )}
          </nav>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r p-4 transform transition-transform duration-200 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-foreground">Menu</span>
            <button
              onClick={closeSidebar}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent/60"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="space-y-1">
            {renderNav(navItems)}
            {isAdmin && (
              <>
                <div className="pt-4 pb-1 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Administration
                  </span>
                </div>
                {renderNav(adminItems)}
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}