import { Link, Outlet } from 'react-router';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            Grievance Portal
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/submit" className="text-sm font-medium hover:underline">
              Submit Grievance
            </Link>
            <Link to="/track" className="text-sm font-medium hover:underline">
              Track Grievance
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Staff Login
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Grievance Management System &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
