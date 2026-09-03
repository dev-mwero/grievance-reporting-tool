import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { getProfile } from '../services/auth.service';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getErrorMessage } from '../lib/api';

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'> = {
  SUPER_ADMIN: 'destructive',
  ADMIN: 'warning',
  STAFF: 'info',
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

export default function Profile() {
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  if (isLoading) {
    return <LoadingState label="Loading profile..." />;
  }

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />;
  }

  if (!profile) {
    return <ErrorState message="Profile not found." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Your account details and information</p>
        </div>
        <Badge variant={ROLE_VARIANTS[profile.role] || 'default'}>
          {profile.role.replace(/_/g, ' ')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile.name}</CardTitle>
          <CardDescription>{profile.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Title</p>
              <p className="font-medium text-foreground">{profile.title || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Department</p>
              <p className="font-medium text-foreground">{profile.department || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Phone</p>
              <p className="font-medium text-foreground">{profile.phone || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Status</p>
              <p className="font-medium text-foreground">
                {profile.isActive ? (
                  <span className="text-green-700">Active</span>
                ) : (
                  <span className="text-red-700">Inactive</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Last Login</p>
              <p className="font-medium text-foreground">{formatDate(profile.lastLoginAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Member Since</p>
              <p className="font-medium text-foreground">{formatDate(profile.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Link to="/dashboard/change-password">
          <Button>Change Password</Button>
        </Link>
      </div>
    </div>
  );
}