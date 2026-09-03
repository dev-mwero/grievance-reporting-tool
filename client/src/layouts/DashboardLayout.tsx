import { Link, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/button';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold">
            Grievance Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm">
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
      <div className="flex flex-1">
        <aside className="w-56 border-r bg-muted/30 p-4">
          <nav className="space-y-1">
            <Link
              to="/dashboard"
              className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
            >
              Overview
            </Link>
            <Link
              to="/dashboard/grievances"
              className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
            >
              Grievances
            </Link>
            <Link
              to="/dashboard/profile"
              className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
            >
              My Profile
            </Link>
            <Link
              to="/dashboard/change-password"
              className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
            >
              Change Password
            </Link>
            {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
              <>
                <Link
                  to="/dashboard/analytics"
                  className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
                >
                  Analytics
                </Link>
                <Link
                  to="/dashboard/admin"
                  className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
                >
                  Administration
                </Link>
              </>
            ) : null}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
