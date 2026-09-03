import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { getPublicStats, getCategories } from '../services/public.service';
import {
  ShieldCheck,
  FileText,
  Search,
  ArrowRight,
  CheckCircle2,
  Eye,
  Clock,
  FolderOpen,
  ChevronDown,
  MapPin,
  Lock,
  Bell,
  BarChart3,
  MessageSquare,
} from 'lucide-react';

// ─── FAQ Data ───────────────────────────────────────────────────────────────

const FAQS = [
  {
    question: 'How do I submit a grievance?',
    answer:
      'Click "Submit a Grievance" and fill out the form with your sub-county, ward, category, and a description of the issue. You can optionally attach supporting files like photos or documents. Your identity remains anonymous.',
  },
  {
    question: 'Is my identity kept anonymous?',
    answer:
      'Yes. Grievances are submitted anonymously. Your name, email, and any personal information are never collected or stored. Only the details of the issue itself are recorded.',
  },
  {
    question: 'How do I track my grievance?',
    answer:
      'After submitting, you receive a unique reference code (e.g., GRV-2026-XXXXXXXX). Use the "Track a Grievance" page and enter this code to see the current status and any public updates.',
  },
  {
    question: 'What types of issues can I report?',
    answer:
      'You can report issues across various categories including infrastructure, public services, health, education, environment, and more. Select the category that best matches your issue when submitting.',
  },
  {
    question: 'How long does resolution take?',
    answer:
      'Resolution time varies by the nature and complexity of the issue. Simple issues may be resolved within days, while complex ones may take longer. You can track progress at any time using your reference code.',
  },
  {
    question: 'Can I attach evidence to my grievance?',
    answer:
      'Yes. You can attach up to 5 files (images, PDFs, documents) to support your grievance. Each file can be up to 10MB.',
  },
];

// ─── Feature Data ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Lock,
    title: 'Anonymous Reporting',
    description:
      'Submit grievances without revealing your identity. Your privacy is protected throughout the entire process.',
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    description:
      'Track every step of your grievance from submission to resolution with a simple reference code.',
  },
  {
    icon: Clock,
    title: 'Timely Resolution',
    description:
      'Grievances are routed to the right department and monitored to ensure they are addressed promptly.',
  },
  {
    icon: Bell,
    title: 'Status Notifications',
    description:
      'Receive updates when your grievance status changes, so you always know where things stand.',
  },
  {
    icon: BarChart3,
    title: 'Data-Driven Oversight',
    description:
      'Administrators use analytics to identify trends and improve service delivery across the county.',
  },
  {
    icon: MessageSquare,
    title: 'Two-Way Communication',
    description:
      'Staff can post public updates on your grievance, keeping you informed of progress and next steps.',
  },
];

// ─── How It Works Data ──────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Submit Your Grievance',
    description:
      'Fill out the simple form with your location, category, and a description of the issue. Attach supporting files if you have them.',
  },
  {
    number: '02',
    title: 'Receive Your Reference Code',
    description:
      'Get a unique reference code instantly. Save it — this is how you track your grievance at any time.',
  },
  {
    number: '03',
    title: 'Track to Resolution',
    description:
      'Use your reference code to follow progress as staff review, assign, and resolve your issue. Get notified at every step.',
  },
];

// ─── FAQ Item Component ─────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-accent/30 transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────────────

export default function Home() {
  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: getPublicStats,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['public-categories'],
    queryFn: getCategories,
  });

  const statItems = [
    {
      icon: FileText,
      label: 'Grievances Submitted',
      value: stats?.totalGrievances ?? 0,
    },
    {
      icon: CheckCircle2,
      label: 'Resolved',
      value: stats?.resolvedGrievances ?? 0,
    },
    {
      icon: FolderOpen,
      label: 'Categories',
      value: stats?.activeCategories ?? 0,
    },
    {
      icon: MapPin,
      label: 'Sub-Counties Covered',
      value: stats?.activeSubCounties ?? 0,
    },
  ];

  return (
    <div className="bg-background">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
        </div>

        <div className="container mx-auto px-4 py-20 sm:py-28 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-xs font-semibold uppercase tracking-wider mb-8">
            <ShieldCheck className="w-4 h-4" />
            Community Grievance System
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            Report issues in your community.
            <span className="block text-accent">Track them to resolution.</span>
          </h1>

          <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Submit a grievance anonymously and follow its progress with a simple
            reference code. Your voice drives real change in your community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/submit">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 py-6"
              >
                <FileText className="w-5 h-5" />
                Submit a Grievance
              </Button>
            </Link>
            <Link to="/track">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 text-base px-8 py-6"
              >
                <Search className="w-5 h-5" />
                Track a Grievance
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12 text-sm text-primary-foreground/70">
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Anonymous
            </span>
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Transparent
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Trackable
            </span>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ────────────────────────────────────────────────────── */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {statItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="w-6 h-6" />
                </span>
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {value.toLocaleString()}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Three simple steps to make your voice heard
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The process is designed to be quick, transparent, and accessible to everyone.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {STEPS.map((step) => (
            <div key={step.number} className="relative">
              <div className="text-5xl font-bold text-primary/15 mb-4">{step.number}</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              {step.number !== '03' && (
                <ArrowRight className="hidden md:block absolute top-6 -right-6 w-5 h-5 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-muted/40 border-y">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">Why Choose Us</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Built for accountability and trust
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every feature is designed to make grievance reporting simple, secure, and effective.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-card border rounded-xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary mb-4">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Categories ───────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">What You Can Report</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Issues across every sector
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From roads and water to health and education — report issues in any area of community life.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <Link
              key={cat._id}
              to="/submit"
              className="group flex items-center gap-3 p-4 border rounded-xl bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FolderOpen className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-muted/40 border-y">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about submitting and tracking grievances.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-primary text-primary-foreground rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,white_1px,transparent_1px)] bg-[length:24px_24px]" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Have an issue to report?
            </h2>
            <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Join thousands of community members who have already made their voices heard.
              It takes less than two minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/submit">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 py-6"
                >
                  <FileText className="w-5 h-5" />
                  Submit a Grievance
                </Button>
              </Link>
              <Link to="/track">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 text-base px-8 py-6"
                >
                  <Search className="w-5 h-5" />
                  Track a Grievance
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}