import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Grievance Management System</h1>
        <p className="text-lg text-muted-foreground">
          Report issues in your community anonymously and track their resolution.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Submit a Grievance</CardTitle>
            <CardDescription>
              Report an issue anonymously. You will receive a reference code to track progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/submit">
              <Button className="w-full">Submit Grievance</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Track a Grievance</CardTitle>
            <CardDescription>
              Check the status of your grievance using your reference code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/track">
              <Button variant="outline" className="w-full">
                Track Grievance
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
