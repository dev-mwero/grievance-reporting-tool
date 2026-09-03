import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  listUsers,
  createUser,
  deactivateUser,
  type CreateUserInput,
} from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import LoadingState from '../../components/LoadingState';
import type { Role } from 'shared';

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF'] as Role[];

export default function UsersManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  // Create form state
  const [form, setForm] = useState<CreateUserInput>({
    name: '',
    email: '',
    role: 'STAFF' as Role,
    title: '',
    department: '',
    password: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter],
    queryFn: () =>
      listUsers({
        page,
        limit: 10,
        search: search || undefined,
        role: roleFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => createUser(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setForm({ name: '', email: '', role: 'STAFF' as Role, title: '', department: '', password: '' });
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage system users and roles</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create User'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create User</CardTitle>
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
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    placeholder="Min 8 chars, upper+lower+number"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email..."
          className="flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-48"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState label="Loading..." />
          ) : data?.data && data.data.length > 0 ? (
            <div className="space-y-3">
              {data.data.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      {!user.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.title || 'No title'} {user.department ? `· ${user.department}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                      {user.role.replace(/_/g, ' ')}
                    </Badge>
                    {user.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deactivateMutation.mutate(user._id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No users found.</p>
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
