import { Navigate, createBrowserRouter } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../layouts/MainLayout';
import { CalendarPage } from '../pages/CalendarPage';
import { CustomerPage } from '../pages/CustomerPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EmployeePage } from '../pages/EmployeePage';
import { HelpPage } from '../pages/HelpPage';
import { InventoryListPage } from '../pages/InventoryListPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderListPage } from '../pages/OrderListPage';
import { ProductPage } from '../pages/ProductPage';
import { RepairDashboard } from '../pages/RepairDashboard';
import { SalesPage } from '../pages/SalesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StorePage } from '../pages/StorePage';

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: JSX.Element }): JSX.Element {
  const { employee } = useAuth();
  return employee?.role === 'ADMIN' ? children : <Navigate to="/dashboard" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'customers',
        element: <CustomerPage />,
      },
      {
        path: 'repairs',
        element: <RepairDashboard />,
      },
      {
        path: 'calendar',
        element: <CalendarPage />,
      },
      {
        path: 'sales',
        element: <SalesPage />,
      },
      {
        path: 'orders',
        element: <OrderListPage />,
      },
      {
        path: 'inventory',
        element: <InventoryListPage />,
      },
      {
        path: 'transfer',
        element: <Navigate to="/inventory" replace />,
      },
      {
        path: 'products',
        element: (
          <RequireAdmin>
            <ProductPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'stores',
        element: (
          <RequireAdmin>
            <StorePage />
          </RequireAdmin>
        ),
      },
      {
        path: 'employees',
        element: (
          <RequireAdmin>
            <EmployeePage />
          </RequireAdmin>
        ),
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'help',
        element: <HelpPage />,
      },
    ],
  },
]);
