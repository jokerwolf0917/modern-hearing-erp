import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { getInventoryLedger, type InventoryLedgerRow } from '../services/inventory';
import { getStores } from '../services/store';

const { Paragraph, Text, Title } = Typography;

function formatCurrency(value: number | string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function InventoryListPage(): JSX.Element {
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-US';
  const isStoreUser = employee?.role === 'store_manager' || employee?.role === 'staff';
  const [storeId, setStoreId] = useState<string | undefined>(isStoreUser ? employee?.store_id ?? undefined : undefined);
  const [productNameInput, setProductNameInput] = useState('');
  const [filters, setFilters] = useState<{ storeId?: string; productName?: string }>({
    storeId: isStoreUser ? employee?.store_id ?? undefined : undefined,
    productName: undefined,
  });

  const copy = {
    eyebrow: 'Inventory Ledger',
    title: isZh ? '库存查询' : 'Inventory Lookup',
    description: isZh
      ? '统一查看各门店的库存余量、价格和序列号追踪状态，快速判断哪些商品需要继续去做调拨或扫码入库。'
      : 'Review stock balance, pricing and serial tracking across stores, and quickly spot items that need transfer or serial stock-in.',
    storePlaceholder: isZh ? '选择门店' : 'Select store',
    productPlaceholder: isZh ? '搜索商品名' : 'Search product name',
    search: isZh ? '查询' : 'Search',
    reset: isZh ? '重置' : 'Reset',
    recordCount: isZh ? '当前共 {{count}} 条库存记录' : '{{count}} inventory rows',
    productName: isZh ? '商品名称' : 'Product',
    storeName: isZh ? '所在门店' : 'Store',
    quantity: isZh ? '当前库存' : 'In Stock',
    productType: isZh ? '商品类型' : 'Type',
    costPrice: isZh ? '成本价' : 'Cost Price',
    retailPrice: isZh ? '零售价' : 'Retail Price',
    serialProduct: isZh ? '序列号商品' : 'Serial-tracked',
    snTracking: isZh ? 'SN 追踪' : 'SN Tracking',
    regularProduct: isZh ? '普通商品' : 'Regular Product',
  };

  useEffect(() => {
    if (isStoreUser) {
      const nextStoreId = employee?.store_id ?? undefined;
      setStoreId(nextStoreId);
      setFilters((current) => ({ ...current, storeId: nextStoreId }));
    }
  }, [employee?.store_id, isStoreUser]);

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const ledgerQuery = useQuery({
    queryKey: ['inventory-ledger', filters.storeId, filters.productName],
    queryFn: () =>
      getInventoryLedger({
        storeId: filters.storeId,
        productName: filters.productName,
      }),
  });

  const storeOptions = useMemo(
    () => (storesQuery.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    [storesQuery.data],
  );

  const columns: ColumnsType<InventoryLedgerRow> = [
    {
      title: copy.productName,
      dataIndex: 'product_name',
      key: 'product_name',
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.product_name}</div>
          <Text type="secondary">{record.sku}</Text>
        </div>
      ),
    },
    {
      title: copy.storeName,
      dataIndex: 'store_name',
      key: 'store_name',
      width: 180,
    },
    {
      title: copy.quantity,
      dataIndex: 'quantity',
      key: 'quantity',
      width: 180,
      render: (value: number, record) => (
        <Space size={8} wrap>
          <Text strong style={{ color: value === 0 ? '#dc2626' : '#0f172a' }}>
            {value}
          </Text>
          {record.has_sn_tracking ? (
            <Tag color="processing" bordered={false}>
              {copy.serialProduct}
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: copy.productType,
      key: 'product_type',
      width: 140,
      render: (_, record) => (record.has_sn_tracking ? copy.snTracking : copy.regularProduct),
    },
    {
      title: copy.costPrice,
      dataIndex: 'cost_price',
      key: 'cost_price',
      width: 140,
      render: (value: number | string) => formatCurrency(value, locale),
    },
    {
      title: copy.retailPrice,
      dataIndex: 'retail_price',
      key: 'retail_price',
      width: 140,
      render: (value: number | string) => formatCurrency(value, locale),
    },
  ];

  const handleSearch = (): void => {
    setFilters({
      storeId: storeId || undefined,
      productName: productNameInput.trim() || undefined,
    });
  };

  const handleReset = (): void => {
    const nextStoreId = isStoreUser ? employee?.store_id ?? undefined : undefined;
    setStoreId(nextStoreId);
    setProductNameInput('');
    setFilters({
      storeId: nextStoreId,
      productName: undefined,
    });
  };

  return (
    <div className="page-stack">
      <div className="page-hero">
        <Text type="secondary">{copy.eyebrow}</Text>
        <Title level={1} className="page-title !mb-0">
          {copy.title}
        </Title>
        <Paragraph className="page-hero-meta !mb-0">{copy.description}</Paragraph>
      </div>

      <Card>
        <Space direction="vertical" size="large" className="w-full">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Space size="middle" wrap>
              <Select
                allowClear={!isStoreUser}
                className="w-64"
                placeholder={copy.storePlaceholder}
                value={storeId}
                disabled={isStoreUser}
                loading={storesQuery.isLoading}
                options={storeOptions}
                onChange={(value) => setStoreId(value ?? undefined)}
              />
              <Input
                allowClear
                className="w-72"
                prefix={<SearchOutlined />}
                placeholder={copy.productPlaceholder}
                value={productNameInput}
                onChange={(event) => setProductNameInput(event.target.value)}
                onPressEnter={handleSearch}
              />
              <Button type="primary" onClick={handleSearch}>
                {copy.search}
              </Button>
              <Button onClick={handleReset}>{copy.reset}</Button>
            </Space>

            <Space size="small">
              <DatabaseOutlined className="text-slate-500" />
              <Text type="secondary">{copy.recordCount.replace('{{count}}', String(ledgerQuery.data?.length ?? 0))}</Text>
            </Space>
          </div>

          <Table<InventoryLedgerRow>
            rowKey="inventory_id"
            columns={columns}
            dataSource={ledgerQuery.data ?? []}
            loading={ledgerQuery.isLoading || ledgerQuery.isFetching}
            pagination={{ pageSize: 12, showSizeChanger: false }}
            scroll={{ x: 1080 }}
          />
        </Space>
      </Card>
    </div>
  );
}
