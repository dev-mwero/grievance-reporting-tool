import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { getSubCounties, getWards, getCategories, submitGrievance } from '../services/public.service';
import { getErrorMessage } from '../lib/api';

export default function SubmitGrievance() {
  const [subCountyId, setSubCountyId] = useState('');
  const [wardId, setWardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ referenceCode: string } | null>(null);

  const { data: subCounties = [] } = useQuery({
    queryKey: ['sub-counties'],
    queryFn: getSubCounties,
  });

  const { data: wards = [] } = useQuery({
    queryKey: ['wards', subCountyId],
    queryFn: () => getWards(subCountyId),
    enabled: !!subCountyId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // Reset ward when sub-county changes
  useEffect(() => {
    setWardId('');
  }, [subCountyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await submitGrievance({
        subCountyId,
        wardId,
        categoryId,
        description,
      });
      setResult(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Grievance Submitted Successfully</CardTitle>
            <CardDescription>
              Your grievance has been received. Save your reference code to track its progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-center">
              <p className="text-sm text-muted-foreground mb-1">Your Reference Code</p>
              <p className="text-2xl font-mono font-bold">{result.referenceCode}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResult(null);
                setSubCountyId('');
                setWardId('');
                setCategoryId('');
                setDescription('');
              }}
            >
              Submit Another Grievance
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Submit a Grievance</CardTitle>
          <CardDescription>
            Provide details about your issue. Your identity remains anonymous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subCounty">Sub-County</Label>
              <Select
                id="subCounty"
                value={subCountyId}
                onChange={(e) => setSubCountyId(e.target.value)}
                required
              >
                <option value="">Select sub-county</option>
                {subCounties.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ward">Ward</Label>
              <Select
                id="ward"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                required
                disabled={!subCountyId}
              >
                <option value="">{subCountyId ? 'Select ward' : 'Select sub-county first'}</option>
                {wards.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                required
                minLength={10}
                maxLength={10000}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/10000 characters
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Grievance'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
