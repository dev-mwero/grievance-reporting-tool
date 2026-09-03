import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  listWards,
  createWard,
  updateWard,
  deactivateWard,
  listSubCounties,
} from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';

export default function WardsManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [subCountyFilter, setSubCountyFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '', subCountyId: '' });
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    code: string;
    subCountyId: string;
  } | null>(null);

  const { data: subCounties } = useQuery({
    queryKey: ['admin-sub-counties-all'],
    queryFn: () => listSubCounties({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-wards', page, search, subCountyFilter],
    queryFn: () =>
      listWards({
        page,
        limit: 10,
        search: search || undefined,
        subCountyId: subCountyFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => createWard(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wards'] });
      setShowCreate(false);
      setForm({ name: '', code: '', subCountyId: '' });
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWard(editing!.id, {
        name: editing!.name,
        code: editing!.code,
        subCountyId: editing!.subCountyId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wards'] });
      setEditing(null);
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateWard(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-wards'] }),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    updateMutation.mutate();
  };

  const getSubCountyName = (id: string | { _id: string; name: string }) => {
    if (typeof id === 'object') return id.name;
    const sc = subCounties?.data?.find((s) => s._id === id);
    return sc?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Wards</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Create Ward'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Ward</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                    placeholder="e.g. DTN"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sub-County</Label>
                  <Select
                    value={form.subCountyId}
                    onChange={(e) => setForm({ ...form, subCountyId: e.target.value })}
                    required
                  >
                    <option value="">Select sub-county</option>
                    {subCounties?.data?.map((sc) => (
                      <option key={sc._id} value={sc._id}>
                        {sc.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Ward'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit Ward</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sub-County</Label>
                  <Select
                    value={editing.subCountyId}
                    onChange={(e) => setEditing({ ...editing, subCountyId: e.target.value })}
                    required
                  >
                    {subCounties?.data?.map((sc) => (
                      <option key={sc._id} value={sc._id}>
                        {sc.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search wards..."
          className="flex-1"
        />
        <Select
          value={subCountyFilter}
          onChange={(e) => {
            setSubCountyFilter(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">All Sub-Counties</option>
          {subCounties?.data?.map((sc) => (
            <option key={sc._id} value={sc._id}>
              {sc.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : data?.data && data.data.length > 0 ? (
            <div className="space-y-3">
              {data.data.map((ward) => (
                <div
                  key={ward._id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{ward.name}</p>
                      {!ward.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-mono">{ward.code}</span> ·{' '}
                      {getSubCountyName(ward.subCountyId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: ward._id,
                          name: ward.name,
                          code: ward.code,
                          subCountyId:
                            typeof ward.subCountyId === 'object'
                              ? ward.subCountyId._id
                              : ward.subCountyId,
                        })
                      }
                    >
                      Edit
                    </Button>
                    {ward.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deactivateMutation.mutate(ward._id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No wards found.</p>
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
