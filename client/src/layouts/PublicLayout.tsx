import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { ShieldCheck, Menu, X, FileText, Search, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/submit', label: 'Submit Grievance' },
  { to: '/track', label: 'Track Grievance' },
];

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span className="text-lg font-bold text-foreground truncate">
              Grievance Portal
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(link.to)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Staff Login
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent/60"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t bg-card px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(link.to)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Staff Login
            </Link>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-3">
              <Link to="/" className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span className="font-bold text-foreground">Grievance Portal</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A transparent platform for reporting community issues and tracking
                them to resolution.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/submit" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Submit a Grievance
                  </Link>
                </li>
                <li>
                  <Link to="/track" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Track a Grievance
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Staff Login
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Resources</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/submit" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    How to Submit
                  </Link>
                </li>
                <li>
                  <Link to="/track" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Track Progress
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Staff Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Get in Touch</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Community Affairs Office</li>
                <li>Mon–Fri, 8:00 AM – 5:00 PM</li>
                <li>
                  <a href="mailto:support@grievance.gov" className="hover:text-primary transition-colors">
                    support@grievance.gov
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Grievance Management System &copy; {new Date().getFullYear()}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link to="/submit" className="hover:text-primary transition-colors">
                <FileText className="w-4 h-4 inline mr-1" />
                Submit
              </Link>
              <Link to="/track" className="hover:text-primary transition-colors">
                <Search className="w-4 h-4 inline mr-1" />
                Track
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}