import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import RichTextEditor from '../components/RichTextEditor';
import { getSubCounties, getWards, getCategories, submitGrievance } from '../services/public.service';
import { getErrorMessage } from '../lib/api';
import { validateRequired, validateMinLength } from '../lib/validation';
import { Upload, X, FileText, Paperclip } from 'lucide-react';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitGrievance() {
  const [subCountyId, setSubCountyId] = useState('');
  const [wardId, setWardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    subCountyId?: string;
    wardId?: string;
    categoryId?: string;
    description?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ referenceCode: string; attachmentCount?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const selected = Array.from(e.target.files ?? []);

    // Check max file count
    if (files.length + selected.length > MAX_FILES) {
      setFileError(`You can upload a maximum of ${MAX_FILES} files.`);
      e.target.value = '';
      return;
    }

    // Validate each file
    for (const file of selected) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError(`File "${file.name}" has an unsupported type. Allowed: images, PDF, DOC, DOCX, TXT.`);
        e.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" exceeds the 10MB size limit.`);
        e.target.value = '';
        return;
      }
    }

    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const subCountyError = validateRequired(subCountyId, 'Sub-County');
    const wardError = validateRequired(wardId, 'Ward');
    const categoryError = validateRequired(categoryId, 'Category');
    // Strip HTML tags for length validation
    const plainText = description.replace(/<[^>]*>/g, '').trim();
    const descriptionError = validateMinLength(plainText, 10, 'Description');
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
        files: files.length > 0 ? files : undefined,
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
            {result.attachmentCount && result.attachmentCount > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {result.attachmentCount} attachment{result.attachmentCount > 1 ? 's' : ''} uploaded successfully.
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResult(null);
                setSubCountyId('');
                setWardId('');
                setCategoryId('');
                setDescription('');
                setFiles([]);
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
              <RichTextEditor
                value={description}
                onChange={(html) => {
                  setDescription(html);
                  setFieldErrors((f) => ({ ...f, description: undefined }));
                }}
                placeholder="Describe the issue in detail..."
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">{fieldErrors.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Supports basic formatting: bold, italic, lists, links, headings.
              </p>
            </div>

            {/* File attachments */}
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="attachment-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= MAX_FILES}
                >
                  <Paperclip className="w-4 h-4" />
                  Add Files ({files.length}/{MAX_FILES})
                </Button>
                <span className="text-xs text-muted-foreground">
                  Images, PDF, DOC, DOCX, TXT. Max 10MB each.
                </span>
              </div>

              {fileError && (
                <p className="text-xs text-destructive">{fileError}</p>
              )}

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-3 p-2.5 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Submit Grievance
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}