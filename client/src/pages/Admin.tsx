import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Admin() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Administrative configuration features are being implemented.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
