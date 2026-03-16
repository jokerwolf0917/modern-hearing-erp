import { DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Empty,
  InputNumber,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { getCustomers, type ICustomer } from '../services/customer';
import { getAvailableSNs, getStockSummary, type AvailableSerialItem, type StockSummaryItem } from '../services/inventory';
import { createOrder } from '../services/order';
import { getProducts, type IProduct } from '../services/product';
import { getStores, type IStore } from '../services/store';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Paragraph, Text, Title } = Typography;

interface CartItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  stock: number;
  quantity: number;
  has_sn_tracking: boolean;
  sn_codes: string[];
}

function toPrice(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

export function SalesPage(): JSX.Element {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [selectedStoreId, setSelectedStoreId] = useState<string>();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';

  const [storeQuery, stockSummaryQuery, customerQuery] = useQueries({
    queries: [
      { queryKey: ['stores'], queryFn: getStores },
      { queryKey: ['stock-summary'], queryFn: getStockSummary },
      {
        queryKey: ['customers', 'sales-page'],
        queryFn: () =>
          getCustomers({
            page: 1,
            page_size: 100,
          }),
      },
    ],
  });

  const productQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const trackedCartItems = useMemo(() => cartItems.filter((item) => item.has_sn_tracking), [cartItems]);
  const serialQueries = useQueries({
    queries: trackedCartItems.map((item) => ({
      queryKey: ['available-sns', selectedStoreId, item.product_id],
      queryFn: () => getAvailableSNs(selectedStoreId!, item.product_id),
      enabled: Boolean(selectedStoreId),
    })),
  });

  const stores = (storeQuery.data ?? []) as IStore[];
  const stockSummary = (stockSummaryQuery.data ?? []) as StockSummaryItem[];
  const customers = customerQuery.data?.items ?? [];
  const products = (productQuery.data ?? []) as IProduct[];
  const isLoading =
    storeQuery.isLoading || stockSummaryQuery.isLoading || customerQuery.isLoading || productQuery.isLoading;
  const isStoreLocked = employee?.role === 'store_manager' || employee?.role === 'staff';

  useEffect(() => {
    if (isStoreLocked && employee?.store_id) {
      setSelectedStoreId(employee.store_id);
      return;
    }

    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [employee?.store_id, isStoreLocked, selectedStoreId, stores]);

  const visibleStores = useMemo(() => {
    if (isStoreLocked && employee?.store_id) {
      return stores.filter((item) => item.id === employee.store_id);
    }
    return stores;
  }, [employee?.store_id, isStoreLocked, stores]);

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);

  const currentStoreInventory = stockSummary
    .filter((item) => item.store_id === selectedStoreId && item.quantity > 0)
    .map((item) => ({
      ...item,
      product: productMap.get(item.product_id),
    }));

  const availableSerialMap = useMemo(() => {
    const map = new Map<string, AvailableSerialItem[]>();
    trackedCartItems.forEach((item, index) => {
      map.set(item.product_id, (serialQueries[index]?.data as AvailableSerialItem[] | undefined) ?? []);
    });
    return map;
  }, [trackedCartItems, serialQueries]);

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, t('pos.checkoutFailed'));
  };

  function handleAddToCart(record: StockSummaryItem & { product?: IProduct }): void {
    const hasSnTracking = Boolean(record.product?.has_sn_tracking);

    setCartItems((current) => {
      const existingItem = current.find((item) => item.product_id === record.product_id);
      if (existingItem) {
        if (existingItem.has_sn_tracking) {
          messageApi.info(t('pos.addExistingSnInfo'));
          return current;
        }

        if (existingItem.quantity >= existingItem.stock) {
          messageApi.warning(t('pos.cartLimitWarning'));
          return current;
        }

        return current.map((item) =>
          item.product_id === record.product_id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          product_id: record.product_id,
          product_name: record.product_name,
          sku: record.sku,
          unit_price: toPrice(record.retail_price),
          stock: record.quantity,
          quantity: 1,
          has_sn_tracking: hasSnTracking,
          sn_codes: [],
        },
      ];
    });
  }

  function handleSNChange(productId: string, snCodes: string[]): void {
    setCartItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              sn_codes: Array.from(new Set(snCodes)),
              quantity: Array.from(new Set(snCodes)).length || item.quantity,
            }
          : item,
      ),
    );
  }

  function updateCartQuantity(productId: string, quantity: number): void {
    setCartItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: Math.min(Math.max(1, quantity), item.stock),
            }
          : item,
      ),
    );
  }

  function handleRemoveFromCart(productId: string): void {
    setCartItems((current) => current.filter((item) => item.product_id !== productId));
  }

  function handleStoreChange(value: string): void {
    if (isStoreLocked) {
      return;
    }

    setSelectedStoreId(value);
    setCartItems([]);
  }

  const createOrderMutation = useMutation({
    mutationFn: () =>
      createOrder({
        customer_id: selectedCustomerId!,
        store_id: selectedStoreId!,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.has_sn_tracking ? item.sn_codes.length : item.quantity,
          sn_codes: item.has_sn_tracking ? item.sn_codes : [],
        })),
      }),
    onSuccess: async () => {
      messageApi.success(t('pos.checkoutSuccess'));
      setCartItems([]);
      setSelectedCustomerId(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
      Modal.success({
        title: t('pos.orderSuccessTitle'),
        content: t('pos.orderSuccessContent'),
        okText: t('pos.goDashboard'),
        onOk: () => navigate('/dashboard'),
      });
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  async function handleCheckout(): Promise<void> {
    if (!selectedStoreId) {
      messageApi.warning(t('pos.selectStoreWarning'));
      return;
    }

    if (!selectedCustomerId) {
      messageApi.warning(t('pos.selectCustomerWarning'));
      return;
    }

    if (cartItems.length === 0) {
      messageApi.warning(t('pos.selectProductWarning'));
      return;
    }

    const invalidTrackedItem = cartItems.find((item) => item.has_sn_tracking && item.sn_codes.length === 0);
    if (invalidTrackedItem) {
      messageApi.warning(t('pos.missingSnWarning', { name: invalidTrackedItem.product_name }));
      return;
    }

    const invalidNormalItem = cartItems.find((item) => !item.has_sn_tracking && item.quantity <= 0);
    if (invalidNormalItem) {
      messageApi.warning(t('pos.invalidQuantityWarning', { name: invalidNormalItem.product_name }));
      return;
    }

    try {
      await createOrderMutation.mutateAsync();
    } catch {
      // Error is already handled in mutation callbacks.
    }
  }

  const productColumns: ColumnsType<StockSummaryItem & { product?: IProduct }> = [
    {
      title: t('pos.product'),
      key: 'product',
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.product_name}</div>
          <Text type="secondary">{record.sku}</Text>
        </div>
      ),
    },
    {
      title: t('pos.type'),
      key: 'tracking',
      width: 130,
      render: (_, record) => (
        <Tag bordered={false} color={record.product?.has_sn_tracking ? 'processing' : 'default'}>
          {record.product?.has_sn_tracking ? t('pos.snProduct') : t('pos.regularProduct')}
        </Tag>
      ),
    },
    {
      title: t('pos.inventory'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      render: (value: number) => (
        <Tag bordered={false} color={value <= 5 ? 'error' : 'processing'}>
          {value}
        </Tag>
      ),
    },
    {
      title: t('pos.retailPrice'),
      dataIndex: 'retail_price',
      key: 'retail_price',
      width: 140,
      render: (value: number | string) => formatCurrency(toPrice(value), locale),
    },
    {
      title: t('pos.action'),
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => handleAddToCart(record)}>
          {t('pos.add')}
        </Button>
      ),
    },
  ];

  const cartColumns: ColumnsType<CartItem> = [
    {
      title: t('pos.product'),
      key: 'product',
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.product_name}</div>
          <Text type="secondary">{record.sku}</Text>
        </div>
      ),
    },
    {
      title: t('pos.trackingMode'),
      key: 'tracking',
      width: 130,
      render: (_, record) => (
        <Tag bordered={false} color={record.has_sn_tracking ? 'processing' : 'default'}>
          {record.has_sn_tracking ? t('pos.snTracking') : t('pos.noSnRequired')}
        </Tag>
      ),
    },
    {
      title: t('pos.snSelect'),
      key: 'sn_codes',
      width: 320,
      render: (_, record) => {
        if (!record.has_sn_tracking) {
          return <Text type="secondary">{t('pos.noSnRequired')}</Text>;
        }

        const options = (availableSerialMap.get(record.product_id) ?? []).map((item) => ({
          value: item.sn_code,
          label: item.sn_code,
        }));
        const queryIndex = trackedCartItems.findIndex((item) => item.product_id === record.product_id);
        const loading = queryIndex >= 0 ? (serialQueries[queryIndex]?.isLoading ?? false) : false;

        return (
          <Select
            mode="multiple"
            allowClear
            className="w-full"
            maxTagCount="responsive"
            placeholder={options.length > 0 ? t('pos.chooseSnPlaceholder') : t('pos.noSnAvailable')}
            value={record.sn_codes}
            options={options}
            loading={loading}
            onChange={(value) => handleSNChange(record.product_id, value)}
          />
        );
      },
    },
    {
      title: t('pos.quantity'),
      key: 'quantity',
      width: 160,
      render: (_, record) =>
        record.has_sn_tracking ? (
          <Tag bordered={false} color={record.sn_codes.length > 0 ? 'processing' : 'default'}>
            {record.sn_codes.length}
          </Tag>
        ) : (
          <InputNumber
            min={1}
            max={record.stock}
            precision={0}
            value={record.quantity}
            onChange={(value) => updateCartQuantity(record.product_id, Number(value ?? 1))}
          />
        ),
    },
    {
      title: t('pos.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (value: number) => formatCurrency(value, locale),
    },
    {
      title: t('pos.subtotal'),
      key: 'line_total',
      width: 120,
      render: (_, record) =>
        formatCurrency(record.unit_price * (record.has_sn_tracking ? record.sn_codes.length : record.quantity), locale),
    },
    {
      title: t('pos.action'),
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveFromCart(record.product_id)} />
      ),
    },
  ];

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.unit_price * (item.has_sn_tracking ? item.sn_codes.length : item.quantity),
    0,
  );

  return (
    <>
      {messageContextHolder}

      <div className="page-stack">
        <div className="page-hero">
          <Text type="secondary">{t('pos.workspace')}</Text>
          <Title level={1} className="page-title !mb-0">
            {t('pos.title')}
          </Title>
          <Paragraph className="page-hero-meta !mb-0">{t('pos.description')}</Paragraph>
        </div>

        {isLoading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card
              title={t('pos.availableStock')}
              extra={
                <Select
                  className="w-64"
                  placeholder={t('pos.selectStore')}
                  value={selectedStoreId}
                  onChange={handleStoreChange}
                  disabled={isStoreLocked}
                  options={visibleStores.map((item) => ({ value: item.id, label: item.name }))}
                />
              }
            >
              {currentStoreInventory.length > 0 ? (
                <Table<StockSummaryItem & { product?: IProduct }>
                  rowKey="inventory_id"
                  columns={productColumns}
                  dataSource={currentStoreInventory}
                  pagination={false}
                  scroll={{ x: 860 }}
                />
              ) : (
                <Empty description={t('pos.noAvailableStock')} />
              )}
            </Card>

            <div className="xl:sticky xl:top-[104px] xl:self-start">
              <Card
                title={
                  <Space>
                    <ShoppingCartOutlined />
                    <span>{t('pos.cartAndCheckout')}</span>
                  </Space>
                }
              >
                <Space direction="vertical" size="large" className="w-full">
                  <div>
                    <Text type="secondary">{t('pos.selectCustomer')}</Text>
                    <Select
                      showSearch
                      className="mt-2 w-full"
                      placeholder={t('pos.selectCustomerPlaceholder')}
                      value={selectedCustomerId}
                      loading={customerQuery.isLoading}
                      onChange={(value) => setSelectedCustomerId(value)}
                      optionFilterProp="label"
                      options={customers.map((item: ICustomer) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                    />
                  </div>

                  {cartItems.length > 0 ? (
                    <Table<CartItem>
                      rowKey="product_id"
                      columns={cartColumns}
                      dataSource={cartItems}
                      pagination={false}
                      scroll={{ x: 980 }}
                    />
                  ) : (
                    <Empty description={t('pos.emptyCart')} />
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="mb-2 text-sm text-slate-500">{t('pos.totalAmount')}</div>
                    <div className="text-4xl font-semibold tracking-tight text-slate-950">
                      {formatCurrency(totalAmount, locale)}
                    </div>
                    <Paragraph className="!mb-0 mt-3 text-sm text-slate-500">{t('pos.summaryHint')}</Paragraph>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={createOrderMutation.isPending}
                    onClick={() => void handleCheckout()}
                  >
                    {t('pos.checkout')}
                  </Button>
                </Space>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
