import { PrinterOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, Form, Input, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';

import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { getOrders, returnOrder, type GetOrdersParams, type IOrderListItem } from '../services/order';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Paragraph, Text, Title } = Typography;

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { hour12: false });
}

function formatCurrency(value: number | string, locale: string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function OrderListPage(): JSX.Element {
  const [form] = Form.useForm<GetOrdersParams>();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<GetOrdersParams>({});
  const [selectedOrder, setSelectedOrder] = useState<IOrderListItem | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, t('order.operationFailed'));
  };

  const orderQuery = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters),
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedOrder ? `receipt-${selectedOrder.id.slice(0, 8).toUpperCase()}` : 'receipt',
  });

  const returnMutation = useMutation({
    mutationFn: (orderId: string) => returnOrder(orderId),
    onSuccess: async () => {
      messageApi.success(t('order.refundSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-summary'] }),
      ]);
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  function getStatusMeta(status: IOrderListItem['status']): { label: string; color: string } {
    if (status === 'returned') {
      return { label: t('order.refunded'), color: 'red' };
    }

    if (status === 'cancelled') {
      return { label: t('order.cancelled'), color: 'default' };
    }

    return { label: t('order.completed'), color: 'green' };
  }

  const columns: ColumnsType<IOrderListItem> = [
    {
      title: t('order.orderNo'),
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (value: string) => (
        <Text copyable={{ text: value }} strong>
          {value.slice(0, 8).toUpperCase()}
        </Text>
      ),
    },
    {
      title: t('order.store'),
      dataIndex: 'store_name',
      key: 'store_name',
      width: 180,
    },
    {
      title: t('order.customer'),
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140,
    },
    {
      title: t('order.total'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 140,
      render: (value: number | string) => formatCurrency(value, locale),
    },
    {
      title: t('order.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: IOrderListItem['status']) => {
        const meta = getStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('order.date'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value, locale),
    },
    {
      title: t('order.action'),
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            icon={<PrinterOutlined />}
            onClick={() => {
              setSelectedOrder(record);
              setTimeout(() => {
                void handlePrint();
              }, 0);
            }}
          >
            {t('order.printReceipt')}
          </Button>
          {record.status === 'paid' ? (
            <Popconfirm
              title={t('order.refundConfirmTitle')}
              description={t('order.refundConfirmDescription')}
              okText={t('order.confirmRefund')}
              cancelText={t('order.cancel')}
              onConfirm={() => void returnMutation.mutateAsync(record.id)}
            >
              <Button danger type="link" loading={returnMutation.isPending}>
                {t('order.refund')}
              </Button>
            </Popconfirm>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<IOrderListItem['items'][number]> = [
    {
      title: t('order.productName'),
      dataIndex: 'product_name',
      key: 'product_name',
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-800">{record.product_name}</div>
          <div className="text-xs text-slate-400">{record.sku}</div>
          {record.serial_details.map((serial) => (
            <div key={serial.sn_code} className="text-xs text-slate-500">
              SN: {serial.sn_code}
              {serial.warranty_ends_at
                ? ` | ${t('order.warrantyUntil')} ${new Date(serial.warranty_ends_at).toLocaleDateString(locale)}`
                : ''}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: t('order.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 140,
      render: (value: number | string) => formatCurrency(value, locale),
    },
    {
      title: t('order.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: t('order.subtotal'),
      key: 'line_total',
      width: 140,
      render: (_, record) => formatCurrency(Number(record.unit_price) * record.quantity, locale),
    },
  ];

  const handleSearch = (values: GetOrdersParams): void => {
    setFilters({
      customerName: values.customerName?.trim() || undefined,
      orderId: values.orderId?.trim() || undefined,
    });
  };

  const handleReset = (): void => {
    form.resetFields();
    setFilters({});
  };

  return (
    <>
      {contextHolder}

      <Card className="rounded-2xl shadow-sm">
        <Space direction="vertical" size="large" className="w-full">
          <div>
            <Title level={3} className="!mb-2">
              {t('order.title')}
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              {t('order.description')}
            </Paragraph>
          </div>

          <Form<GetOrdersParams> form={form} layout="inline" onFinish={handleSearch} className="gap-y-3">
            <Form.Item name="customerName" className="!mb-0">
              <Input allowClear placeholder={t('order.searchCustomerPlaceholder')} className="w-56" />
            </Form.Item>
            <Form.Item name="orderId" className="!mb-0">
              <Input allowClear placeholder={t('order.searchOrderPlaceholder')} className="w-56" />
            </Form.Item>
            <Form.Item className="!mb-0">
              <Space>
                <Button type="primary" htmlType="submit" loading={orderQuery.isFetching}>
                  {t('order.search')}
                </Button>
                <Button onClick={handleReset} disabled={orderQuery.isFetching}>
                  {t('order.reset')}
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <Table<IOrderListItem>
            rowKey="id"
            columns={columns}
            dataSource={orderQuery.data ?? []}
            loading={orderQuery.isLoading || orderQuery.isFetching}
            locale={{ emptyText: <Empty description={t('order.noOrders')} /> }}
            expandable={{
              expandedRowRender: (record) => (
                <Table<IOrderListItem['items'][number]>
                  rowKey={(_, index) => `${record.id}-${index}`}
                  columns={itemColumns}
                  dataSource={record.items}
                  locale={{ emptyText: t('order.noDetails') }}
                  pagination={false}
                  size="small"
                  bordered={false}
                />
              ),
              rowExpandable: (record) => record.items.length > 0,
            }}
            pagination={{ pageSize: 10, showTotal: (total) => t('order.totalCount', { count: total }) }}
            scroll={{ x: 1180 }}
          />
        </Space>
      </Card>

      <div style={{ position: 'fixed', left: -99999, top: 0 }}>
        <ReceiptTemplate ref={printRef} order={selectedOrder} />
      </div>
    </>
  );
}
