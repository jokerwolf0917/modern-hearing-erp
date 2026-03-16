import {
  AppstoreOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LogoutOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const { Content, Header, Sider } = Layout;
const { Text, Title } = Typography;

type MenuLeafKey =
  | '/dashboard'
  | '/sales'
  | '/orders'
  | '/customers'
  | '/calendar'
  | '/ai-assistant'
  | '/inventory-ledger'
  | '/products'
  | '/sn-stock-in'
  | '/transfer'
  | '/sn-trace'
  | '/stores'
  | '/employees';

type MenuGroupKey = 'sales-crm' | 'inventory-product' | 'system-settings';

interface RouteMeta {
  titleKey: string;
  subtitleKey: string;
}

const routeMetaMap: Record<MenuLeafKey, RouteMeta> = {
  '/dashboard': {
    titleKey: 'route.dashboard.title',
    subtitleKey: 'route.dashboard.subtitle',
  },
  '/sales': {
    titleKey: 'route.sales.title',
    subtitleKey: 'route.sales.subtitle',
  },
  '/orders': {
    titleKey: 'route.orders.title',
    subtitleKey: 'route.orders.subtitle',
  },
  '/customers': {
    titleKey: 'route.customers.title',
    subtitleKey: 'route.customers.subtitle',
  },
  '/calendar': {
    titleKey: 'route.calendar.title',
    subtitleKey: 'route.calendar.subtitle',
  },
  '/ai-assistant': {
    titleKey: 'route.aiAssistant.title',
    subtitleKey: 'route.aiAssistant.subtitle',
  },
  '/inventory-ledger': {
    titleKey: 'route.inventoryLedger.title',
    subtitleKey: 'route.inventoryLedger.subtitle',
  },
  '/products': {
    titleKey: 'route.products.title',
    subtitleKey: 'route.products.subtitle',
  },
  '/sn-stock-in': {
    titleKey: 'route.snStockIn.title',
    subtitleKey: 'route.snStockIn.subtitle',
  },
  '/transfer': {
    titleKey: 'route.transfer.title',
    subtitleKey: 'route.transfer.subtitle',
  },
  '/sn-trace': {
    titleKey: 'route.snTrace.title',
    subtitleKey: 'route.snTrace.subtitle',
  },
  '/stores': {
    titleKey: 'route.stores.title',
    subtitleKey: 'route.stores.subtitle',
  },
  '/employees': {
    titleKey: 'route.employees.title',
    subtitleKey: 'route.employees.subtitle',
  },
};

function getItem(
  label: ReactNode,
  key: string,
  icon?: ReactNode,
  children?: MenuProps['items'],
): Required<MenuProps>['items'][number] {
  return { key, icon, children, label };
}

function getSelectedKey(pathname: string): MenuLeafKey {
  if (pathname.startsWith('/sales')) return '/sales';
  if (pathname.startsWith('/orders')) return '/orders';
  if (pathname.startsWith('/customers')) return '/customers';
  if (pathname.startsWith('/calendar')) return '/calendar';
  if (pathname.startsWith('/ai-assistant')) return '/ai-assistant';
  if (pathname.startsWith('/inventory-ledger')) return '/inventory-ledger';
  if (pathname.startsWith('/products')) return '/products';
  if (pathname.startsWith('/sn-stock-in')) return '/sn-stock-in';
  if (pathname.startsWith('/transfer')) return '/transfer';
  if (pathname.startsWith('/sn-trace')) return '/sn-trace';
  if (pathname.startsWith('/stores')) return '/stores';
  if (pathname.startsWith('/employees')) return '/employees';
  return '/dashboard';
}

function getOpenGroupKey(selectedKey: MenuLeafKey): MenuGroupKey | undefined {
  if (['/sales', '/orders', '/customers', '/calendar', '/ai-assistant'].includes(selectedKey)) {
    return 'sales-crm';
  }
  if (['/inventory-ledger', '/products', '/sn-stock-in', '/transfer', '/sn-trace'].includes(selectedKey)) {
    return 'inventory-product';
  }
  if (['/stores', '/employees'].includes(selectedKey)) {
    return 'system-settings';
  }
  return undefined;
}

function getRoleLabel(role: string | undefined): string {
  if (role === 'admin') return 'ADMIN';
  if (role === 'store_manager') return 'STORE_MANAGER';
  if (role === 'staff') return 'STAFF';
  return '-';
}

function getRoleTagStyle(role: string | undefined): CSSProperties {
  if (role === 'admin') {
    return { background: '#eff6ff', color: '#1d4ed8' };
  }
  if (role === 'store_manager') {
    return { background: '#f8fafc', color: '#334155' };
  }
  if (role === 'staff') {
    return { background: '#f8fafc', color: '#475569' };
  }
  return { background: '#f8fafc', color: '#64748b' };
}

export function MainLayout(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { employee, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const isAdmin = employee?.role === 'admin';
  const selectedKey = getSelectedKey(location.pathname);
  const selectedMeta = routeMetaMap[selectedKey];
  const initialOpenGroup = getOpenGroupKey(selectedKey);
  const [openKeys, setOpenKeys] = useState<string[]>(initialOpenGroup ? [initialOpenGroup] : []);

  useEffect(() => {
    const nextOpenGroup = getOpenGroupKey(selectedKey);
    setOpenKeys(nextOpenGroup ? [nextOpenGroup] : []);
  }, [selectedKey]);

  const menuItems = useMemo<Required<MenuProps>['items']>(
    () => [
      getItem(t('menu.dashboard'), '/dashboard', <DashboardOutlined />),
      getItem(t('menu.salesCrm'), 'sales-crm', <ShoppingCartOutlined />, [
        getItem(t('menu.sales'), '/sales', <ShoppingCartOutlined />),
        getItem(t('menu.orders'), '/orders', <FileTextOutlined />),
        getItem(t('menu.customers'), '/customers', <UserOutlined />),
        getItem(t('menu.calendar'), '/calendar', <CalendarOutlined />),
        getItem(t('menu.aiAssistant'), '/ai-assistant', <RobotOutlined />),
      ]),
      getItem(t('menu.inventoryProduct'), 'inventory-product', <AppstoreOutlined />, [
        getItem(t('menu.inventoryLedger'), '/inventory-ledger', <DatabaseOutlined />),
        ...(isAdmin ? [getItem(t('menu.products'), '/products', <AppstoreOutlined />)] : []),
        getItem(t('menu.snStockIn'), '/sn-stock-in', <ScanOutlined />),
        getItem(t('menu.transfer'), '/transfer', <SwapOutlined />),
        getItem(t('menu.snTrace'), '/sn-trace', <SafetyCertificateOutlined />),
      ]),
      ...(isAdmin
        ? [
            getItem(t('menu.systemSettings'), 'system-settings', <SettingOutlined />, [
              getItem(t('menu.stores'), '/stores', <ShopOutlined />),
              getItem(t('menu.employees'), '/employees', <TeamOutlined />),
            ]),
          ]
        : []),
    ],
    [isAdmin, t],
  );

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('common.logout'),
      danger: true,
    },
  ];

  const nextLanguage = i18n.language.startsWith('zh') ? 'en' : 'zh';

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Sider
        width={256}
        theme="light"
        style={{
          background: '#ffffff',
          borderRight: '1px solid #eef2f7',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.04)',
          position: 'relative',
          zIndex: 3,
        }}
      >
        <div style={{ padding: '24px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: '#eef4ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                flexShrink: 0,
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                Hearing ERP
              </Title>
              <Text type="secondary">Open-source demo workspace</Text>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 10px 24px' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            openKeys={openKeys}
            items={menuItems}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
            onOpenChange={(keys) => {
              const latestKey = keys[keys.length - 1];
              setOpenKeys(latestKey ? [String(latestKey)] : []);
            }}
            onClick={({ key }) => navigate(String(key))}
          />
        </div>
      </Sider>

      <Layout style={{ background: '#f5f7fa' }}>
        <Header
          style={{
            height: 72,
            lineHeight: 'normal',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(16px)',
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #eef2f7',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t(selectedMeta.titleKey)}
            </Text>
            <Text strong style={{ color: '#0f172a', fontSize: 16 }}>
              {t(selectedMeta.subtitleKey)}
            </Text>
          </div>

          <Space size={12}>
            <Button
              type="text"
              icon={<GlobalOutlined />}
              onClick={() => void i18n.changeLanguage(nextLanguage)}
            >
              {t('common.languageSwitch')}
            </Button>

            <Dropdown
              placement="bottomRight"
              trigger={['click']}
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    logout();
                    navigate('/login', { replace: true });
                  }
                },
              }}
            >
              <Space
                size={12}
                style={{
                  cursor: 'pointer',
                  padding: '8px 10px 8px 12px',
                  borderRadius: 999,
                  background: '#ffffff',
                  border: '1px solid #eef2f7',
                }}
              >
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#eef4ff', color: '#2563eb' }} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <Text strong>{employee?.username ?? '-'}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('common.currentAccount')}
                  </Text>
                </div>
                <Tag bordered={false} style={{ marginInlineEnd: 0, ...getRoleTagStyle(employee?.role) }}>
                  {getRoleLabel(employee?.role)}
                </Tag>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 32, background: '#f5f7fa' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
