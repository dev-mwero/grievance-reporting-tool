import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  getAnalyticsOverview,
  getStatusDistribution,
  getCategoryBreakdown,
  getSubCountyBreakdown,
  getTrend,
  getAuditLogs,
} from '../services/analytics.service';

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

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-500',
  ACKNOWLEDGED: 'bg-sky-500',
  UNDER_REVIEW: 'bg-yellow-500',
  ASSIGNED: 'bg-amber-500',
  IN_PROGRESS: 'bg-orange-500',
  RESOLVED: 'bg-green-500',
  CLOSED: 'bg-gray-400',
  REJECTED: 'bg-red-500',
};

type Tab = 'overview' | 'trend' | 'audit';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('month');
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditEntityType, setAuditEntityType] = useState('');

  const dateParams = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', dateFrom, dateTo],
    queryFn: () => getAnalyticsOverview(dateParams),
  });

  const statusQuery = useQuery({
    queryKey: ['analytics-status', dateFrom, dateTo],
    queryFn: () => getStatusDistribution(dateParams),
  });

  const categoryQuery = useQuery({
    queryKey: ['analytics-category', dateFrom, dateTo],
    queryFn: () => getCategoryBreakdown(dateParams),
  });

  const subCountyQuery = useQuery({
    queryKey: ['analytics-subcounty', dateFrom, dateTo],
    queryFn: () => getSubCountyBreakdown(dateParams),
  });

  const trendQuery = useQuery({
    queryKey: ['analytics-trend', dateFrom, dateTo, groupBy],
    queryFn: () => getTrend({ ...dateParams, groupBy }),
  });

  const auditQuery = useQuery({
    queryKey: ['analytics-audit', auditPage, auditAction, auditEntityType, dateFrom, dateTo],
    queryFn: () =>
      getAuditLogs({
        page: auditPage,
        limit: 15,
        action: auditAction || undefined,
        entityType: auditEntityType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const overview = overviewQuery.data;
  const statusDist = statusQuery.data;
  const categoryBreakdown = categoryQuery.data;
  const subCountyBreakdown = subCountyQuery.data;
  const trend = trendQuery.data;
  const audit = auditQuery.data;

  const maxStatusCount = statusDist
    ? Math.max(...Object.values(statusDist.distribution), 1)
    : 1;
  const maxCategoryCount = categoryBreakdown
    ? Math.max(...categoryBreakdown.breakdown.map((b) => b.count), 1)
    : 1;
  const maxSubCountyCount = subCountyBreakdown
    ? Math.max(...subCountyBreakdown.breakdown.map((b) => b.count), 1)
    : 1;
  const maxTrendCount = trend ? Math.max(...trend.trend.map((t) => t.count), 1) : 1;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'trend', label: 'Trend' },
    { id: 'audit', label: 'Audit Logs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics &amp; Reporting</h1>
      </div>

      {/* Date range filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear Dates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Overview stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Grievances" value={overview?.grievances.total} loading={overviewQuery.isLoading} />
            <StatCard label="Open" value={overview?.grievances.open} loading={overviewQuery.isLoading} />
            <StatCard label="Resolved" value={overview?.grievances.resolved} loading={overviewQuery.isLoading} />
            <StatCard label="Closed" value={overview?.grievances.closed} loading={overviewQuery.isLoading} />
            <StatCard label="Rejected" value={overview?.grievances.rejected} loading={overviewQuery.isLoading} />
            <StatCard
              label="Avg Resolution (days)"
              value={overview?.grievances.avgResolutionDays ?? '—'}
              loading={overviewQuery.isLoading}
            />
            <StatCard label="Active Users" value={overview?.users.active} loading={overviewQuery.isLoading} />
            <StatCard label="Categories" value={overview?.configuration.categories} loading={overviewQuery.isLoading} />
          </div>

          {/* Status distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {statusQuery.isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Loading...</p>
              ) : statusDist ? (
                <div className="space-y-3">
                  {Object.entries(statusDist.distribution).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-40 shrink-0">
                        <Badge variant={STATUS_VARIANTS[status] || 'default'}>
                          {status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${STATUS_COLORS[status] || 'bg-primary'} transition-all`}
                          style={{ width: `${(count / maxStatusCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No data.</p>
              )}
            </CardContent>
          </Card>

          {/* Category and sub-county breakdowns */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryQuery.isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : categoryBreakdown && categoryBreakdown.breakdown.length > 0 ? (
                  <div className="space-y-3">
                    {categoryBreakdown.breakdown.map((item) => (
                      <div key={item._id ?? 'none'} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 truncate text-sm">
                          {item.categoryName || 'Unknown'}
                        </div>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(item.count / maxCategoryCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No data.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Sub-County</CardTitle>
              </CardHeader>
              <CardContent>
                {subCountyQuery.isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : subCountyBreakdown && subCountyBreakdown.breakdown.length > 0 ? (
                  <div className="space-y-3">
                    {subCountyBreakdown.breakdown.map((item) => (
                      <div key={item._id ?? 'none'} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 truncate text-sm">
                          {item.subCountyName || 'Unknown'}
                        </div>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(item.count / maxSubCountyCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No data.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'trend' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Grievance Trend</CardTitle>
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                className="w-40"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {trendQuery.isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : trend && trend.trend.length > 0 ? (
              <div className="space-y-2">
                {trend.trend.map((point) => (
                  <div key={point.period} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-xs font-mono text-muted-foreground">
                      {point.period}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden flex">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(point.count / maxTrendCount) * 100}%` }}
                        title={`${point.count} total`}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-medium">{point.count}</span>
                  </div>
                ))}
                <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-primary rounded" /> Total
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded" /> Resolved
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-gray-400 rounded" /> Closed
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No trend data.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-4">
              <Select
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value);
                  setAuditPage(1);
                }}
                className="w-48"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="STATUS_CHANGE">Status Change</option>
                <option value="ASSIGN">Assign</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </Select>
              <Select
                value={auditEntityType}
                onChange={(e) => {
                  setAuditEntityType(e.target.value);
                  setAuditPage(1);
                }}
                className="w-48"
              >
                <option value="">All Entities</option>
                <option value="Grievance">Grievance</option>
                <option value="User">User</option>
                <option value="Category">Category</option>
                <option value="SubCounty">Sub-County</option>
                <option value="Ward">Ward</option>
                <option value="Invitation">Invitation</option>
              </Select>
            </div>

            {auditQuery.isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : audit && audit.data && audit.data.length > 0 ? (
              <div className="space-y-3">
                {audit.data.map((log) => (
                  <div key={log._id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[log.action] || 'default'}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-sm font-medium">{log.entityType}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.actorName || log.actorType || 'System'} · {log.entityId}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="mt-2 text-xs bg-muted rounded p-2 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No audit logs found.</p>
            )}

            {audit?.pagination && audit.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {audit.pagination.page} of {audit.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage >= audit.pagination.totalPages}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | string | null | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">{loading ? '—' : (value ?? 0)}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
