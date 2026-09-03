import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Analytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <Card>
        <CardHeader>
          <CardTitle>Reporting</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Analytics and reporting features are being implemented.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
