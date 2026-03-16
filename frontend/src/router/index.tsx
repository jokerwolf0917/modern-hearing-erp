import { Navigate, createBrowserRouter } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../layouts/MainLayout';
import { AIAssistant } from '../pages/AIAssistant';
import { CalendarPage } from '../pages/CalendarPage';
import { CustomerPage } from '../pages/CustomerPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EmployeePage } from '../pages/EmployeePage';
import { InventoryListPage } from '../pages/InventoryListPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderListPage } from '../pages/OrderListPage';
import { ProductPage } from '../pages/ProductPage';
import { SalesPage } from '../pages/SalesPage';
import { SNStockInPage } from '../pages/SNStockInPage';
import { SNTracePage } from '../pages/SNTracePage';
import { StorePage } from '../pages/StorePage';
import { TransferPage } from '../pages/TransferPage';

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: JSX.Element }): JSX.Element {
  const { employee } = useAuth();
  return employee?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
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
        path: 'calendar',
        element: <CalendarPage />,
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
        path: 'products',
        element: (
          <RequireAdmin>
            <ProductPage />
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
        path: 'inventory-ledger',
        element: <InventoryListPage />,
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
        path: 'transfer',
        element: <TransferPage />,
      },
      {
        path: 'sn-stock-in',
        element: <SNStockInPage />,
      },
      {
        path: 'sn-trace',
        element: <SNTracePage />,
      },
      {
        path: 'ai-assistant',
        element: <AIAssistant />,
      },
    ],
  },
]);
