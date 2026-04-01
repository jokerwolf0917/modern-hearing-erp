import { PrinterOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, Form, Input, Popconfirm, Popover, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useTranslation } from 'react-i18next';

import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getOrders, returnOrder, type GetOrdersParams, type IOrderListItem } from '../services/order';
import { getStores } from '../services/store';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Text } = Typography;

function compareText(left?: string | null, right?: string | null): number {
  return (left ?? '').localeCompare(right ?? '', 'en');
}

function compareDate(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareNumber(left: number | string, right: number | string): number {
  return Number(left) - Number(right);
}

function getCopy(isZh: boolean) {
  return {
    allStores: isZh ? '全部门店' : 'All stores',
    selectStore: isZh ? '选择门店' : 'Select store',
    searchCustomer: isZh ? '输入客户姓名搜索' : 'Search by customer name',
    searchOrder: isZh ? '输入订单号搜索' : 'Search by order ID',
    search: isZh ? '搜索' : 'Search',
    reset: isZh ? '重置' : 'Reset',
    orderId: isZh ? '订单号' : 'Order ID',
    store: isZh ? '门店' : 'Store',
    customer: isZh ? '客户' : 'Customer',
    total: isZh ? '总金额' : 'Total',
    status: isZh ? '状态' : 'Status',
    createdAt: isZh ? '下单时间' : 'Created At',
    actions: isZh ? '操作' : 'Actions',
    print: isZh ? '打印凭证' : 'Print receipt',
    refund: isZh ? '退货' : 'Refund',
    confirmRefundTitle: isZh ? '确认执行退货？' : 'Confirm refund?',
    confirmRefundDesc: isZh ? '退货后会回补库存，并将订单标记为已退货。' : 'The order will be marked as returned and inventory will be restored.',
    confirm: isZh ? '确认' : 'Confirm',
    cancel: isZh ? '取消' : 'Cancel',
    refundSuccess: isZh ? '退货完成，库存已同步回补' : 'Refund completed and inventory restored',
    orderActionFailed: isZh ? '订单操作失败，请稍后重试' : 'Order action failed. Please try again.',
    noOrders: isZh ? '暂无订单记录' : 'No orders found',
    noOrderItems: isZh ? '暂无订单明细' : 'No order items',
    totalOrders: (count: number) => (isZh ? `共 ${count} 笔订单` : `${count} orders`),
    product: isZh ? '商品名称' : 'Product',
    unitPrice: isZh ? '单价' : 'Unit Price',
    quantity: isZh ? '数量' : 'Qty',
    subtotal: isZh ? '小计' : 'Subtotal',
    lineCount: isZh ? '商品行数' : 'Line items',
    paid: isZh ? '已支付' : 'Paid',
    returned: isZh ? '已退货' : 'Returned',
    cancelled: isZh ? '已取消' : 'Cancelled',
  };
}

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

function renderOrderPreview(record: IOrderListItem, copy: ReturnType<typeof getCopy>, locale: string, statusLabel: string): JSX.Element {
  return (
    <div className="w-[320px]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{record.id.slice(0, 8).toUpperCase()}</div>
        <div className="mt-1 text-xs text-slate-500">{record.id}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.store}</span>
          <span>{record.store_name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.customer}</span>
          <span>{record.customer_name}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.total}</span>
          <span>{formatCurrency(record.total_amount, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.status}</span>
          <span>{statusLabel}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.createdAt}</span>
          <span>{formatDateTime(record.created_at, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.lineCount}</span>
          <span>{record.items.length}</span>
        </div>
      </div>
    </div>
  );
}

