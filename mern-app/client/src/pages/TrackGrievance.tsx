import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { trackGrievance, type TrackedGrievance } from '../services/public.service';
import { getErrorMessage } from '../lib/api';
import { sanitizeRichText } from '../lib/utils';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'> = {
  SUBMITTED: 'info',
  ACKNOWLEDGED: 'info',
  UNDER_REVIEW: 'warning',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'secondary',
  REJECTED: 'destructive',
};

function formatDate(date?: string): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function TrackGrievance() {
  const [referenceCode, setReferenceCode] = useState('');
  const [result, setResult] = useState<TrackedGrievance | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const data = await trackGrievance(referenceCode.trim().toUpperCase());
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Track a Grievance</CardTitle>
          <CardDescription>
            Enter your reference code (e.g. GRV-2026-XXXXXXXX) to check the status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTrack} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referenceCode">Reference Code</Label>
              <Input
                id="referenceCode"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="GRV-2026-XXXXXXXX"
                required
                className="font-mono"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Searching...' : 'Track Grievance'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-lg">{result.referenceCode}</CardTitle>
              <Badge variant={STATUS_VARIANTS[result.status] || 'default'}>
                {result.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sub-County</p>
                <p className="font-medium">{result.subCountyName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ward</p>
                <p className="font-medium">{result.wardName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{result.categoryName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">{formatDate(result.submittedAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(result.description) }}
              />
            </div>

            <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Acknowledged</p>
                <p className="font-medium">{formatDate(result.acknowledgedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Resolved</p>
                <p className="font-medium">{formatDate(result.resolvedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Closed</p>
                <p className="font-medium">{formatDate(result.closedAt)}</p>
              </div>
            </div>

            {result.updates && result.updates.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Updates</p>
                <div className="space-y-3">
                  {result.updates.map((u) => (
                    <div key={u._id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{u.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{u.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
