import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQueries } from '@tanstack/react-query';
import { Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { getAppointments, type IAppointment } from '../services/appointment';
import { getRepairs, type RepairRecordResponse } from '../services/api';
import { getCustomers } from '../services/customer';
import { getOrders, type IOrderListItem } from '../services/order';

const { Text } = Typography;

interface QuickActionItem {
  key: string;
  title: string;
  hint: string;
  path: string;
  icon: JSX.Element;
}

function getCopy(isZh: boolean) {
  return {
    sales: isZh ? '销售开单' : 'Sales POS',
    salesHint: isZh ? '快速完成门店收银与登记' : 'Create a sale and sync inventory instantly',
    calendar: isZh ? '预约日历' : 'Calendar',
    calendarHint: isZh ? '查看到店安排与回访节奏' : 'Review arrivals and follow-up flow',
    customers: isZh ? '客户管理' : 'Customers',
    customersHint: isZh ? '维护档案并查看客户全景' : 'Manage customer records and 360 views',
    repairs: isZh ? '维修大盘' : 'Repairs',
    repairsHint: isZh ? '优先处理临近交付和超期工单' : 'Prioritize due and overdue repairs',
    inventory: isZh ? '库存中心' : 'Inventory',
    inventoryHint: isZh ? '查看库存、入库与调拨' : 'Inspect stock, inbound, and transfers',
    orders: isZh ? '订单记录' : 'Orders',
    ordersHint: isZh ? '回看近期订单与收银流水' : 'Review recent orders and receipts',
    currentView: isZh ? '当前视图' : 'Current view',
    allStores: isZh ? '全部门店' : 'All stores',
    currentStore: isZh ? '当前门店' : 'Current store',
    customersTotal: isZh ? '客户总数' : 'Customers',
    weekAppointments: isZh ? '本周预约' : 'This week appointments',
    openRepairs: isZh ? '待处理维修' : 'Open repairs',
    overdueRepairs: isZh ? '超期维修' : 'Overdue repairs',
    last7Orders: isZh ? '近 7 日订单' : 'Last 7 days orders',
    last7Revenue: isZh ? '近 7 日营收' : 'Last 7 days revenue',
    todayAppointments: isZh ? '今日预约' : 'Today appointments',
    todayArrivals: isZh ? '今日到店' : 'Today arrivals',
    viewCalendar: isZh ? '查看日历' : 'View calendar',
    noAppointments: isZh ? '今天没有预约安排' : 'No appointments today',
    repairReminders: isZh ? '维修提醒' : 'Repair reminders',
    viewRepairs: isZh ? '查看维修' : 'View repairs',
    noRepairs: isZh ? '当前没有待处理维修' : 'No open repairs',
    recentOrders: isZh ? '最近订单' : 'Recent orders',
    viewAll: isZh ? '查看全部' : 'View all',
    noOrders: isZh ? '暂无订单记录' : 'No recent orders',
    summary: isZh ? '工作摘要' : 'Summary',
    quickLinks: isZh ? '快捷入口' : 'Quick links',
    completed: isZh ? '已完成' : 'Completed',
    cancelled: isZh ? '已取消' : 'Cancelled',
    paid: isZh ? '已支付' : 'Paid',
    returned: isZh ? '已退货' : 'Returned',
    pending: isZh ? '待到店' : 'Pending',
    delivered: isZh ? '已交付' : 'Delivered',
    overdue: isZh ? '已超期' : 'Overdue',
    dueSoon: isZh ? '临近交付' : 'Due soon',
    inFactory: isZh ? '返厂中' : 'In factory',
    inProgress: isZh ? '处理中' : 'In progress',
    unnamedCustomer: isZh ? '未命名客户' : 'Unnamed customer',
    orderLines: (count: number) => (isZh ? `${count} 行商品` : `${count} items`),
    serviceDate: (date: string) => (isZh ? `预计交付 ${date}` : `Due ${date}`),
  };
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return dayjs(value).format('MM-DD');
}

function formatDateTime(value: string): string {
  return dayjs(value).format('MM-DD HH:mm');
}

function renderAppointmentTag(status: IAppointment['status'], copy: ReturnType<typeof getCopy>): JSX.Element {
  if (status === 'completed') return <Tag color="success">{copy.completed}</Tag>;
  if (status === 'cancelled') return <Tag color="default">{copy.cancelled}</Tag>;
  return <Tag color="processing">{copy.pending}</Tag>;
}

function renderRepairTag(record: RepairRecordResponse, copy: ReturnType<typeof getCopy>): JSX.Element {
  if (record.status === 'DELIVERED') return <Tag color="success">{copy.delivered}</Tag>;
  const today = dayjs().startOf('day');
  const dueDate = dayjs(record.due_date).startOf('day');
  if (dueDate.isBefore(today, 'day')) return <Tag color="error">{copy.overdue}</Tag>;
  if (dueDate.diff(today, 'day') <= 3) return <Tag color="warning">{copy.dueSoon}</Tag>;
  if (record.status === 'FACTORY') return <Tag color="processing">{copy.inFactory}</Tag>;
  return <Tag>{copy.inProgress}</Tag>;
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const copy = getCopy(isZh);
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const isAdmin = employee?.role === 'ADMIN';
  const scopedStoreId = isAdmin ? undefined : employee?.store_id ?? undefined;
  const now = dayjs();
  const weekStart = now.startOf('week');
  const weekEnd = now.endOf('week');

  const quickActions: QuickActionItem[] = [
    { key: 'sales', title: copy.sales, hint: copy.salesHint, path: '/sales', icon: <ShoppingCartOutlined /> },
    { key: 'calendar', title: copy.calendar, hint: copy.calendarHint, path: '/calendar', icon: <CalendarOutlined /> },
    { key: 'customers', title: copy.customers, hint: copy.customersHint, path: '/customers', icon: <UserOutlined /> },
    { key: 'repairs', title: copy.repairs, hint: copy.repairsHint, path: '/repairs', icon: <ToolOutlined /> },
    { key: 'inventory', title: copy.inventory, hint: copy.inventoryHint, path: '/inventory', icon: <DatabaseOutlined /> },
    { key: 'orders', title: copy.orders, hint: copy.ordersHint, path: '/orders', icon: <ClockCircleOutlined /> },
  ];

  const [customersQuery, ordersQuery, repairsQuery, appointmentsQuery] = useQueries({
    queries: [
      { queryKey: ['dashboard-customers', scopedStoreId], queryFn: () => getCustomers({ page: 1, page_size: 1, store_id: scopedStoreId }) },
      { queryKey: ['dashboard-orders', scopedStoreId], queryFn: () => getOrders({ storeId: scopedStoreId }) },
      { queryKey: ['dashboard-repairs', scopedStoreId], queryFn: () => getRepairs({ store_id: scopedStoreId }) },
      {
        queryKey: ['dashboard-appointments', scopedStoreId, weekStart.toISOString(), weekEnd.toISOString()],
        queryFn: () => getAppointments({ startTime: weekStart.toISOString(), endTime: weekEnd.toISOString(), storeId: scopedStoreId }),
      },
    ],
  });

  const isLoading = customersQuery.isLoading || ordersQuery.isLoading || repairsQuery.isLoading || appointmentsQuery.isLoading;
  const orders = useMemo<IOrderListItem[]>(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const repairs = useMemo<RepairRecordResponse[]>(() => repairsQuery.data ?? [], [repairsQuery.data]);
  const appointments = useMemo<IAppointment[]>(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);

  const sevenDayOrders = useMemo(
    () => orders.filter((item) => {
      const createdAt = dayjs(item.created_at);
      return createdAt.isAfter(now.subtract(7, 'day')) || createdAt.isSame(now.subtract(7, 'day'), 'day');
    }),
    [orders, now],
  );
  const sevenDayRevenue = useMemo(
    () => sevenDayOrders.reduce((sum, item) => (item.status === 'PAID' ? sum + Number(item.total_amount) : sum), 0),
    [sevenDayOrders],
  );
  const todayAppointments = useMemo(
    () => appointments.filter((item) => dayjs(item.appointment_time).isSame(now, 'day')).sort((a, b) => dayjs(a.appointment_time).valueOf() - dayjs(b.appointment_time).valueOf()),
    [appointments, now],
  );
  const openRepairs = useMemo(() => repairs.filter((item) => item.status !== 'DELIVERED'), [repairs]);
  const overdueRepairs = useMemo(() => openRepairs.filter((item) => dayjs(item.due_date).startOf('day').isBefore(now.startOf('day'), 'day')), [openRepairs, now]);
  const upcomingRepairs = useMemo(() => [...openRepairs].sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf()).slice(0, 6), [openRepairs]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()).slice(0, 8), [orders]);

  const summaryRows = [
    { label: copy.currentView, value: isAdmin ? copy.allStores : copy.currentStore, tone: 'default' },
    { label: copy.customersTotal, value: String(customersQuery.data?.total ?? 0), tone: 'default' },
    { label: copy.weekAppointments, value: String(appointments.length), tone: 'default' },
    { label: copy.openRepairs, value: String(openRepairs.length), tone: 'default' },
    { label: copy.overdueRepairs, value: String(overdueRepairs.length), tone: overdueRepairs.length > 0 ? 'alert' : 'default' },
  ] as const;

  if (isLoading) {
    return (
      <div className="page-stack">
        <Card>
          <Skeleton active paragraph={{ rows: 14 }} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="surface-grid">
        <Card className="surface-main-card" bodyStyle={{ padding: 16 }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div className="surface-summary-strip">
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.currentView}</Text>
                <div className="surface-summary-value">{isAdmin ? copy.allStores : copy.currentStore}</div>
              </div>
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.last7Orders}</Text>
                <div className="surface-summary-value">{sevenDayOrders.length}</div>
              </div>
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.last7Revenue}</Text>
                <div className="surface-summary-value">{formatCurrency(sevenDayRevenue, locale)}</div>
              </div>
              <div className="surface-summary-chip surface-summary-chip--accent">
                <Text type="secondary">{copy.todayAppointments}</Text>
                <div className="surface-summary-value">{todayAppointments.length}</div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-section-card">
                <div className="dashboard-section-head">
                  <Text strong>{copy.todayArrivals}</Text>
                  <Button type="link" onClick={() => navigate('/calendar')}>{copy.viewCalendar}</Button>
                </div>
                {todayAppointments.length > 0 ? (
                  <div className="dashboard-list">
                    {todayAppointments.slice(0, 5).map((item) => (
                      <div key={item.id} className="dashboard-list-item">
                        <div className="dashboard-list-main">
                          <Text strong>{item.customer_name}</Text>
                          <Text type="secondary">{formatDateTime(item.appointment_time)} · {item.type} · {item.store_name}</Text>
                          <Text type="secondary">{item.customer_phone}</Text>
                        </div>
                        {renderAppointmentTag(item.status, copy)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description={copy.noAppointments} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>

              <div className="dashboard-section-card">
                <div className="dashboard-section-head">
                  <Text strong>{copy.repairReminders}</Text>
                  <Button type="link" onClick={() => navigate('/repairs')}>{copy.viewRepairs}</Button>
                </div>
                {upcomingRepairs.length > 0 ? (
                  <div className="dashboard-list">
                    {upcomingRepairs.map((record) => (
                      <div key={record.id} className="dashboard-list-item">
                        <div className="dashboard-list-main">
                          <Text strong>{record.customer_name || copy.unnamedCustomer} · {record.machine_model}</Text>
                          <Text type="secondary">{record.store_name} · {copy.serviceDate(formatDate(record.due_date))}</Text>
                          <Text type="secondary">{record.customer_phone || '-'}</Text>
                        </div>
                        {renderRepairTag(record, copy)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description={copy.noRepairs} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </div>

            <div className="dashboard-section-card">
              <div className="dashboard-section-head">
                <Text strong>{copy.recentOrders}</Text>
                <Button type="link" onClick={() => navigate('/orders')}>{copy.viewAll}</Button>
              </div>
              {recentOrders.length > 0 ? (
                <div className="dashboard-list">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="dashboard-list-item dashboard-list-item--order">
                      <div className="dashboard-list-main">
                        <Text strong>{order.customer_name} · {order.id}</Text>
                        <Text type="secondary">{order.store_name} · {formatDateTime(order.created_at)} · {copy.orderLines(order.items.length)}</Text>
                      </div>
                      <div className="dashboard-order-side">
                        <Text strong>{formatCurrency(Number(order.total_amount), locale)}</Text>
                        <Tag color={order.status === 'PAID' ? 'success' : order.status === 'RETURNED' ? 'warning' : 'default'}>
                          {order.status === 'PAID' ? copy.paid : order.status === 'RETURNED' ? copy.returned : copy.cancelled}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description={copy.noOrders} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Space>
        </Card>

        <div className="floating-side-panel">
          <Card className="floating-side-panel-card" bodyStyle={{ padding: 16 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="dashboard-section-card dashboard-section-card--compact">
                <div className="dashboard-section-head dashboard-section-head--compact"><Text strong>{copy.summary}</Text></div>
                <div className="dashboard-meta-grid">
                  {summaryRows.map((item) => (
                    <div key={item.label} className="dashboard-meta-item">
                      <Text type="secondary">{item.label}</Text>
                      <div className={`dashboard-meta-value${item.tone === 'alert' ? ' dashboard-meta-value--alert' : ''}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-section-card dashboard-section-card--compact">
                <div className="dashboard-section-head dashboard-section-head--compact"><Text strong>{copy.quickLinks}</Text></div>
                <div className="dashboard-action-grid">
                  {quickActions.map((item) => (
                    <button key={item.key} type="button" className="dashboard-action-card" onClick={() => navigate(item.path)}>
                      <span className="dashboard-action-icon">{item.icon}</span>
                      <span className="dashboard-action-copy">
                        <Text strong>{item.title}</Text>
                        <Text type="secondary">{item.hint}</Text>
                      </span>
                      <ArrowRightOutlined className="dashboard-action-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
}
