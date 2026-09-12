import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getDashboardStats } from '../services/staff.service';
import { getErrorMessage } from '../lib/api';
import { ClipboardList, FolderOpen, ArrowRight } from 'lucide-react';

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

export default function DashboardOverview() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  if (isLoading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A snapshot of your grievance workload
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Assigned Grievances
            </CardTitle>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="w-5 h-5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.myAssigned ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Open Grievances
            </CardTitle>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20 text-accent-foreground">
              <FolderOpen className="w-5 h-5" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.totalOpen ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div key={activity._id} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{activity.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.grievanceId?.referenceCode ?? 'Unknown'} &middot;{' '}
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {activity.grievanceId && (
                    <Badge variant={STATUS_VARIANTS[activity.grievanceId.status] || 'default'}>
                      {activity.grievanceId.status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Link
          to="/dashboard/grievances"
          className="inline-flex items-center gap-2 justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          View All Grievances
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}