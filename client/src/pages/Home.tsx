import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, Search, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/10 text-primary-foreground text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4" />
            Community Grievance System
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-3xl mx-auto">
            Report issues in your community. Track them to resolution.
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            Submit a grievance anonymously and follow its progress with a simple reference code.
            Your voice drives real change.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/submit">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <FileText className="w-4 h-4" />
                Submit a Grievance
              </Button>
            </Link>
            <Link to="/track">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10"
              >
                <Search className="w-4 h-4" />
                Track a Grievance
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <FileText className="w-5 h-5" />
                <CardTitle>Submit a Grievance</CardTitle>
              </div>
              <CardDescription>
                Report an issue anonymously. You will receive a reference code to track progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/submit">
                <Button className="w-full">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Search className="w-5 h-5" />
                <CardTitle>Track a Grievance</CardTitle>
              </div>
              <CardDescription>
                Check the status of your grievance using your reference code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/track">
                <Button variant="outline" className="w-full">
                  Track Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}