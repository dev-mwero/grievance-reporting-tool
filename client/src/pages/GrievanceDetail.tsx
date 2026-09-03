import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  getGrievance,
  updateGrievanceStatus,
  addGrievanceUpdate,
} from '../services/staff.service';
import { getErrorMessage } from '../lib/api';

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

export default function GrievanceDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updateType, setUpdateType] = useState<'PUBLIC_UPDATE' | 'INTERNAL_NOTE'>('PUBLIC_UPDATE');
  const [updateContent, setUpdateContent] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['grievance', id],
    queryFn: () => getGrievance(id!),
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

  if (isLoading) {
    return <div className="text-center py-12">Loading grievance...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Grievance not found.</div>;
  }

  const { grievance, updates, assignments } = data;
  const allowedTransitions = STATUS_TRANSITIONS[grievance.status] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{grievance.referenceCode}</h1>
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
              <p className="text-muted-foreground">Sub-County</p>
              <p className="font-medium">{grievance.subCountyName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ward</p>
              <p className="font-medium">{grievance.wardName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium">{grievance.categoryName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Primary Assignee</p>
              <p className="font-medium">
                {typeof grievance.primaryAssigneeId === 'object'
                  ? grievance.primaryAssigneeId?.name
                  : 'Unassigned'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{grievance.description}</p>
          </div>
        </CardContent>
      </Card>

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
