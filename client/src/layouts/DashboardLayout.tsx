import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/button';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const navLinks = (
    <>
      <Link
        to="/dashboard"
        onClick={closeSidebar}
        className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
      >
        Overview
      </Link>
      <Link
        to="/dashboard/grievances"
        onClick={closeSidebar}
        className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
      >
        Grievances
      </Link>
      <Link
        to="/dashboard/profile"
        onClick={closeSidebar}
        className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
      >
        My Profile
      </Link>
      <Link
        to="/dashboard/change-password"
        onClick={closeSidebar}
        className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
      >
        Change Password
      </Link>
      {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
        <>
          <Link
            to="/dashboard/analytics"
            onClick={closeSidebar}
            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
          >
            Analytics
          </Link>
          <Link
            to="/dashboard/admin"
            onClick={closeSidebar}
            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
          >
            Administration
          </Link>
        </>
      ) : null}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-primary text-primary-foreground sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-primary-foreground/10"
              aria-label="Toggle navigation"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <Link to="/dashboard" className="text-lg sm:text-xl font-bold truncate">
              Grievance Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
              {user?.name} ({user?.role})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-transparent text-primary-foreground border-primary-foreground/50 hover:bg-primary-foreground/10"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 border-r bg-muted/30 p-4 shrink-0">
          <nav className="space-y-1 sticky top-16">{navLinks}</nav>
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
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-background border-r p-4 transform transition-transform duration-200 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold">Menu</span>
            <button
              onClick={closeSidebar}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
              aria-label="Close navigation"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav className="space-y-1">{navLinks}</nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
