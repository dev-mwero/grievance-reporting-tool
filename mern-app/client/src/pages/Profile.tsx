import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getProfile, updateProfile } from '../services/auth.service';
import { getErrorMessage } from '../lib/api';
import { validateRequired, validateMaxLength } from '../lib/validation';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

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
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    title?: string;
    department?: string;
  }>({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      setFormSuccess(true);
      setIsEditing(false);
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const startEditing = () => {
    if (!profile) return;
    setName(profile.name || '');
    setPhone(profile.phone || '');
    setTitle(profile.title || '');
    setDepartment(profile.department || '');
    setFormError('');
    setFormSuccess(false);
    setFieldErrors({});
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    const nameError = validateRequired(name, 'Name');
    const phoneError = validateMaxLength(phone, 20, 'Phone');
    const titleError = validateMaxLength(title, 200, 'Title');
    const departmentError = validateMaxLength(department, 200, 'Department');
    setFieldErrors({ name: nameError, phone: phoneError, title: titleError, department: departmentError });
    if (nameError || phoneError || titleError || departmentError) return;

    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      department: department.trim() || undefined,
    });
  };

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
        <div className="flex items-center gap-3">
          <Badge variant={ROLE_VARIANTS[profile.role] || 'default'}>
            {profile.role.replace(/_/g, ' ')}
          </Badge>
          {!isEditing && (
            <Button variant="outline" type="button" onClick={startEditing}>
              Edit Details
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Details</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((f) => ({ ...f, name: undefined }));
                  }}
                  maxLength={200}
                  required
                />
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((f) => ({ ...f, phone: undefined }));
                  }}
                  maxLength={20}
                  placeholder="e.g. +254712345678"
                />
                {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFieldErrors((f) => ({ ...f, title: undefined }));
                    }}
                    maxLength={200}
                    placeholder="e.g. Manager"
                  />
                  {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setFieldErrors((f) => ({ ...f, department: undefined }));
                    }}
                    maxLength={200}
                    placeholder="e.g. Operations"
                  />
                  {fieldErrors.department && (
                    <p className="text-xs text-destructive">{fieldErrors.department}</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Email and role cannot be changed here.
              </p>

              {formError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-md bg-green-100 text-green-800 text-sm">
                  Profile updated successfully.
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setIsEditing(false);
                    setFormError('');
                    setFormSuccess(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
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
      )}

      <div className="flex gap-4">
        <Link to="/dashboard/change-password">
          <Button>Change Password</Button>
        </Link>
      </div>
    </div>
  );
}