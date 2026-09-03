import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { listGrievances } from '../services/staff.service';
import { listCategories, listSubCounties, listWards, listUsers } from '../services/admin.service';
import { useAuth } from '../contexts/auth-context';

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

const STATUSES = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
];

export default function GrievancesList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCountyId, setSubCountyId] = useState('');
  const [wardId, setWardId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [myAssigned, setMyAssigned] = useState(false);

  // Lookup data for filters
  const { data: categories } = useQuery({
    queryKey: ['filter-categories'],
    queryFn: () => listCategories({ limit: 100 }),
  });

  const { data: subCounties } = useQuery({
    queryKey: ['filter-sub-counties'],
    queryFn: () => listSubCounties({ limit: 100 }),
  });

  const { data: wards } = useQuery({
    queryKey: ['filter-wards', subCountyId],
    queryFn: () => listWards({ limit: 100, subCountyId: subCountyId || undefined }),
    enabled: !!subCountyId,
  });

  const { data: staffUsers } = useQuery({
    queryKey: ['filter-staff-users'],
    queryFn: () => listUsers({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'grievances',
      page,
      status,
      search,
      categoryId,
      subCountyId,
      wardId,
      assigneeId,
      myAssigned,
    ],
    queryFn: () =>
      listGrievances({
        page,
        limit: 10,
        status: status || undefined,
        search: search || undefined,
        categoryId: categoryId || undefined,
        subCountyId: subCountyId || undefined,
        wardId: wardId || undefined,
        assigneeId: myAssigned ? user?.id : assigneeId || undefined,
      }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setStatus('');
    setSearch('');
    setSearchInput('');
    setCategoryId('');
    setSubCountyId('');
    setWardId('');
    setAssigneeId('');
    setMyAssigned(false);
    setPage(1);
  };

  const hasActiveFilters =
    status || search || categoryId || subCountyId || wardId || assigneeId || myAssigned;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grievances</h1>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by reference code or description..."
                className="flex-1"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <Button
              variant={myAssigned ? 'default' : 'outline'}
              onClick={() => {
                setMyAssigned(!myAssigned);
                setPage(1);
              }}
              className="shrink-0"
            >
              My Assigned
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>

            <Select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories?.data?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              value={subCountyId}
              onChange={(e) => {
                setSubCountyId(e.target.value);
                setWardId('');
                setPage(1);
              }}
            >
              <option value="">All Sub-Counties</option>
              {subCounties?.data?.map((sc) => (
                <option key={sc._id} value={sc._id}>
                  {sc.name}
                </option>
              ))}
            </Select>

            <Select
              value={wardId}
              onChange={(e) => {
                setWardId(e.target.value);
                setPage(1);
              }}
              disabled={!subCountyId}
            >
              <option value="">{subCountyId ? 'All Wards' : 'Select Sub-County first'}</option>
              {wards?.data?.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
              disabled={myAssigned}
            >
              <option value="">All Assignees</option>
              {staffUsers?.data?.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {data?.pagination?.total ?? 0} Grievance(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : data?.data && data.data.length > 0 ? (
            <div className="space-y-3">
              {data.data.map((g) => (
                <Link
                  key={g._id}
                  to={`/dashboard/grievances/${g._id}`}
                  className="block border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold">{g.referenceCode}</span>
                    <Badge variant={STATUS_VARIANTS[g.status] || 'default'}>
                      {g.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm line-clamp-2 mb-2">{g.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{g.subCountyName} / {g.wardName}</span>
                    <span>{g.categoryName}</span>
                    <span>{new Date(g.submittedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No grievances found.</p>
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