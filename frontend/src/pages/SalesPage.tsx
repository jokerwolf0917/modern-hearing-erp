import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popover,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomers, type ICustomer } from '../services/customer';
import { getStockSummary, type StockSummaryItem } from '../services/inventory';
import { createOrder } from '../services/order';
import { getStores, type IStore } from '../services/store';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Paragraph, Text } = Typography;

interface CartItem {
  product_id: string;
  product_code: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  name_cn: string;
  name_en: string | null;
  specification: string | null;
  unit_price: number;
  stock: number;
  quantity: number;
}

interface SalesCopy {
  labels: {
    category: string;
    brand: string;
    specification: string;
    stock: string;
    originalPrice: string;
    store: string;
    unit: string;
    quantity: string;
    saleableStock: string;
    unitPrice: string;
    subtotal: string;
    currentStore: string;
    customer: string;
    cart: string;
    lines: string;
    items: string;
    amount: string;
    summaryNote: string;
  };
  placeholder: {
    store: string;
    search: string;
    customer: string;
    emptySpec: string;
  };
  actions: {
    add: string;
    checkout: string;
    goOrders: string;
  };
  messages: {
    addLimit: string;
    created: string;
    createdTitle: string;
    createdContent: string;
    selectStore: string;
    selectCustomer: string;
    selectItems: string;
    createError: string;
    inventoryEmpty: string;
    dragEmpty: string;
    pageSummary: (from: number, to: number, total: number) => string;
  };
  summary: {
    currentStore: string;
    saleableSku: string;
    cartItems: string;
  };
}

