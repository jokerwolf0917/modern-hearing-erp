import {
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TableOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import hearflowLogo from '../assets/brand/hearflow-logo.png';
import { useAuth } from '../contexts/AuthContext';

const { Sider, Content } = Layout;

function getSelectedKey(pathname: string): string {
  if (pathname.startsWith('/inventory') || pathname.startsWith('/transfer')) {
    return '/inventory';
  }

  const paths = [
    '/dashboard',
    '/customers',
    '/repairs',
    '/calendar',
    '/sales',
    '/orders',
    '/products',
    '/stores',
    '/employees',
    '/settings',
    '/help',
  ];

  return paths.find((item) => pathname.startsWith(item)) ?? '/dashboard';
}

function getRoleLabel(role: string | undefined, isZh: boolean): string {
  if (role === 'ADMIN') {
    return isZh ? '管理员' : 'Admin';
  }
  if (role === 'STORE_MANAGER') {
    return isZh ? '店长' : 'Store Manager';
  }
  return isZh ? '店员' : 'Staff';
}

function createMenuLabel(text: string, className = 'app-nav-item-label'): ReactNode {
  return <span className={className}>{text}</span>;
}

export function MainLayout(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { employee, logout } = useAuth();
  const { i18n } = useTranslation();
  const selectedKey = getSelectedKey(location.pathname);
  const isAdmin = employee?.role === 'ADMIN';
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    dashboard: isZh ? '工作台' : 'Dashboard',
    customerService: isZh ? '客户与服务' : 'Customers & Service',
    customers: isZh ? '客户管理' : 'Customers',
    repairs: isZh ? '维修大盘' : 'Repairs',
    calendar: isZh ? '预约日历' : 'Calendar',
    salesInventory: isZh ? '销售与库存' : 'Sales & Inventory',
    sales: isZh ? '销售开单' : 'Sales POS',
    orders: isZh ? '订单记录' : 'Orders',
    inventory: isZh ? '库存中心' : 'Inventory',
    products: isZh ? '商品管理' : 'Products',
    system: isZh ? '系统管理' : 'System',
    stores: isZh ? '门店管理' : 'Stores',
    employees: isZh ? '员工管理' : 'Employees',
    settings: isZh ? '设置中心' : 'Settings',
    help: isZh ? '帮助中心' : 'Help',
    logout: isZh ? '退出登录' : 'Logout',
  };

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: createMenuLabel(copy.dashboard),
      },
      {
        key: 'crm',
        icon: <UserOutlined />,
        label: createMenuLabel(copy.customerService, 'app-nav-group-label'),
        children: [
          {
            key: '/customers',
            icon: <UserOutlined />,
            label: createMenuLabel(copy.customers),
          },
          {
            key: '/repairs',
            icon: <ToolOutlined />,
            label: createMenuLabel(copy.repairs),
          },
          {
            key: '/calendar',
            icon: <CalendarOutlined />,
            label: createMenuLabel(copy.calendar),
          },
        ],
      },
      {
        key: 'biz',
        icon: <ShoppingCartOutlined />,
        label: createMenuLabel(copy.salesInventory, 'app-nav-group-label'),
        children: [
          {
            key: '/sales',
            icon: <ShoppingCartOutlined />,
            label: createMenuLabel(copy.sales),
          },
          {
            key: '/orders',
            icon: <TableOutlined />,
            label: createMenuLabel(copy.orders),
          },
          {
            key: '/inventory',
            icon: <DatabaseOutlined />,
            label: createMenuLabel(copy.inventory),
          },
          ...(isAdmin
            ? [
                {
                  key: '/products',
                  icon: <TableOutlined />,
                  label: createMenuLabel(copy.products),
                },
              ]
            : []),
        ],
      },
      ...(isAdmin
        ? [
            {
              key: 'system',
              icon: <ShopOutlined />,
              label: createMenuLabel(copy.system, 'app-nav-group-label'),
              children: [
                {
                  key: '/stores',
                  icon: <ShopOutlined />,
                  label: createMenuLabel(copy.stores),
                },
                {
                  key: '/employees',
                  icon: <TeamOutlined />,
                  label: createMenuLabel(copy.employees),
                },
              ],
            },
          ]
        : []),
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: createMenuLabel(copy.settings),
      },
      {
        key: '/help',
        icon: <QuestionCircleOutlined />,
        label: createMenuLabel(copy.help),
      },
    ],
    [copy.calendar, copy.customerService, copy.customers, copy.dashboard, copy.employees, copy.help, copy.inventory, copy.orders, copy.products, copy.repairs, copy.sales, copy.salesInventory, copy.settings, copy.stores, copy.system, isAdmin],
  );

  const accountMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <span>
          {employee?.username ?? '-'} · {getRoleLabel(employee?.role, isZh)}
        </span>
      ),
      disabled: true,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: copy.settings,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: copy.logout,
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb', minWidth: 0, overflowX: 'hidden' }}>
      <Sider width={210} theme="light" className="app-sider" style={{ flex: '0 0 210px', maxWidth: 210, minWidth: 210 }}>
        <div className="app-sider-shell">
          <div className="app-sider-head">
            <div className="app-brand">
              <img src={hearflowLogo} alt="HearFlow" className="app-brand-logo" />
            </div>
          </div>

          <div className="app-sider-body">
            <Menu
              mode="inline"
              className="app-sider-menu"
              selectedKeys={[selectedKey]}
              defaultOpenKeys={isAdmin ? ['crm', 'biz', 'system'] : ['crm', 'biz']}
              items={menuItems}
              style={{ borderInlineEnd: 'none', background: 'transparent' }}
              onClick={({ key }) => {
                if (String(key).startsWith('/')) {
                  navigate(String(key));
                }
              }}
            />
          </div>

          <div className="app-sider-foot">
            <Dropdown
              placement="topRight"
              trigger={['click']}
              menu={{
                items: accountMenu,
                onClick: ({ key }) => {
                  if (key === 'settings') {
                    navigate('/settings');
                    return;
                  }
                  if (key === 'logout') {
                    logout();
                    navigate('/login', { replace: true });
                  }
                },
              }}
            >
              <div className="app-sider-account">
                <Avatar size={30} icon={<UserOutlined />} />
                <div className="app-sider-account-meta">
                  <span className="app-sider-account-name">{employee?.username ?? '-'}</span>
                  <span className="app-sider-account-role">{getRoleLabel(employee?.role, isZh)}</span>
                </div>
                <DownOutlined className="app-sider-account-arrow" />
              </div>
            </Dropdown>
          </div>
        </div>
      </Sider>

      <Layout style={{ background: '#f5f7fb', minWidth: 0, overflowX: 'hidden', marginLeft: 226 }}>
        <Content style={{ padding: '12px 16px 16px', minWidth: 0, overflowX: 'hidden' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%', minWidth: 0 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
