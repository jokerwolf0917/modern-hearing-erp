import { FireOutlined, LineChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQueries } from '@tanstack/react-query';
import { Button, Card, Col, Empty, Row, Skeleton, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getDashboardSummary, type DashboardSummary } from '../services/analytics';
import { getLedgerHistory, type LedgerHistoryItem } from '../services/inventory';

const { Paragraph, Text, Title } = Typography;

const chartColors = ['#2563eb', '#60a5fa', '#94a3b8', '#0f172a', '#cbd5e1'];

function formatDateTime(value: string | number, locale: string): string {
  return new Date(value).toLocaleString(locale, { hour12: false });
}

function formatCurrency(value: number | string | undefined, locale: string): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(value: string, locale: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date);
}

function normalizeChartValue(value: number | string | readonly (number | string)[] | undefined): number {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0);
  }

  return Number(value ?? 0);
}

export function DashboardPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  const [summaryQuery, ledgerQuery] = useQueries({
    queries: [
      {
        queryKey: ['analytics-summary'],
        queryFn: getDashboardSummary,
      },
      {
        queryKey: ['ledger-history'],
        queryFn: getLedgerHistory,
      },
    ],
  });

  const summary = summaryQuery.data as DashboardSummary | undefined;
  const ledgerHistory = ledgerQuery.data as LedgerHistoryItem[] | undefined;
  const isRefreshing = summaryQuery.isFetching || ledgerQuery.isFetching;
  const lastUpdatedAt = Math.max(summaryQuery.dataUpdatedAt || 0, ledgerQuery.dataUpdatedAt || 0);
  const activeDays = summary?.revenue_trend.filter((item) => Number(item.revenue) > 0).length ?? 0;
  const systemActivity = Math.round((activeDays / 7) * 100);

  const referenceTypeMeta = useMemo<Record<string, { label: string; color: string }>>(
    () => ({
      manual_in: { label: t('dashboard.manualIn'), color: 'blue' },
      sales_out: { label: t('dashboard.salesOut'), color: 'volcano' },
      transfer_out: { label: t('dashboard.transferOut'), color: 'gold' },
      transfer_in: { label: t('dashboard.transferIn'), color: 'cyan' },
      return_in: { label: t('dashboard.returnIn'), color: 'green' },
    }),
    [t],
  );

  const ledgerColumns: ColumnsType<LedgerHistoryItem> = [
    {
      title: t('dashboard.operationTime'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value, locale),
    },
    {
      title: t('dashboard.type'),
      dataIndex: 'reference_type',
      key: 'reference_type',
      width: 130,
      render: (value: string) => {
        const meta = referenceTypeMeta[value] ?? { label: value, color: 'default' };
        return (
          <Tag color={meta.color} bordered={false}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: t('dashboard.product'),
      key: 'product_name',
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.product_name}</div>
          <Text type="secondary">{record.sku}</Text>
        </div>
      ),
    },
    {
      title: t('dashboard.store'),
      dataIndex: 'store_name',
      key: 'store_name',
      width: 180,
    },
    {
      title: t('dashboard.changeAmount'),
      dataIndex: 'change_amount',
      key: 'change_amount',
      width: 120,
      render: (value: number) => (value > 0 ? `+${value}` : value),
    },
    {
      title: t('dashboard.quantityFlow'),
      key: 'quantity_flow',
      width: 160,
      render: (_, record) => `${record.quantity_before} -> ${record.quantity_after}`,
    },
  ];

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([summaryQuery.refetch(), ledgerQuery.refetch()]);
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="page-hero max-w-3xl">
          <Text type="secondary">{t('dashboard.overview')}</Text>
          <Title level={1} className="page-title !mb-0">
            {t('dashboard.title')}
          </Title>
          <Paragraph className="page-hero-meta !mb-0">{t('dashboard.description')}</Paragraph>
        </div>

        <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Text type="secondary">{t('dashboard.lastUpdated')}</Text>
          <Text strong>{lastUpdatedAt > 0 ? formatDateTime(lastUpdatedAt, locale) : '-'}</Text>
          <Tooltip title={t('dashboard.refreshTooltip')}>
            <Button icon={<ReloadOutlined />} loading={isRefreshing} onClick={() => void handleRefresh()}>
              {t('dashboard.refresh')}
            </Button>
          </Tooltip>
        </div>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} md={8}>
          <Card className="h-full">
            <Statistic
              title={t('dashboard.totalRevenue')}
              value={Number(summary?.total_revenue ?? 0)}
              precision={2}
              valueStyle={{ color: '#2563eb' }}
              formatter={(value) => formatCurrency(Number(value ?? 0), locale)}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="h-full">
            <Statistic
              title={t('dashboard.totalOrders')}
              value={summary?.total_orders ?? 0}
              suffix={t('dashboard.ordersUnit')}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="h-full">
            <Statistic
              title={t('dashboard.systemActivity')}
              value={systemActivity}
              suffix="%"
              prefix={<FireOutlined />}
              valueStyle={{ color: systemActivity >= 60 ? '#2563eb' : '#64748b' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={16}>
          <Card title={t('dashboard.recentRevenue')}>
            {summaryQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : summary && summary.revenue_trend.length > 0 ? (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.revenue_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tickFormatter={(value: string) => formatShortDate(value, locale)} stroke="#64748b" />
                    <YAxis stroke="#64748b" tickFormatter={(value: number) => formatCurrency(value, locale)} />
                    <RechartsTooltip
                      formatter={(value: number | string | readonly (number | string)[] | undefined) => [
                        formatCurrency(normalizeChartValue(value), locale),
                        t('dashboard.dailyRevenue'),
                      ]}
                      labelFormatter={(label: unknown) => t('dashboard.dateLabel', { value: String(label ?? '') })}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={t('dashboard.dailyRevenue')}
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#2563eb' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description={t('dashboard.noRevenueData')} />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title={t('dashboard.topProducts')}>
            {summaryQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : summary && summary.top_products.length > 0 ? (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.top_products} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="product_name" type="category" width={120} stroke="#64748b" />
                    <RechartsTooltip
                      formatter={(value: number | string | readonly (number | string)[] | undefined) => [
                        `${normalizeChartValue(value)}`,
                        t('dashboard.salesVolume'),
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="sales_volume" name={t('dashboard.salesVolume')} radius={[0, 8, 8, 0]}>
                      {summary.top_products.map((item, index) => (
                        <Cell key={`${item.product_name}-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description={t('dashboard.noProductSalesData')} />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={t('dashboard.inventoryHistory')}
        extra={
          <Space size="small">
            <LineChartOutlined className="text-slate-500" />
            <Text type="secondary">{t('dashboard.inventoryHistoryHint')}</Text>
          </Space>
        }
      >
        {ledgerQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : ledgerHistory && ledgerHistory.length > 0 ? (
          <Table<LedgerHistoryItem>
            rowKey="ledger_id"
            columns={ledgerColumns}
            dataSource={ledgerHistory}
            pagination={false}
            scroll={{ x: 980 }}
          />
        ) : (
          <Empty description={t('dashboard.noLedgerData')} />
        )}
      </Card>
    </div>
  );
}