function getSalesCopy(isZh: boolean): SalesCopy {
  if (isZh) {
    return {
      labels: {
        category: '类别',
        brand: '品牌',
        specification: '规格',
        stock: '当前库存',
        originalPrice: '原价',
        store: '门店',
        unit: '单位',
        quantity: '数量',
        saleableStock: '可售库存',
        unitPrice: '单价',
        subtotal: '小计',
        currentStore: '当前门店',
        customer: '客户',
        cart: '购物车',
        lines: '商品行数',
        items: '商品件数',
        amount: '应收金额',
        summaryNote: '提交后会同步生成订单、扣减库存，并写入销售流水。',
      },
      placeholder: {
        store: '选择门店',
        search: '搜索产品编号、名称、品牌、类别或规格',
        customer: '请选择客户',
        emptySpec: '暂无规格说明',
      },
      actions: {
        add: '加入',
        checkout: '确认收款并登记销售',
        goOrders: '前往订单记录',
      },
      messages: {
        addLimit: '购物车数量不能超过当前库存',
        created: '销售流水已登记，库存同步扣减',
        createdTitle: '销售单创建成功',
        createdContent: '订单、库存和销售流水已同步写入，可前往订单记录继续查看。',
        selectStore: '请先选择门店',
        selectCustomer: '请选择客户',
        selectItems: '请先加入商品',
        createError: '销售开单失败，请稍后重试',
        inventoryEmpty: '当前筛选条件下暂无可售库存',
        dragEmpty: '将左侧商品拖到这里，或点击加入',
        pageSummary: (from, to, total) => `显示 ${from} - ${to} / ${total} 件商品`,
      },
      summary: {
        currentStore: '当前门店',
        saleableSku: '可售 SKU',
        cartItems: '购物车件数',
      },
    };
  }

  return {
    labels: {
      category: 'Category',
      brand: 'Brand',
      specification: 'Specification',
      stock: 'In stock',
      originalPrice: 'Original price',
      store: 'Store',
      unit: 'Unit',
      quantity: 'Quantity',
      saleableStock: 'Saleable stock',
      unitPrice: 'Unit price',
      subtotal: 'Subtotal',
      currentStore: 'Current store',
      customer: 'Customer',
      cart: 'Cart',
      lines: 'Line items',
      items: 'Units',
      amount: 'Total due',
      summaryNote: 'Submitting creates the order, deducts inventory, and writes a sale transaction.',
    },
    placeholder: {
      store: 'Select store',
      search: 'Search by code, name, brand, category or specification',
      customer: 'Select customer',
      emptySpec: 'No specification provided',
    },
    actions: {
      add: 'Add',
      checkout: 'Confirm payment and record sale',
      goOrders: 'Open orders',
    },
    messages: {
      addLimit: 'Cart quantity cannot exceed available stock',
      created: 'Sale recorded and inventory updated',
      createdTitle: 'Sale created',
      createdContent: 'The order, inventory change, and sales transaction were saved successfully.',
      selectStore: 'Please select a store first',
      selectCustomer: 'Please select a customer',
      selectItems: 'Please add at least one product',
      createError: 'Failed to create the sales order. Please try again.',
      inventoryEmpty: 'No saleable inventory matches the current filters',
      dragEmpty: 'Drag products here from the left, or click Add',
      pageSummary: (from, to, total) => `Showing ${from} - ${to} of ${total} products`,
    },
    summary: {
      currentStore: 'Current store',
      saleableSku: 'Saleable SKUs',
      cartItems: 'Cart units',
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

function getStockTagColor(quantity: number): 'error' | 'warning' | 'processing' {
  if (quantity <= 2) {
    return 'error';
  }
  if (quantity <= 5) {
    return 'warning';
  }
  return 'processing';
}

function renderInventoryPreview(record: StockSummaryItem, copy: SalesCopy, isZh: boolean, locale: string): JSX.Element {
  return (
    <div style={{ width: 320 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 15 }}>
            {isZh ? record.name_cn : record.name_en || record.name_cn}
          </Text>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {record.product_code}
          </Text>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '96px 1fr',
            rowGap: 8,
            columnGap: 10,
            fontSize: 13,
          }}
        >
          <Text type="secondary">{copy.labels.category}</Text>
          <Text>{translateCategory(record.category || record.category_display, isZh)}</Text>
          <Text type="secondary">{copy.labels.brand}</Text>
          <Text>{translateBrand(record.brand || record.brand_display, isZh)}</Text>
          <Text type="secondary">{copy.labels.specification}</Text>
          <Text>{record.specification || record.name_en || '-'}</Text>
          <Text type="secondary">{copy.labels.stock}</Text>
          <Text>{record.quantity}</Text>
          <Text type="secondary">{copy.labels.originalPrice}</Text>
          <Text>{formatCurrency(toPrice(record.original_price), locale)}</Text>
          <Text type="secondary">{copy.labels.store}</Text>
          <Text>{record.store_name}</Text>
          <Text type="secondary">{copy.labels.unit}</Text>
          <Text>{record.unit || '-'}</Text>
        </div>
      </Space>
    </div>
  );
}

function renderCartItemPreview(
  item: CartItem,
  storeName: string | undefined,
  copy: SalesCopy,
  isZh: boolean,
  locale: string,
): JSX.Element {
  return (
    <div style={{ width: 320 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 15 }}>
            {item.name_cn}
          </Text>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {item.product_code}
          </Text>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '96px 1fr',
            rowGap: 8,
            columnGap: 10,
            fontSize: 13,
          }}
        >
          <Text type="secondary">{copy.labels.category}</Text>
          <Text>{translateCategory(item.category || item.category_display, isZh)}</Text>
          <Text type="secondary">{copy.labels.brand}</Text>
          <Text>{translateBrand(item.brand || item.brand_display, isZh)}</Text>
          <Text type="secondary">{copy.labels.specification}</Text>
          <Text>{item.specification || '-'}</Text>
          <Text type="secondary">{copy.labels.quantity}</Text>
          <Text>{item.quantity}</Text>
          <Text type="secondary">{copy.labels.saleableStock}</Text>
          <Text>{item.stock}</Text>
          <Text type="secondary">{copy.labels.unitPrice}</Text>
          <Text>{formatCurrency(item.unit_price, locale)}</Text>
          <Text type="secondary">{copy.labels.subtotal}</Text>
          <Text>{formatCurrency(item.unit_price * item.quantity, locale)}</Text>
          <Text type="secondary">{copy.labels.currentStore}</Text>
          <Text>{storeName || '-'}</Text>
        </div>
      </Space>
    </div>
  );
}

