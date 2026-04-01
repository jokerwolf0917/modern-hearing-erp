import {
  ArrowRightOutlined,
  DatabaseOutlined,
  HolderOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Pagination,
  Popover,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { AxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { type DragEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getInventoryLedger,
  stockIn,
  transferStock,
  type InventoryLedgerRow,
  type StockInPayload,
  type TransferStockPayload,
} from '../services/inventory';
import { getProducts, type IProduct } from '../services/product';
import { getStores, type IStore } from '../services/store';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Text } = Typography;

type OperationMode = 'stock-in' | 'transfer';
type StoreFilterValue = string;
const ALL_STORES = 'ALL';

interface StockInFormValues {
  transaction_date: Dayjs;
  store_id?: string;
  product_id: string;
  quantity: number;
  remark?: string;
}

interface TransferFormValues {
  transaction_date: Dayjs;
  from_store_id?: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
  remark?: string;
}

interface InventoryCopy {
  allStores: string;
  panel: {
    inventoryAction: string;
    stockIn: string;
    transfer: string;
    stockInPanel: string;
    transferPanel: string;
    dragHint: string;
  };
  summary: {
    currentView: string;
    sku: string;
    expectedActual: string;
    lowStock: string;
  };
  labels: {
    specification: string;
    originalPrice: string;
    lastMonth: string;
    monthFlow: string;
    expected: string;
    actual: string;
    unit: string;
    remark: string;
    actualExpected: string;
    stockInDate: string;
    stockInStore: string;
    product: string;
    stockInQty: string;
    transferDate: string;
    fromStore: string;
    toStore: string;
    transferQty: string;
    notes: string;
  };
  placeholder: {
    store: string;
    search: string;
    product: string;
    stockInStore: string;
    transferFrom: string;
    transferTo: string;
    stockInNotes: string;
    transferNotes: string;
    emptySpec: string;
  };
  actions: {
    useStockIn: string;
    useTransfer: string;
    confirmStockIn: string;
    confirmTransfer: string;
  };
  messages: {
    stockInBound: (name: string) => string;
    transferBound: (name: string) => string;
    stockInOk: string;
    transferOk: string;
    submitError: string;
    outOfStock: string;
    lowStock: string;
    normal: string;
    inventoryEmpty: string;
    pageSummary: (from: number, to: number, total: number) => string;
    duplicateStore: string;
  };
}

function getInventoryCopy(isZh: boolean): InventoryCopy {
  if (isZh) {
    return {
      allStores: '全部门店',
      panel: {
        inventoryAction: '库存操作',
        stockIn: '入库',
        transfer: '调拨',
        stockInPanel: '入库面板',
        transferPanel: '调拨面板',
        dragHint: '可把左侧商品直接拖到这里，自动带入当前表单。',
      },
      summary: {
        currentView: '当前视图',
        sku: '当前 SKU',
        expectedActual: '应有 / 实盘',
        lowStock: '低库存提醒',
      },
      labels: {
        specification: '规格',
        originalPrice: '原价',
        lastMonth: '上月结存',
        monthFlow: '本月入 / 出 / 售',
        expected: '应有库存',
        actual: '实际盘存',
        unit: '单位',
        remark: '备注',
        actualExpected: '实盘 / 应有',
        stockInDate: '入库日期',
        stockInStore: '入库门店',
        product: '商品',
        stockInQty: '入库数量',
        transferDate: '调拨日期',
        fromStore: '调出门店',
        toStore: '调入门店',
        transferQty: '调拨数量',
        notes: '备注',
      },
      placeholder: {
        store: '选择门店',
        search: '搜索产品编号、名称、品牌、类别或规格',
        product: '选择商品',
        stockInStore: '选择入库门店',
        transferFrom: '选择调出门店',
        transferTo: '选择调入门店',
        stockInNotes: '例如：补货、到货、盘盈入库',
        transferNotes: '例如：门店调拨、借出、配件外发',
        emptySpec: '暂无规格说明',
      },
      actions: {
        useStockIn: '带入入库',
        useTransfer: '带入调拨',
        confirmStockIn: '确认入库',
        confirmTransfer: '确认调拨',
      },
      messages: {
        stockInBound: (name) => `已带入 ${name} 到入库表单`,
        transferBound: (name) => `已带入 ${name} 到调拨表单`,
        stockInOk: '入库记录已提交',
        transferOk: '调拨记录已提交',
        submitError: '提交失败，请稍后重试',
        outOfStock: '缺货',
        lowStock: '低库存',
        normal: '正常',
        inventoryEmpty: '当前筛选条件下暂无库存记录',
        pageSummary: (from, to, total) => `显示 ${from} - ${to} / ${total} 条库存`,
        duplicateStore: '调入门店不能与调出门店相同',
      },
    };
  }
  return {
    allStores: 'All stores',
    panel: {
      inventoryAction: 'Inventory actions',
      stockIn: 'Stock in',
      transfer: 'Transfer',
      stockInPanel: 'Stock-in panel',
      transferPanel: 'Transfer panel',
      dragHint: 'Drag products from the left to prefill the current form.',
    },
    summary: {
      currentView: 'Current view',
      sku: 'SKUs',
      expectedActual: 'Expected / Actual',
      lowStock: 'Low-stock alerts',
    },
    labels: {
      specification: 'Specification',
      originalPrice: 'Original price',
      lastMonth: 'Last month',
      monthFlow: 'In / Out / Sold',
      expected: 'Expected stock',
      actual: 'Actual count',
      unit: 'Unit',
      remark: 'Remark',
      actualExpected: 'Actual / Expected',
      stockInDate: 'Stock-in date',
      stockInStore: 'Store',
      product: 'Product',
      stockInQty: 'Quantity',
      transferDate: 'Transfer date',
      fromStore: 'From store',
      toStore: 'To store',
      transferQty: 'Quantity',
      notes: 'Remark',
    },
    placeholder: {
      store: 'Select store',
      search: 'Search by code, name, brand, category or specification',
      product: 'Select product',
      stockInStore: 'Select stock-in store',
      transferFrom: 'Select source store',
      transferTo: 'Select destination store',
      stockInNotes: 'For example: replenishment, delivery, stock gain',
      transferNotes: 'For example: store transfer, lending, accessory dispatch',
      emptySpec: 'No specification provided',
    },
    actions: {
      useStockIn: 'Use in stock-in',
      useTransfer: 'Use in transfer',
      confirmStockIn: 'Confirm stock in',
      confirmTransfer: 'Confirm transfer',
    },
    messages: {
      stockInBound: (name) => `${name} added to the stock-in form`,
      transferBound: (name) => `${name} added to the transfer form`,
      stockInOk: 'Stock-in record submitted',
      transferOk: 'Transfer record submitted',
      submitError: 'Submission failed. Please try again later.',
      outOfStock: 'Out of stock',
      lowStock: 'Low stock',
      normal: 'Normal',
      inventoryEmpty: 'No inventory records match the current filters',
      pageSummary: (from, to, total) => `Showing ${from} - ${to} of ${total} inventory rows`,
      duplicateStore: 'Destination store cannot be the same as the source store',
    },
  };
}

function translateBrand(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, { zh: string; en: string }> = {
    SIGNIA: { zh: '西嘉', en: 'Signia' },
    PHONAK: { zh: '峰力', en: 'Phonak' },
    PHILIPS: { zh: '飞利浦', en: 'Philips' },
    SIEMENS: { zh: '西门子', en: 'Siemens' },
    POWERONE: { zh: 'POWERONE', en: 'POWERONE' },
    ZHILI: { zh: '至力', en: 'Zhili' },
  };
  return map[value]?.[isZh ? 'zh' : 'en'] ?? value;
}

function translateCategory(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, { zh: string; en: string }> = {
    BTE: { zh: 'BTE', en: 'BTE' },
    RIC: { zh: 'RIC', en: 'RIC' },
    ITC: { zh: 'ITC', en: 'ITC' },
    ITE: { zh: 'ITE', en: 'ITE' },
    IIC: { zh: 'IIC', en: 'IIC' },
    CIC: { zh: 'CIC', en: 'CIC' },
    'IIC/CIC': { zh: 'IIC/CIC', en: 'IIC/CIC' },
    标准机: { zh: '标准机', en: 'Standard' },
    耳背机: { zh: '耳背机', en: 'Behind-the-ear' },
    定制机: { zh: '定制机', en: 'Custom' },
    '2.0受话器': { zh: '2.0受话器', en: 'Receiver 2.0' },
    '3.0受话器': { zh: '3.0受话器', en: 'Receiver 3.0' },
    充电器: { zh: '充电器', en: 'Charger' },
    耳模: { zh: '耳模', en: 'Ear mold' },
    配件: { zh: '配件', en: 'Accessory' },
    护理宝: { zh: '护理宝', en: 'Care kit' },
    同声移: { zh: '同声移', en: 'CROS' },
    Demo机: { zh: 'Demo机', en: 'Demo' },
    电池: { zh: '电池', en: 'Battery' },
  };
  return map[value]?.[isZh ? 'zh' : 'en'] ?? value;
}

function formatCurrency(value: number | string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function renderProductLabel(product: IProduct): string {
  return `${product.product_code} | ${product.category_display} | ${product.brand_display} | ${product.name_cn}`;
}

function getStockTagColor(actualStock: number, expectedStock: number): 'error' | 'warning' | 'processing' {
  if (actualStock <= 0) {
    return 'error';
  }
  if (actualStock <= Math.max(2, Math.ceil(expectedStock * 0.2))) {
    return 'warning';
  }
  return 'processing';
}

function renderInventoryPreview(record: InventoryLedgerRow, copy: InventoryCopy, isZh: boolean, locale: string): JSX.Element {
  return (
    <div className="w-[340px]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{isZh ? record.name_cn : record.name_en || record.name_cn}</div>
        <div className="mt-1 text-xs text-slate-500">{record.product_code}</div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Tag color="blue">{translateCategory(record.category || record.category_display, isZh)}</Tag>
        <Tag>{translateBrand(record.brand || record.brand_display, isZh)}</Tag>
        <Tag>{record.store_name}</Tag>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.specification}</span>
          <span className="text-right">{record.specification || record.name_en || '-'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.originalPrice}</span>
          <span>{formatCurrency(record.original_price, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.lastMonth}</span>
          <span>{record.last_month_stock}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.monthFlow}</span>
          <span>
            {record.in_this_month} / {record.out_this_month} / {record.sales_this_month}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.expected}</span>
          <span>{record.expected_stock}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.actual}</span>
          <span>{record.actual_stock}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.unit}</span>
          <span>{record.unit || '-'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.labels.remark}</span>
          <span className="max-w-[220px] text-right">{record.remark || '-'}</span>
        </div>
      </div>
    </div>
  );
}

