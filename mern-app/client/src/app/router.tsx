import { createBrowserRouter } from 'react-router';
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import Home from '../pages/Home';
import SubmitGrievance from '../pages/SubmitGrievance';
import TrackGrievance from '../pages/TrackGrievance';
import Login from '../pages/Login';
import AcceptInvitation from '../pages/AcceptInvitation';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import ChangePassword from '../pages/ChangePassword';
import Profile from '../pages/Profile';
import DashboardOverview from '../pages/DashboardOverview';
import GrievancesList from '../pages/GrievancesList';
import GrievanceDetail from '../pages/GrievanceDetail';
import Analytics from '../pages/Analytics';
import Admin from '../pages/Admin';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'submit', element: <SubmitGrievance /> },
      { path: 'track', element: <TrackGrievance /> },
    ],
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/reset-password',
    element: <ResetPassword />,
  },
  {
    path: '/accept-invitation',
    element: <AcceptInvitation />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardOverview /> },
      { path: 'profile', element: <Profile /> },
      { path: 'grievances', element: <GrievancesList /> },
      { path: 'grievances/:id', element: <GrievanceDetail /> },
      { path: 'change-password', element: <ChangePassword /> },
      {
        path: 'analytics',
        element: (
          <ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN']}>
            <Analytics />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN']}>
            <Admin />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