export function SalesPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedStoreId, setSelectedStoreId] = useState<string>();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();
  const [productKeyword, setProductKeyword] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
  const [isCartDragOver, setIsCartDragOver] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const copy = useMemo(() => getSalesCopy(isZh), [isZh]);

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

  const stores = (storeQuery.data ?? []) as IStore[];
  const stockSummary = (stockSummaryQuery.data ?? []) as StockSummaryItem[];
  const customers = customerQuery.data?.items ?? [];
  const isLoading = storeQuery.isLoading || stockSummaryQuery.isLoading || customerQuery.isLoading;
  const isStoreLocked = employee?.role === 'STORE_MANAGER' || employee?.role === 'STAFF';
  const preferredAdminStoreId =
    settings.defaultStoreId && settings.defaultStoreId !== 'ALL' ? settings.defaultStoreId : undefined;

  useEffect(() => {
    if (isStoreLocked && employee?.store_id) {
      setSelectedStoreId(employee.store_id);
      return;
    }

    if (!selectedStoreId && stores.length > 0) {
      const preferredStore = stores.find((item) => item.id === preferredAdminStoreId);
      setSelectedStoreId(preferredStore?.id ?? stores[0].id);
    }
  }, [employee?.store_id, isStoreLocked, preferredAdminStoreId, selectedStoreId, stores]);

  const visibleStores = useMemo(() => {
    if (isStoreLocked && employee?.store_id) {
      return stores.filter((item) => item.id === employee.store_id);
    }
    return stores;
  }, [employee?.store_id, isStoreLocked, stores]);

  const selectedStore = useMemo(
    () => visibleStores.find((item) => item.id === selectedStoreId),
    [selectedStoreId, visibleStores],
  );

  const selectedCustomer = useMemo(
    () => customers.find((item: ICustomer) => item.id === selectedCustomerId),
    [customers, selectedCustomerId],
  );

  const currentStoreInventory = useMemo(
    () => stockSummary.filter((item) => item.store_id === selectedStoreId && item.quantity > 0),
    [selectedStoreId, stockSummary],
  );

  const filteredInventory = useMemo(() => {
    const keyword = productKeyword.trim().toLowerCase();
    if (!keyword) {
      return currentStoreInventory;
    }

    return currentStoreInventory.filter((item) =>
      [
        item.product_code,
        item.name_cn,
        item.name_en,
        item.category_display,
        item.brand_display,
        item.specification,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [currentStoreInventory, productKeyword]);

  const pagedInventory = useMemo(() => {
    const pageSize = 8;
    const start = (catalogPage - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [catalogPage, filteredInventory]);

  const inventorySkuCount = filteredInventory.length;
  const cartLineCount = cartItems.length;
  const cartUnitCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, copy.messages.createError);
  };

  function handleAddToCart(record: StockSummaryItem): void {
    setCartItems((current) => {
      const existingItem = current.find((item) => item.product_id === record.product_id);
      if (existingItem) {
        if (existingItem.quantity >= existingItem.stock) {
          messageApi.warning(copy.messages.addLimit);
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
          product_code: record.product_code,
          category: record.category,
          category_display: record.category_display,
          brand: record.brand,
          brand_display: record.brand_display,
          name_cn: record.name_cn,
          name_en: record.name_en,
          specification: record.specification,
          unit_price: toPrice(record.original_price),
          stock: record.quantity,
          quantity: 1,
        },
      ];
    });
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
    setCatalogPage(1);
  }

  function handleProductDragStart(event: DragEvent<HTMLDivElement>, record: StockSummaryItem): void {
    setDraggingProductId(record.product_id);
    event.dataTransfer.setData('text/plain', record.product_id);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleProductDragEnd(): void {
    setDraggingProductId(null);
    setIsCartDragOver(false);
  }

  function handleCartDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsCartDragOver(true);
  }

  function handleCartDragLeave(): void {
    setIsCartDragOver(false);
  }

  function handleCartDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsCartDragOver(false);

    const productId = event.dataTransfer.getData('text/plain') || draggingProductId;
    if (!productId) {
      return;
    }

    const record = currentStoreInventory.find((item) => item.product_id === productId);
    if (!record) {
      return;
    }

    handleAddToCart(record);
    setDraggingProductId(null);
  }

  const createOrderMutation = useMutation({
    mutationFn: () =>
      createOrder({
        customer_id: selectedCustomerId!,
        store_id: selectedStoreId!,
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          sn_codes: [],
        })),
      }),
    onSuccess: async () => {
      messageApi.success(copy.messages.created);
      setCartItems([]);
      setSelectedCustomerId(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);

      Modal.success({
        title: copy.messages.createdTitle,
        content: copy.messages.createdContent,
        okText: copy.actions.goOrders,
        onOk: () => navigate('/orders'),
      });
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  async function handleCheckout(): Promise<void> {
    if (!selectedStoreId) {
      messageApi.warning(copy.messages.selectStore);
      return;
    }

    if (!selectedCustomerId) {
      messageApi.warning(copy.messages.selectCustomer);
      return;
    }

    if (cartItems.length === 0) {
      messageApi.warning(copy.messages.selectItems);
      return;
    }

    await createOrderMutation.mutateAsync();
  }

  return (
    <>
      {contextHolder}

      <div className="page-stack" style={{ gap: 18 }}>
        {isLoading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <div className="surface-grid surface-grid--floating">
            <Card className="surface-main-card" bodyStyle={{ padding: 20 }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div className="surface-summary-strip">
                  <div className="surface-summary-chip">
                    <Text type="secondary">{copy.summary.currentStore}</Text>
                    <div className="surface-summary-value">{selectedStore?.name || '-'}</div>
                  </div>
                  <div className="surface-summary-chip">
                    <Text type="secondary">{copy.summary.saleableSku}</Text>
                    <div className="surface-summary-value">{inventorySkuCount}</div>
                  </div>
                  <div className="surface-summary-chip surface-summary-chip--accent">
                    <Text type="secondary">{copy.summary.cartItems}</Text>
                    <div className="surface-summary-value">{cartUnitCount}</div>
                  </div>
                </div>

                <div className="surface-inline-panel">
                  <Select
                    placeholder={copy.placeholder.store}
                    value={selectedStoreId}
                    onChange={handleStoreChange}
                    disabled={isStoreLocked}
                    options={visibleStores.map((item) => ({ value: item.id, label: item.name }))}
                  />
                  <Input
                    className="toolbar-search-wide"
                    allowClear
                    value={productKeyword}
                    onChange={(event) => {
                      setProductKeyword(event.target.value);
                      setCatalogPage(1);
                    }}
                    prefix={<SearchOutlined />}
                    placeholder={copy.placeholder.search}
                  />
                </div>

                {filteredInventory.length > 0 ? (
                  <div className="catalog-list">
                    {pagedInventory.map((record) => (
                      <div
                        key={record.inventory_id}
                        className={`catalog-card${draggingProductId === record.product_id ? ' catalog-card--active' : ''}`}
                        draggable
                        onDragStart={(event) => handleProductDragStart(event, record)}
                        onDragEnd={handleProductDragEnd}
                      >
                        <div className="catalog-card-grid">
                          <HolderOutlined style={{ color: '#94a3b8', fontSize: 16 }} />

                          <Popover
                            placement="rightTop"
                            trigger="hover"
                            mouseEnterDelay={0.12}
                            content={renderInventoryPreview(record, copy, isZh, locale)}
                          >
                            <div className="catalog-card-main">
                              <Text className="catalog-card-title">{isZh ? record.name_cn : record.name_en || record.name_cn}</Text>
                              <Text className="catalog-card-code">{record.product_code}</Text>
                              <Text className="catalog-card-spec">
                                {record.specification || record.name_en || copy.placeholder.emptySpec}
                              </Text>
                              <Space size={[8, 8]} wrap className="catalog-card-tags">
                                <Tag color="blue">{translateCategory(record.category || record.category_display, isZh)}</Tag>
                                <Tag>{translateBrand(record.brand || record.brand_display, isZh)}</Tag>
                              </Space>
                            </div>
                          </Popover>

                          <div className="catalog-card-metric">
                            <Text className="catalog-card-value">
                              {formatCurrency(toPrice(record.original_price), locale)}
                            </Text>
                            <Text className="catalog-card-subvalue">{copy.labels.stock} {record.quantity}</Text>
                            <Tag color={getStockTagColor(record.quantity)} style={{ marginTop: 10 }}>
                              {isZh ? `${record.quantity} 件` : `${record.quantity} pcs`}
                            </Tag>
                          </div>

                          <div className="catalog-card-actions">
                            <Button
                              className="catalog-card-action-btn"
                              type="default"
                              icon={<PlusOutlined />}
                              onClick={() => handleAddToCart(record)}
                            >
                              {copy.actions.add}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredInventory.length > 8 ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text type="secondary">
                          {copy.messages.pageSummary(
                            Math.min((catalogPage - 1) * 8 + 1, filteredInventory.length),
                            Math.min(catalogPage * 8, filteredInventory.length),
                            filteredInventory.length,
                          )}
                        </Text>
                        <Pagination
                          size="small"
                          current={catalogPage}
                          pageSize={8}
                          total={filteredInventory.length}
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
                  <div
                    style={{
                      borderRadius: 14,
                      padding: 14,
                      background: '#f8faff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Text type="secondary">{copy.labels.customer}</Text>
                    <Select
                      showSearch
                      value={selectedCustomerId}
                      loading={customerQuery.isLoading}
                      onChange={(value) => setSelectedCustomerId(value)}
                      optionFilterProp="label"
                      placeholder={copy.placeholder.customer}
                      style={{ marginTop: 10, width: '100%' }}
                      suffixIcon={<UserOutlined />}
                      options={customers.map((item: ICustomer) => ({
                        value: item.id,
                        label: `${item.name} | ${item.phone}`,
                      }))}
                    />
                    {selectedCustomer ? (
                      <Text type="secondary" style={{ marginTop: 10, display: 'block', fontSize: 12 }}>
                        {selectedCustomer.name} · {selectedCustomer.phone}
                      </Text>
                    ) : null}
                  </div>

                  <div
                    onDragOver={handleCartDragOver}
                    onDragLeave={handleCartDragLeave}
                    onDrop={handleCartDrop}
                    style={{
                      borderRadius: 18,
                      border: isCartDragOver ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                      background: isCartDragOver ? '#f8faff' : '#fbfcfe',
                      padding: 14,
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: cartItems.length > 0 ? 12 : 0,
                      }}
                    >
                      <Space size={8}>
                        <ShoppingCartOutlined />
                        <Text strong style={{ color: '#0f172a' }}>
                          {copy.labels.cart}
                        </Text>
                      </Space>
                      <Text type="secondary">{isZh ? `${cartLineCount} 项` : `${cartLineCount} lines`}</Text>
                    </div>

                    {cartItems.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {cartItems.map((item) => (
                          <div
                            key={item.product_id}
                            style={{
                              borderRadius: 14,
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 12,
                              }}
                            >
                              <Popover
                                placement="leftTop"
                                trigger="hover"
                                mouseEnterDelay={0.12}
                                content={renderCartItemPreview(item, selectedStore?.name, copy, isZh, locale)}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <Text strong style={{ display: 'block', color: '#0f172a' }}>
                                    {isZh ? item.name_cn : item.name_en || item.name_cn}
                                  </Text>
                                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                                    {item.product_code} · {translateBrand(item.brand || item.brand_display, isZh)}
                                  </Text>
                                </div>
                              </Popover>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveFromCart(item.product_id)}
                              />
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                display: 'grid',
                                gridTemplateColumns: '88px 1fr auto',
                                gap: 10,
                                alignItems: 'center',
                              }}
                            >
                              <InputNumber
                                min={1}
                                max={item.stock}
                                precision={0}
                                style={{ width: '100%' }}
                                value={item.quantity}
                                onChange={(value) => updateCartQuantity(item.product_id, Number(value ?? 1))}
                              />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {copy.labels.unitPrice} {formatCurrency(item.unit_price, locale)}
                              </Text>
                              <Text strong style={{ color: '#0f172a' }}>
                                {formatCurrency(item.unit_price * item.quantity, locale)}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '18px 8px 6px' }}>
                        <Empty description={copy.messages.dragEmpty} />
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      padding: 16,
                      background: '#f8faff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">{copy.labels.lines}</Text>
                      <Text strong>{cartLineCount}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text type="secondary">{copy.labels.items}</Text>
                      <Text strong>{cartUnitCount}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text type="secondary">{copy.labels.amount}</Text>
                      <Text strong style={{ fontSize: 28, color: '#0f172a' }}>
                        {formatCurrency(totalAmount, locale)}
                      </Text>
                    </div>
                    <Paragraph style={{ marginTop: 10, marginBottom: 0, color: '#64748b', lineHeight: 1.7 }}>
                      {copy.labels.summaryNote}
                    </Paragraph>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={createOrderMutation.isPending}
                    onClick={() => void handleCheckout()}
                  >
                    {copy.actions.checkout}
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
