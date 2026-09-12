import {
  ArrowRight,
  ClipboardList,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { connectToDatabase } from "@/server/db";
import { getPublicStats } from "@/server/services/public.service";

const stats = [
  { label: "Grievances raised", key: "totalGrievances" },
  { label: "Resolved / closed", key: "resolvedGrievances" },
  { label: "Active categories", key: "activeCategories" },
  { label: "Sub-counties covered", key: "activeSubCounties" },
] as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await connectToDatabase();
  const data = await getPublicStats();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center text-primary-foreground sm:py-28">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <ShieldCheck className="h-3.5 w-3.5" />
            Public grievance management
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Speak up. We&apos;ll follow through.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-primary-foreground/80">
            A transparent way to raise a complaint, track its progress and see
            it through to resolution — no forms to email, no offices to visit.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-base font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
            >
              <FileText className="h-5 w-5" />
              Submit a grievance
            </Link>
            <Link
              href="/track"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20"
            >
              <Search className="h-5 w-5" />
              Track your case
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.key} className="text-center">
              <div className="text-3xl font-bold text-primary">
                {data[stat.key]}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">
            Three simple steps between a problem and its resolution.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <ClipboardList className="h-6 w-6" />,
              step: "01",
              title: "Submit",
              body: "Describe your grievance, pick your location and category, and submit it in a few minutes.",
            },
            {
              icon: <Timer className="h-6 w-6" />,
              step: "02",
              title: "Track progress",
              body: "Use your unique reference code to follow approvals, acknowledgements and updates in real time.",
            },
            {
              icon: <Landmark className="h-6 w-6" />,
              step: "03",
              title: "Resolved",
              body: "Our officers investigate, respond publicly and close the loop once your issue is resolved.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="card-hover rounded-xl border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  {item.icon}
                </div>
                <span className="text-sm font-semibold text-muted-foreground/60">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-secondary/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-14 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to raise a grievance?
            </h2>
            <p className="mt-1 text-muted-foreground">
              It only takes a minute. Your voice matters.
            </p>
          </div>
          <Link
            href="/submit"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Start now
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