export function OrderListPage(): JSX.Element {
  const [form] = Form.useForm<GetOrdersParams>();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const copy = getCopy(isZh);
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const isAdmin = employee?.role === 'ADMIN';
  const preferredAdminStore = settings.defaultStoreId ?? 'ALL';
  const [filters, setFilters] = useState<GetOrdersParams>({
    storeId:
      employee?.role === 'ADMIN'
        ? preferredAdminStore === 'ALL'
          ? undefined
          : preferredAdminStore ?? undefined
        : employee?.store_id ?? undefined,
  });
  const [selectedOrder, setSelectedOrder] = useState<IOrderListItem | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!employee || isAdmin) {
      form.setFieldsValue({ storeId: preferredAdminStore === null ? 'ALL' : preferredAdminStore });
      return;
    }

    form.setFieldsValue({ storeId: employee.store_id ?? undefined });
    setFilters((previous) => ({
      ...previous,
      storeId: employee.store_id ?? undefined,
    }));
  }, [employee, form, isAdmin, preferredAdminStore]);

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, copy.orderActionFailed);
  };

  const storeQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

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
      messageApi.success(copy.refundSuccess);
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
    if (status === 'RETURNED') {
      return { label: copy.returned, color: 'red' };
    }

    if (status === 'CANCELLED') {
      return { label: copy.cancelled, color: 'default' };
    }

    return { label: copy.paid, color: 'green' };
  }

  const columns: ColumnsType<IOrderListItem> = [
    {
      title: copy.orderId,
      dataIndex: 'id',
      key: 'id',
      width: 180,
      sorter: (a, b) => compareText(a.id, b.id),
      sortDirections: ['ascend', 'descend'],
      render: (value: string, record) => {
        const meta = getStatusMeta(record.status);
        return (
          <Popover placement="rightTop" content={renderOrderPreview(record, copy, locale, meta.label)} trigger="hover">
            <Text copyable={{ text: value }} strong className="cursor-pointer">
              {value.slice(0, 8).toUpperCase()}
            </Text>
          </Popover>
        );
      },
    },
    {
      title: copy.store,
      dataIndex: 'store_name',
      key: 'store_name',
      width: 180,
      sorter: (a, b) => compareText(a.store_name, b.store_name),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: copy.customer,
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 160,
      sorter: (a, b) => compareText(a.customer_name, b.customer_name),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: copy.total,
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 140,
      sorter: (a, b) => compareNumber(a.total_amount, b.total_amount),
      sortDirections: ['ascend', 'descend'],
      render: (value: number | string) => formatCurrency(value, locale),
    },
    {
      title: copy.status,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: (a, b) => compareText(a.status, b.status),
      sortDirections: ['ascend', 'descend'],
      render: (value: IOrderListItem['status']) => {
        const meta = getStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: copy.createdAt,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      defaultSortOrder: 'descend',
      sorter: (a, b) => compareDate(a.created_at, b.created_at),
      sortDirections: ['descend', 'ascend'],
      render: (value: string) => formatDateTime(value, locale),
    },
    {
      title: copy.actions,
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
            {copy.print}
          </Button>
          {record.status === 'PAID' ? (
            <Popconfirm
              title={copy.confirmRefundTitle}
              description={copy.confirmRefundDesc}
              okText={copy.confirm}
              cancelText={copy.cancel}
              onConfirm={() => void returnMutation.mutateAsync(record.id)}
            >
              <Button danger type="link" loading={returnMutation.isPending}>
                {copy.refund}
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
      title: copy.product,
      dataIndex: 'product_name',
      key: 'product_name',
      render: (_, record) => (
        <Popover
          placement="rightTop"
          trigger="hover"
          content={
            <div className="w-[320px]">
              <div className="text-sm font-semibold text-slate-900">{record.product_name}</div>
              <div className="mt-1 text-xs text-slate-500">{record.sku}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">{copy.unitPrice}</span>
                  <span>{formatCurrency(record.unit_price, locale)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">{copy.quantity}</span>
                  <span>{record.quantity}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-400">{copy.subtotal}</span>
                  <span>{formatCurrency(Number(record.unit_price) * record.quantity, locale)}</span>
                </div>
                {record.serial_details.map((serial) => (
                  <div key={serial.sn_code} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    SN: {serial.sn_code}
                    {serial.warranty_ends_at
                      ? ` | ${isZh ? '保修至' : 'Warranty until'} ${new Date(serial.warranty_ends_at).toLocaleDateString(locale)}`
                      : ''}
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <div className="cursor-pointer">
            <div className="font-medium text-slate-800">{record.product_name}</div>
            <div className="text-xs text-slate-400">{record.sku}</div>
            {record.serial_details.map((serial) => (
              <div key={serial.sn_code} className="text-xs text-slate-500">
                SN: {serial.sn_code}
                {serial.warranty_ends_at
                  ? ` | ${isZh ? '保修至' : 'Warranty until'} ${new Date(serial.warranty_ends_at).toLocaleDateString(locale)}`
                  : ''}
              </div>
            ))}
          </div>
        </Popover>
      ),
    },
    {
      title: copy.unitPrice,
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 140,
      render: (value: number | string) => formatCurrency(value, locale),
    },
    {
      title: copy.quantity,
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
    },
    {
      title: copy.subtotal,
      key: 'line_total',
      width: 140,
      render: (_, record) => formatCurrency(Number(record.unit_price) * record.quantity, locale),
    },
  ];

  const handleSearch = (values: GetOrdersParams): void => {
    setFilters({
      storeId: values.storeId === 'ALL' ? undefined : values.storeId?.trim() || undefined,
      customerName: values.customerName?.trim() || undefined,
      orderId: values.orderId?.trim() || undefined,
    });
  };

  const handleReset = (): void => {
    form.resetFields();
    const nextStoreId = isAdmin
      ? preferredAdminStore === 'ALL'
        ? undefined
        : preferredAdminStore ?? undefined
      : employee?.store_id ?? undefined;
    form.setFieldsValue({ storeId: isAdmin ? preferredAdminStore : nextStoreId });
    setFilters({ storeId: nextStoreId });
  };

  return (
    <>
      {contextHolder}

      <Card className="rounded-2xl shadow-sm">
        <Space direction="vertical" size="large" className="w-full">
          <Form<GetOrdersParams>
            form={form}
            initialValues={{ storeId: isAdmin ? 'ALL' : employee?.store_id ?? undefined }}
            onFinish={handleSearch}
            className="order-toolbar-grid"
          >
            <Form.Item name="storeId">
              <Select
                className="toolbar-select"
                placeholder={copy.selectStore}
                disabled={!isAdmin}
                loading={storeQuery.isLoading}
                options={[
                  ...(isAdmin ? [{ label: copy.allStores, value: 'ALL' }] : []),
                  ...(storeQuery.data ?? []).map((store) => ({
                    label: store.name,
                    value: store.id,
                  })),
                ]}
              />
            </Form.Item>
            <Form.Item name="customerName">
              <Input allowClear placeholder={copy.searchCustomer} className="toolbar-search" />
            </Form.Item>
            <Form.Item name="orderId">
              <Input allowClear placeholder={copy.searchOrder} className="toolbar-search" />
            </Form.Item>
            <Form.Item>
              <div className="toolbar-actions">
                <Button onClick={() => form.submit()} loading={orderQuery.isFetching}>
                  {copy.search}
                </Button>
                <Button onClick={handleReset} disabled={orderQuery.isFetching}>
                  {copy.reset}
                </Button>
              </div>
            </Form.Item>
          </Form>

          <Table<IOrderListItem>
            rowKey="id"
            columns={columns}
            dataSource={orderQuery.data ?? []}
            loading={orderQuery.isLoading || orderQuery.isFetching}
            locale={{ emptyText: <Empty description={copy.noOrders} /> }}
            expandable={{
              expandedRowRender: (record) => (
                <Table<IOrderListItem['items'][number]>
                  rowKey={(_, index) => `${record.id}-${index}`}
                  columns={itemColumns}
                  dataSource={record.items}
                  locale={{ emptyText: copy.noOrderItems }}
                  pagination={false}
                  size="small"
                  bordered={false}
                />
              ),
              rowExpandable: (record) => record.items.length > 0,
            }}
            pagination={{ pageSize: 10, showTotal: (total) => copy.totalOrders(total) }}
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
