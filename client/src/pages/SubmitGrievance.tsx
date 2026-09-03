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
import { validateRequired, validateMinLength } from '../lib/validation';

export default function SubmitGrievance() {
  const [subCountyId, setSubCountyId] = useState('');
  const [wardId, setWardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    subCountyId?: string;
    wardId?: string;
    categoryId?: string;
    description?: string;
  }>({});
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

    // Client-side validation
    const subCountyError = validateRequired(subCountyId, 'Sub-County');
    const wardError = validateRequired(wardId, 'Ward');
    const categoryError = validateRequired(categoryId, 'Category');
    const descriptionError = validateMinLength(description, 10, 'Description');
    setFieldErrors({
      subCountyId: subCountyError,
      wardId: wardError,
      categoryId: categoryError,
      description: descriptionError,
    });
    if (subCountyError || wardError || categoryError || descriptionError) return;

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
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Your Reference Code</p>
              <p className="text-2xl font-mono font-bold text-primary">{result.referenceCode}</p>
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
                onChange={(e) => {
                  setSubCountyId(e.target.value);
                  setFieldErrors((f) => ({ ...f, subCountyId: undefined }));
                }}
                required
              >
                <option value="">Select sub-county</option>
                {subCounties.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.name}
                  </option>
                ))}
              </Select>
              {fieldErrors.subCountyId && (
                <p className="text-xs text-destructive">{fieldErrors.subCountyId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ward">Ward</Label>
              <Select
                id="ward"
                value={wardId}
                onChange={(e) => {
                  setWardId(e.target.value);
                  setFieldErrors((f) => ({ ...f, wardId: undefined }));
                }}
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
              {fieldErrors.wardId && (
                <p className="text-xs text-destructive">{fieldErrors.wardId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setFieldErrors((f) => ({ ...f, categoryId: undefined }));
                }}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {fieldErrors.categoryId && (
                <p className="text-xs text-destructive">{fieldErrors.categoryId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setFieldErrors((f) => ({ ...f, description: undefined }));
                }}
                placeholder="Describe the issue in detail..."
                required
                minLength={10}
                maxLength={10000}
                rows={6}
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">{fieldErrors.description}</p>
              )}
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
