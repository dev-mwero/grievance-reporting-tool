import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  type CreateInvitationInput,
} from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import LoadingState from '../../components/LoadingState';
import type { Role } from 'shared';

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF'] as Role[];

export default function InvitationsManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateInvitationInput>({
    email: '',
    name: '',
    role: 'STAFF' as Role,
    title: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invitations', page, statusFilter],
    queryFn: () =>
      listInvitations({
        page,
        limit: 10,
        status: statusFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => createInvitation(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      setShowCreate(false);
      setForm({ email: '', name: '', role: 'STAFF' as Role, title: '' });
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-invitations'] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-invitations'] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  const getStatus = (inv: { acceptedAt?: string; expiresAt: string }) => {
    if (inv.acceptedAt) return { label: 'Accepted', variant: 'success' as const };
    if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', variant: 'destructive' as const };
    return { label: 'Pending', variant: 'warning' as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Invitations</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Send Invitation'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Send Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
        className="w-48"
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="accepted">Accepted</option>
        <option value="expired">Expired</option>
      </Select>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState label="Loading..." />
          ) : data?.data && data.data.length > 0 ? (
            <div className="space-y-3">
              {data.data.map((inv) => {
                const status = getStatus(inv);
                return (
                  <div
                    key={inv._id}
                    className="flex items-center justify-between border rounded-lg p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{inv.name}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.role.replace(/_/g, ' ')}
                        {inv.title ? ` · ${inv.title}` : ''}
                        {inv.invitedBy ? ` · invited by ${inv.invitedBy.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status.label === 'Pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendMutation.mutate(inv._id)}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeMutation.mutate(inv._id)}
                          >
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No invitations found.</p>
          )}

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
