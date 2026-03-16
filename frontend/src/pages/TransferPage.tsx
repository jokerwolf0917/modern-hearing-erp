import { useMutation, useQueries } from '@tanstack/react-query';
import { Button, Card, Form, InputNumber, Select, Skeleton, Tabs, Typography, message } from 'antd';
import type { AxiosError } from 'axios';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { getProducts, type IProduct } from '../services/product';
import { getStores, type IStore } from '../services/store';
import { stockIn, transferStock, type StockInPayload, type TransferStockPayload } from '../services/inventory';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Paragraph, Text } = Typography;

interface StockInFormValues {
  store_id: string;
  product_id: string;
  quantity: number;
}

interface TransferFormValues {
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
}

export function TransferPage(): JSX.Element {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [stockInForm] = Form.useForm<StockInFormValues>();
  const [transferForm] = Form.useForm<TransferFormValues>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    pageTitle: isZh ? '库存调拨演示' : 'Inventory Transfer Demo',
    pageExtra: isZh ? '使用真实门店与商品主数据进行入库和调拨' : 'Use live stores and products for stock-in and transfer flows',
    submitFailed: isZh ? '提交失败，请稍后重试。' : 'Submission failed. Please try again later.',
    stockInSuccess: isZh ? '商品入库成功' : 'Stock-in completed successfully.',
    transferSuccess: isZh ? '调拨发起成功' : 'Transfer created successfully.',
    tabStockIn: isZh ? '商品入库' : 'Stock In',
    tabTransfer: isZh ? '门店调拨' : 'Store Transfer',
    store: isZh ? '门店' : 'Store',
    stockInStorePlaceholder: isZh ? '请选择入库门店' : 'Select store for stock-in',
    sourceStore: isZh ? '调出门店' : 'Source Store',
    sourceStorePlaceholder: isZh ? '请选择调出门店' : 'Select source store',
    targetStore: isZh ? '调入门店' : 'Target Store',
    targetStorePlaceholder: isZh ? '请选择调入门店' : 'Select target store',
    product: isZh ? '商品' : 'Product',
    productPlaceholder: isZh ? '请选择商品' : 'Select product',
    productExtra: isZh ? '商品选项来自商品管理模块的真实数据。' : 'Options come from the live product master data.',
    stockInQuantity: isZh ? '入库数量' : 'Stock-in Quantity',
    transferQuantity: isZh ? '调拨数量' : 'Transfer Quantity',
    quantityPlaceholder: isZh ? '请输入数量' : 'Enter quantity',
    stockInSubmit: isZh ? '提交入库' : 'Submit Stock In',
    transferSubmit: isZh ? '发起调拨' : 'Create Transfer',
    chooseStore: isZh ? '请选择门店' : 'Please select a store.',
    chooseSourceStore: isZh ? '请选择调出门店' : 'Please select a source store.',
    chooseTargetStore: isZh ? '请选择调入门店' : 'Please select a target store.',
    chooseProduct: isZh ? '请选择商品' : 'Please select a product.',
    enterStockInQuantity: isZh ? '请输入入库数量' : 'Please enter stock-in quantity.',
    enterTransferQuantity: isZh ? '请输入调拨数量' : 'Please enter transfer quantity.',
    differentStore: isZh ? '调入门店不能与调出门店相同' : 'Target store must be different from source store.',
    emptyDataTitle: isZh ? '当前缺少基础主数据：' : 'Required master data is missing:',
    emptyDataDescription: isZh
      ? '请先在“门店管理”和“商品管理”页面中创建至少 1 个门店和 1 个商品。'
      : 'Create at least one store and one product in Store Management and Product Management first.',
  };

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, copy.submitFailed);
  };

  const [storeQuery, productQuery] = useQueries({
    queries: [
      { queryKey: ['stores'], queryFn: getStores },
      { queryKey: ['products'], queryFn: getProducts },
    ],
  });

  const stores = (storeQuery.data ?? []) as IStore[];
  const products = (productQuery.data ?? []) as IProduct[];
  const isOptionsLoading = storeQuery.isLoading || productQuery.isLoading;

  useEffect(() => {
    if (stores.length > 0 && products.length > 0) {
      const firstStoreId = stores[0]?.id;
      const secondStoreId = stores[1]?.id ?? stores[0]?.id;
      const firstProductId = products[0]?.id;

      if (firstStoreId && firstProductId) {
        stockInForm.setFieldsValue({
          store_id: stockInForm.getFieldValue('store_id') ?? firstStoreId,
          product_id: stockInForm.getFieldValue('product_id') ?? firstProductId,
          quantity: stockInForm.getFieldValue('quantity') ?? 1,
        });

        transferForm.setFieldsValue({
          from_store_id: transferForm.getFieldValue('from_store_id') ?? firstStoreId,
          to_store_id: transferForm.getFieldValue('to_store_id') ?? secondStoreId,
          product_id: transferForm.getFieldValue('product_id') ?? firstProductId,
          quantity: transferForm.getFieldValue('quantity') ?? 1,
        });
      }
    }
  }, [products, stockInForm, stores, transferForm]);

  const stockInMutation = useMutation({
    mutationFn: (payload: StockInPayload) => stockIn(payload),
    onSuccess: () => {
      messageApi.success(copy.stockInSuccess);
      stockInForm.resetFields();
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload: TransferStockPayload) => transferStock(payload),
    onSuccess: () => {
      messageApi.success(copy.transferSuccess);
      transferForm.resetFields();
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  const storeOptions = stores.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const productOptions = products.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const handleStockInSubmit = async (values: StockInFormValues): Promise<void> => {
    if (stockInMutation.isPending) {
      return;
    }

    try {
      await stockInMutation.mutateAsync(values);
    } catch {
      // handled by mutation
    }
  };

  const handleTransferSubmit = async (values: TransferFormValues): Promise<void> => {
    if (transferMutation.isPending) {
      return;
    }

    try {
      await transferMutation.mutateAsync(values);
    } catch {
      // handled by mutation
    }
  };

  return (
    <>
      {messageContextHolder}

      <Card className="rounded-2xl shadow-sm" title={copy.pageTitle} extra={<span className="text-slate-500">{copy.pageExtra}</span>}>
        {isOptionsLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Tabs
            defaultActiveKey="stock-in"
            items={[
              {
                key: 'stock-in',
                label: copy.tabStockIn,
                children: (
                  <div className="max-w-2xl pt-2">
                    <Form<StockInFormValues>
                      form={stockInForm}
                      layout="vertical"
                      initialValues={{ quantity: 1 }}
                      onFinish={(values) => void handleStockInSubmit(values)}
                    >
                      <Form.Item label={copy.store} name="store_id" rules={[{ required: true, message: copy.chooseStore }]}>
                        <Select options={storeOptions} placeholder={copy.stockInStorePlaceholder} />
                      </Form.Item>

                      <Form.Item
                        label={copy.product}
                        name="product_id"
                        rules={[{ required: true, message: copy.chooseProduct }]}
                        extra={<Text type="secondary">{copy.productExtra}</Text>}
                      >
                        <Select showSearch options={productOptions} placeholder={copy.productPlaceholder} optionFilterProp="label" />
                      </Form.Item>

                      <Form.Item label={copy.stockInQuantity} name="quantity" rules={[{ required: true, message: copy.enterStockInQuantity }]}>
                        <InputNumber className="w-full" min={1} precision={0} placeholder={copy.quantityPlaceholder} />
                      </Form.Item>

                      <Form.Item className="!mb-0">
                        <Button type="primary" htmlType="submit" loading={stockInMutation.isPending} disabled={stockInMutation.isPending}>
                          {copy.stockInSubmit}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
              {
                key: 'transfer',
                label: copy.tabTransfer,
                children: (
                  <div className="max-w-2xl pt-2">
                    <Form<TransferFormValues>
                      form={transferForm}
                      layout="vertical"
                      initialValues={{ quantity: 1 }}
                      onFinish={(values) => void handleTransferSubmit(values)}
                    >
                      <Form.Item label={copy.sourceStore} name="from_store_id" rules={[{ required: true, message: copy.chooseSourceStore }]}>
                        <Select options={storeOptions} placeholder={copy.sourceStorePlaceholder} />
                      </Form.Item>

                      <Form.Item
                        label={copy.targetStore}
                        name="to_store_id"
                        dependencies={['from_store_id']}
                        rules={[
                          { required: true, message: copy.chooseTargetStore },
                          ({ getFieldValue }) => ({
                            validator(_, value: string | undefined) {
                              const fromStoreId = getFieldValue('from_store_id') as string | undefined;
                              if (!value || !fromStoreId || value !== fromStoreId) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error(copy.differentStore));
                            },
                          }),
                        ]}
                      >
                        <Select options={storeOptions} placeholder={copy.targetStorePlaceholder} />
                      </Form.Item>

                      <Form.Item label={copy.product} name="product_id" rules={[{ required: true, message: copy.chooseProduct }]}>
                        <Select showSearch options={productOptions} placeholder={copy.productPlaceholder} optionFilterProp="label" />
                      </Form.Item>

                      <Form.Item label={copy.transferQuantity} name="quantity" rules={[{ required: true, message: copy.enterTransferQuantity }]}>
                        <InputNumber className="w-full" min={1} precision={0} placeholder={copy.quantityPlaceholder} />
                      </Form.Item>

                      <Form.Item className="!mb-0">
                        <Button type="primary" htmlType="submit" loading={transferMutation.isPending} disabled={transferMutation.isPending}>
                          {copy.transferSubmit}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ),
              },
            ]}
          />
        )}

        {!isOptionsLoading && (stores.length === 0 || products.length === 0) ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <Paragraph className="!mb-2">{copy.emptyDataTitle}</Paragraph>
            <div>{copy.emptyDataDescription}</div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
