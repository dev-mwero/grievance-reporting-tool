import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { listGrievances } from '../services/staff.service';

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
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['grievances', page, status, search],
    queryFn: () =>
      listGrievances({
        page,
        limit: 10,
        status: status || undefined,
        search: search || undefined,
      }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grievances</h1>
      </div>

      <div className="flex gap-4">
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
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </div>

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
