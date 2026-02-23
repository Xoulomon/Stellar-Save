import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import ProtectedRoute from '../components/ProtectedRoute';

// Lazy load pages for better performance
import Home from '../pages/Home';
import Dashboard from '../pages/Dashboard';
import Groups from '../pages/Groups';
import GroupDetail from '../pages/GroupDetail';
import CreateGroup from '../pages/CreateGroup';
import NotFound from '../pages/NotFound';

const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <Home />,
  },
  {
    path: ROUTES.DASHBOARD,
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.GROUPS,
    element: (
      <ProtectedRoute>
        <Groups />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.GROUP_DETAIL,
    element: (
      <ProtectedRoute>
        <GroupDetail />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.CREATE_GROUP,
    element: (
      <ProtectedRoute>
        <CreateGroup />
      </ProtectedRoute>
    ),
  },
  {
    path: ROUTES.NOT_FOUND,
    element: <NotFound />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
