import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  getGrievance,
  updateGrievanceStatus,
  addGrievanceUpdate,
  assignGrievance,
  listAttachments,
  uploadAttachment,
  deleteAttachment,
} from '../services/staff.service';
import { listUsers } from '../services/admin.service';
import { getErrorMessage } from '../lib/api';
import { sanitizeRichText } from '../lib/utils';
import { useAuth } from '../contexts/auth-context';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['ACKNOWLEDGED', 'REJECTED'],
  ACKNOWLEDGED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ASSIGNED', 'REJECTED', 'RESOLVED'],
  ASSIGNED: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  REJECTED: [],
};

function formatDate(date?: string): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GrievanceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updateType, setUpdateType] = useState<'PUBLIC_UPDATE' | 'INTERNAL_NOTE'>('PUBLIC_UPDATE');
  const [updateContent, setUpdateContent] = useState('');
  const [error, setError] = useState('');

  // Assignment state
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState('');
  const [supportingAssigneeIds, setSupportingAssigneeIds] = useState<string[]>([]);

  // Attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['grievance', id],
    queryFn: () => getGrievance(id!),
    enabled: !!id,
  });

  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => listUsers({ limit: 100, isActive: 'true' }),
  });

  const { data: attachments } = useQuery({
    queryKey: ['grievance-attachments', id],
    queryFn: () => listAttachments(id!, { limit: 50 }),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: () => updateGrievanceStatus(id!, newStatus, statusNote || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievance', id] });
      setNewStatus('');
      setStatusNote('');
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => addGrievanceUpdate(id!, updateType, updateContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievance', id] });
      setUpdateContent('');
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignGrievance(id!, {
        primaryAssigneeId,
        supportingAssigneeIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievance', id] });
      setPrimaryAssigneeId('');
      setSupportingAssigneeIds([]);
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: () => uploadAttachment(id!, selectedFile!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievance-attachments', id] });
      setSelectedFile(null);
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(id!, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievance-attachments', id] });
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (isLoading) {
    return <LoadingState label="Loading grievance..." />;
  }

  if (isError) {
    return <ErrorState message={getErrorMessage(queryError)} onRetry={() => refetch()} />;
  }

  if (!data) {
    return <ErrorState message="Grievance not found." />;
  }

  const { grievance, updates, assignments } = data;
  const allowedTransitions = STATUS_TRANSITIONS[grievance.status] || [];
  const staffList = staffUsers?.data ?? [];
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const toggleSupporting = (userId: string) => {
    setSupportingAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-primary truncate">{grievance.referenceCode}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted {formatDate(grievance.submittedAt)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[grievance.status] || 'default'} className="text-sm px-3 py-1">
          {grievance.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Sub-County</p>
              <p className="font-medium text-foreground">{grievance.subCountyName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Ward</p>
              <p className="font-medium text-foreground">{grievance.wardName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Category</p>
              <p className="font-medium text-foreground">{grievance.categoryName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Primary Assignee</p>
              <p className="font-medium text-foreground">
                {typeof grievance.primaryAssigneeId === 'object'
                  ? grievance.primaryAssigneeId?.name
                  : 'Unassigned'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(grievance.description) }}
            />
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
              <CardDescription>Move the grievance through its lifecycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label>New Status</Label>
                  <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="">Select status...</option>
                    {allowedTransitions.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  onClick={() => statusMutation.mutate()}
                  disabled={!newStatus || statusMutation.isPending}
                >
                  {statusMutation.isPending ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Status Note (optional)</Label>
                <Textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Add a note about this status change..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign Staff</CardTitle>
              <CardDescription>Assign a primary and supporting staff to this grievance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Assignee</Label>
                <Select
                  value={primaryAssigneeId}
                  onChange={(e) => setPrimaryAssigneeId(e.target.value)}
                >
                  <option value="">Select primary assignee...</option>
                  {staffList.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supporting Assignees</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {staffList.length > 0 ? (
                    staffList.map((u) => (
                      <label
                        key={u._id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={supportingAssigneeIds.includes(u._id)}
                          onChange={() => toggleSupporting(u._id)}
                          disabled={u._id === primaryAssigneeId}
                        />
                        <span>
                          {u.name} ({u.email})
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No staff available.</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!primaryAssigneeId || assignMutation.isPending}
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign Staff'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
            <CardDescription>Current assignment for this grievance</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a._id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium truncate">{a.assigneeName}</span>
                      {a.isPrimary && (
                        <Badge variant="info">Primary</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet assigned.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Update</CardTitle>
          <CardDescription>Add a public update or internal note</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Update Type</Label>
            <Select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value as 'PUBLIC_UPDATE' | 'INTERNAL_NOTE')}
            >
              <option value="PUBLIC_UPDATE">Public Update (visible to citizen)</option>
              <option value="INTERNAL_NOTE">Internal Note (staff only)</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={updateContent}
              onChange={(e) => setUpdateContent(e.target.value)}
              placeholder="Write your update..."
              rows={3}
            />
          </div>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!updateContent || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Adding...' : 'Add Update'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription>Upload and manage files for this grievance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label>Upload File</Label>
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          )}

          {attachments?.data && attachments.data.length > 0 ? (
            <div className="space-y-2">
              {attachments.data.map((att) => (
                <div
                  key={att._id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium truncate">{att.originalName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatBytes(att.size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {att.url && (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </a>
                    )}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAttachmentMutation.mutate(att._id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attachments yet.</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {updates.length > 0 ? (
              <div className="space-y-3">
                {updates.map((u) => (
                  <div key={u._id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={u.type === 'PUBLIC_UPDATE' ? 'info' : 'secondary'}>
                        {u.type === 'PUBLIC_UPDATE' ? 'Public' : 'Internal'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {u.authorName} &middot; {formatDate(u.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{u.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div key={a._id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{a.assigneeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.assignedAt)}
                      </p>
                    </div>
                    {a.isPrimary && <Badge>Primary</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}