export function InventoryListPage(): JSX.Element {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [stockInForm] = Form.useForm<StockInFormValues>();
  const [transferForm] = Form.useForm<TransferFormValues>();
  const [keyword, setKeyword] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [draggingItem, setDraggingItem] = useState<InventoryLedgerRow | null>(null);
  const [isActionDragOver, setIsActionDragOver] = useState(false);
  const [operationMode, setOperationMode] = useState<OperationMode>('transfer');
  const { settings } = useAppSettings();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const copy = useMemo(() => getInventoryCopy(isZh), [isZh]);
  const employeeStoreId = employee?.store_id ?? undefined;
  const isStoreLocked = employee?.role === 'STORE_MANAGER' || employee?.role === 'STAFF';
  const preferredAdminStore = settings.defaultStoreId ?? ALL_STORES;
  const [selectedStoreId, setSelectedStoreId] = useState<StoreFilterValue>(
    preferredAdminStore === null ? ALL_STORES : preferredAdminStore,
  );

  const [storeQuery, productQuery] = useQueries({
    queries: [
      { queryKey: ['stores'], queryFn: getStores },
      {
        queryKey: ['products', isStoreLocked ? employeeStoreId : 'all'],
        queryFn: () => getProducts(isStoreLocked ? employeeStoreId : undefined),
      },
    ],
  });

  const stores = (storeQuery.data ?? []) as IStore[];
  const products = (productQuery.data ?? []) as IProduct[];

  useEffect(() => {
    if (isStoreLocked && employeeStoreId) {
      setSelectedStoreId(employeeStoreId);
      stockInForm.setFieldsValue({
        store_id: employeeStoreId,
        transaction_date: dayjs(),
        quantity: 1,
      });
      transferForm.setFieldsValue({
        from_store_id: employeeStoreId,
        transaction_date: dayjs(),
        quantity: 1,
      });
      return;
    }

    if (!selectedStoreId) {
      setSelectedStoreId(preferredAdminStore === null ? ALL_STORES : preferredAdminStore);
      stockInForm.setFieldsValue({
        transaction_date: dayjs(),
        quantity: 1,
      });
      transferForm.setFieldsValue({
        transaction_date: dayjs(),
        quantity: 1,
      });
    }
  }, [employeeStoreId, isStoreLocked, preferredAdminStore, selectedStoreId, stockInForm, transferForm]);

  const ledgerQuery = useQuery({
    queryKey: ['inventory-ledger', selectedStoreId, keyword],
    queryFn: () =>
      getInventoryLedger({
        storeId: selectedStoreId && selectedStoreId !== ALL_STORES ? selectedStoreId : undefined,
        productName: keyword.trim() || undefined,
      }),
    enabled: Boolean(selectedStoreId),
  });

  const inventoryRows = ledgerQuery.data ?? [];

  const pagedInventoryRows = useMemo(() => {
    const pageSize = 8;
    const start = (catalogPage - 1) * pageSize;
    return inventoryRows.slice(start, start + pageSize);
  }, [catalogPage, inventoryRows]);

  const selectedStore = useMemo(() => {
    if (selectedStoreId === ALL_STORES) {
      return undefined;
    }
    return stores.find((item) => item.id === selectedStoreId);
  }, [selectedStoreId, stores]);

  const inventoryStats = useMemo(() => {
    const totalSku = inventoryRows.length;
    const totalExpected = inventoryRows.reduce((sum, item) => sum + item.expected_stock, 0);
    const totalActual = inventoryRows.reduce((sum, item) => sum + item.actual_stock, 0);
    const lowStockCount = inventoryRows.filter(
      (item) => item.actual_stock <= Math.max(2, Math.ceil(item.expected_stock * 0.2)),
    ).length;

    return { totalSku, totalExpected, totalActual, lowStockCount };
  }, [inventoryRows]);

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: item.id,
        label: renderProductLabel(item),
      })),
    [products],
  );

  const storeOptions = useMemo(
    () => [
      ...(!isStoreLocked ? [{ value: ALL_STORES, label: copy.allStores }] : []),
      ...stores.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    ],
    [copy.allStores, isStoreLocked, stores],
  );

  function syncFormsStore(nextStoreId: string | undefined): void {
    if (!nextStoreId || nextStoreId === ALL_STORES) {
      stockInForm.setFieldValue('store_id', undefined);
      transferForm.setFieldValue('from_store_id', undefined);
      return;
    }

    stockInForm.setFieldValue('store_id', nextStoreId);
    transferForm.setFieldValue('from_store_id', nextStoreId);
  }

  function handleStoreChange(value: string): void {
    if (isStoreLocked) {
      return;
    }

    setSelectedStoreId(value);
    syncFormsStore(value);
    setCatalogPage(1);
  }

  function applyInventoryItem(record: InventoryLedgerRow, mode: OperationMode): void {
    if (mode === 'stock-in') {
      stockInForm.setFieldsValue({
        product_id: record.product_id,
        store_id: isStoreLocked ? employeeStoreId : record.store_id,
        quantity: 1,
      });
      messageApi.success(copy.messages.stockInBound(isZh ? record.name_cn : record.name_en || record.name_cn));
      return;
    }

    transferForm.setFieldsValue({
      product_id: record.product_id,
      from_store_id: isStoreLocked ? employeeStoreId : record.store_id,
      quantity: 1,
    });
    messageApi.success(copy.messages.transferBound(isZh ? record.name_cn : record.name_en || record.name_cn));
  }

  function handleProductDragStart(event: DragEvent<HTMLDivElement>, record: InventoryLedgerRow): void {
    setDraggingItem(record);
    event.dataTransfer.setData('text/plain', record.inventory_id);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleProductDragEnd(): void {
    setDraggingItem(null);
    setIsActionDragOver(false);
  }

  function handleActionDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsActionDragOver(true);
  }

  function handleActionDragLeave(): void {
    setIsActionDragOver(false);
  }

  function handleActionDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsActionDragOver(false);

    if (!draggingItem) {
      return;
    }

    applyInventoryItem(draggingItem, operationMode);
    setDraggingItem(null);
  }

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, copy.messages.submitError);
  };

  const invalidateInventoryViews = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);
  };

  const stockInMutation = useMutation({
    mutationFn: (payload: StockInPayload) => stockIn(payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.stockInOk);
      stockInForm.resetFields();
      stockInForm.setFieldsValue({
        transaction_date: dayjs(),
        quantity: 1,
        store_id: isStoreLocked ? employeeStoreId : selectedStoreId === ALL_STORES ? undefined : selectedStoreId,
      });
      await invalidateInventoryViews();
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload: TransferStockPayload) => transferStock(payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.transferOk);
      transferForm.resetFields();
      transferForm.setFieldsValue({
        transaction_date: dayjs(),
        quantity: 1,
        from_store_id: isStoreLocked ? employeeStoreId : selectedStoreId === ALL_STORES ? undefined : selectedStoreId,
      });
      await invalidateInventoryViews();
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  if (storeQuery.isLoading || productQuery.isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  return (
    <>
      {messageContextHolder}

      <div className="surface-grid surface-grid--floating">
        <Card className="surface-main-card" bodyStyle={{ padding: 20 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div className="surface-summary-strip">
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.summary.currentView}</Text>
                <div className="surface-summary-value">
                  {selectedStoreId === ALL_STORES ? copy.allStores : selectedStore?.name || '-'}
                </div>
              </div>
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.summary.sku}</Text>
                <div className="surface-summary-value">{inventoryStats.totalSku}</div>
              </div>
              <div className="surface-summary-chip">
                <Text type="secondary">{copy.summary.expectedActual}</Text>
                <div className="surface-summary-value">
                  {inventoryStats.totalExpected} / {inventoryStats.totalActual}
                </div>
              </div>
              <div className="surface-summary-chip surface-summary-chip--accent">
                <Text type="secondary">{copy.summary.lowStock}</Text>
                <div className="surface-summary-value">{inventoryStats.lowStockCount}</div>
              </div>
            </div>

            <div className="surface-inline-panel">
              <Select
                placeholder={copy.placeholder.store}
                value={selectedStoreId}
                onChange={handleStoreChange}
                disabled={isStoreLocked}
                options={storeOptions}
              />
              <Input
                className="toolbar-search-wide"
                allowClear
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setCatalogPage(1);
                }}
                prefix={<SearchOutlined />}
                placeholder={copy.placeholder.search}
              />
            </div>

            {ledgerQuery.isLoading || ledgerQuery.isFetching ? (
              <Skeleton active paragraph={{ rows: 10 }} />
            ) : inventoryRows.length > 0 ? (
              <div className="catalog-list">
                {pagedInventoryRows.map((record) => (
                  <div
                    key={record.inventory_id}
                    draggable
                    onDragStart={(event) => handleProductDragStart(event, record)}
                    onDragEnd={handleProductDragEnd}
                    className={`catalog-card${draggingItem?.inventory_id === record.inventory_id ? ' catalog-card--active' : ''}`}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="catalog-card-grid">
                      <HolderOutlined style={{ color: '#94a3b8', fontSize: 16 }} />

                      <div className="catalog-card-main">
                        <Popover placement="rightTop" content={renderInventoryPreview(record, copy, isZh, locale)} trigger="hover">
                          <div className="cursor-pointer">
                            <Text className="catalog-card-title">{isZh ? record.name_cn : record.name_en || record.name_cn}</Text>
                            <Text className="catalog-card-code">{record.product_code}</Text>
                            <Text className="catalog-card-spec">
                              {record.specification || record.name_en || copy.placeholder.emptySpec}
                            </Text>
                          </div>
                        </Popover>
                        <Space size={[8, 8]} wrap className="catalog-card-tags">
                          <Tag color="blue">{translateCategory(record.category || record.category_display, isZh)}</Tag>
                          <Tag>{translateBrand(record.brand || record.brand_display, isZh)}</Tag>
                          <Tag>{record.store_name}</Tag>
                        </Space>
                      </div>

                      <div className="catalog-card-metric">
                        <Text className="catalog-card-value">{formatCurrency(record.original_price, locale)}</Text>
                        <Text className="catalog-card-subvalue">
                          {copy.labels.actualExpected} {record.actual_stock} · {record.expected_stock}
                        </Text>
                        <Tag color={getStockTagColor(record.actual_stock, record.expected_stock)} style={{ marginTop: 10 }}>
                          {record.actual_stock <= 0
                            ? copy.messages.outOfStock
                            : record.actual_stock <= Math.max(2, Math.ceil(record.expected_stock * 0.2))
                              ? copy.messages.lowStock
                              : copy.messages.normal}
                        </Tag>
                      </div>

                      <div className="catalog-card-actions">
                        <Space size={8}>
                          <Button
                            className="catalog-card-action-btn"
                            type="default"
                            onClick={() => applyInventoryItem(record, 'stock-in')}
                          >
                            {copy.actions.useStockIn}
                          </Button>
                          <Button
                            className="catalog-card-action-btn"
                            type="primary"
                            onClick={() => applyInventoryItem(record, 'transfer')}
                          >
                            {copy.actions.useTransfer}
                          </Button>
                        </Space>
                      </div>
                    </div>
                  </div>
                ))}
                {inventoryRows.length > 8 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text type="secondary">
                      {copy.messages.pageSummary(
                        Math.min((catalogPage - 1) * 8 + 1, inventoryRows.length),
                        Math.min(catalogPage * 8, inventoryRows.length),
                        inventoryRows.length,
                      )}
                    </Text>
                    <Pagination
                      size="small"
                      current={catalogPage}
                      pageSize={8}
                      total={inventoryRows.length}
                      onChange={(page) => setCatalogPage(page)}
                      showSizeChanger={false}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <Empty description={copy.messages.inventoryEmpty} />
            )}
          </Space>
        </Card>

        <div className="floating-side-panel floating-side-panel--fixed">
          <Card className="floating-side-panel-card" bodyStyle={{ padding: 18 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={8}>
                  <DatabaseOutlined />
                  <Text strong style={{ color: '#0f172a' }}>
                    {copy.panel.inventoryAction}
                  </Text>
                </Space>
                <Segmented<OperationMode>
                  value={operationMode}
                  onChange={(value) => setOperationMode(value)}
                  options={[
                    { label: copy.panel.stockIn, value: 'stock-in' },
                    { label: copy.panel.transfer, value: 'transfer' },
                  ]}
                />
              </div>

              <div
                onDragOver={handleActionDragOver}
                onDragLeave={handleActionDragLeave}
                onDrop={handleActionDrop}
                style={{
                  borderRadius: 16,
                  border: isActionDragOver ? '1px solid #93c5fd' : '1px dashed #cbd5e1',
                  background: isActionDragOver ? '#f8faff' : '#fbfcfe',
                  padding: 14,
                  transition: 'all 0.18s ease',
                }}
              >
                <Space size={8}>
                  <InboxOutlined />
                  <Text strong style={{ color: '#0f172a' }}>
                    {operationMode === 'stock-in' ? copy.panel.stockInPanel : copy.panel.transferPanel}
                  </Text>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  {copy.panel.dragHint}
                </Text>
              </div>

              {operationMode === 'stock-in' ? (
                <Form<StockInFormValues>
                  layout="vertical"
                  form={stockInForm}
                  initialValues={{
                    transaction_date: dayjs(),
                    store_id: isStoreLocked ? employeeStoreId : selectedStoreId === ALL_STORES ? undefined : selectedStoreId,
                    quantity: 1,
                  }}
                  onFinish={(values) =>
                    stockInMutation.mutate({
                      store_id: values.store_id as string,
                      product_id: values.product_id,
                      quantity: values.quantity,
                      transaction_date: values.transaction_date.toISOString(),
                      remark: values.remark?.trim() || undefined,
                    })
                  }
                >
                  <Form.Item
                    name="transaction_date"
                    label={copy.labels.stockInDate}
                    rules={[{ required: true, message: isZh ? '请选择入库日期' : 'Please select a stock-in date' }]}
                  >
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                  <Form.Item
                    name="store_id"
                    label={copy.labels.stockInStore}
                    rules={[{ required: true, message: isZh ? '请选择门店' : 'Please select a store' }]}
                  >
                    <Select placeholder={copy.placeholder.stockInStore} options={stores.map((item) => ({ value: item.id, label: item.name }))} disabled={isStoreLocked} />
                  </Form.Item>
                  <Form.Item name="product_id" label={copy.labels.product} rules={[{ required: true, message: isZh ? '请选择商品' : 'Please select a product' }]}>
                    <Select showSearch placeholder={copy.placeholder.product} optionFilterProp="label" options={productOptions} />
                  </Form.Item>
                  <Form.Item
                    name="quantity"
                    label={copy.labels.stockInQty}
                    rules={[{ required: true, message: isZh ? '请输入入库数量' : 'Please enter a quantity' }]}
                  >
                    <InputNumber min={1} precision={0} className="w-full" />
                  </Form.Item>
                  <Form.Item name="remark" label={copy.labels.notes}>
                    <Input.TextArea rows={4} placeholder={copy.placeholder.stockInNotes} />
                  </Form.Item>

                  <Button type="primary" size="large" block icon={<PlusOutlined />} htmlType="submit" loading={stockInMutation.isPending}>
                    {copy.actions.confirmStockIn}
                  </Button>
                </Form>
              ) : (
                <Form<TransferFormValues>
                  layout="vertical"
                  form={transferForm}
                  initialValues={{
                    transaction_date: dayjs(),
                    from_store_id: isStoreLocked ? employeeStoreId : selectedStoreId === ALL_STORES ? undefined : selectedStoreId,
                    quantity: 1,
                  }}
                  onFinish={(values) =>
                    transferMutation.mutate({
                      from_store_id: values.from_store_id as string,
                      to_store_id: values.to_store_id,
                      product_id: values.product_id,
                      quantity: values.quantity,
                      transaction_date: values.transaction_date.toISOString(),
                      remark: values.remark?.trim() || undefined,
                    })
                  }
                >
                  <Form.Item
                    name="transaction_date"
                    label={copy.labels.transferDate}
                    rules={[{ required: true, message: isZh ? '请选择调拨日期' : 'Please select a transfer date' }]}
                  >
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                  <Form.Item
                    name="from_store_id"
                    label={copy.labels.fromStore}
                    rules={[{ required: true, message: isZh ? '请选择调出门店' : 'Please select a source store' }]}
                  >
                    <Select placeholder={copy.placeholder.transferFrom} options={stores.map((item) => ({ value: item.id, label: item.name }))} disabled={isStoreLocked} />
                  </Form.Item>
                  <Form.Item
                    name="to_store_id"
                    label={copy.labels.toStore}
                    rules={[
                      { required: true, message: isZh ? '请选择调入门店' : 'Please select a destination store' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || value !== getFieldValue('from_store_id')) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error(copy.messages.duplicateStore));
                        },
                      }),
                    ]}
                  >
                    <Select placeholder={copy.placeholder.transferTo} options={stores.map((item) => ({ value: item.id, label: item.name }))} />
                  </Form.Item>
                  <Form.Item name="product_id" label={copy.labels.product} rules={[{ required: true, message: isZh ? '请选择商品' : 'Please select a product' }]}>
                    <Select showSearch placeholder={copy.placeholder.product} optionFilterProp="label" options={productOptions} />
                  </Form.Item>
                  <Form.Item
                    name="quantity"
                    label={copy.labels.transferQty}
                    rules={[{ required: true, message: isZh ? '请输入调拨数量' : 'Please enter a quantity' }]}
                  >
                    <InputNumber min={1} precision={0} className="w-full" />
                  </Form.Item>
                  <Form.Item name="remark" label={copy.labels.notes}>
                    <Input.TextArea rows={4} placeholder={copy.placeholder.transferNotes} />
                  </Form.Item>

                  <Button type="primary" size="large" block icon={<ArrowRightOutlined />} htmlType="submit" loading={transferMutation.isPending}>
                    {copy.actions.confirmTransfer}
                  </Button>
                </Form>
              )}
            </Space>
          </Card>
        </div>
      </div>
    </>
  );
}
