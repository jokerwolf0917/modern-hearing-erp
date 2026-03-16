import { BarcodeOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Select, Space, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { snStockIn } from '../services/inventory';
import { getProducts, type IProduct } from '../services/product';
import { getStores, type IStore } from '../services/store';

const { TextArea } = Input;
const { Paragraph, Text, Title } = Typography;

interface FormValues {
  store_id?: string;
  product_id?: string;
}

function parseSerialCodes(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SNStockInPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const [rawValue, setRawValue] = useState('');
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    title: isZh ? '序列号扫码入库' : 'Serial Stock In',
    description: isZh
      ? '面向门店扫码枪的批量入库工作台，支持连续扫入 SN 码或直接粘贴 Excel 列表。'
      : 'A scanner-style stock-in workspace for serial-tracked devices, with support for continuous scans or pasted Excel lists.',
    selectStore: isZh ? '选择门店' : 'Select store',
    selectProduct: isZh ? '选择商品' : 'Select product',
    chooseStore: isZh ? '请选择门店' : 'Please select a store.',
    chooseProduct: isZh ? '请选择商品' : 'Please select a product.',
    storePlaceholder: isZh ? '请选择入库门店' : 'Select stock-in store',
    productPlaceholder: isZh ? '请选择需要录入 SN 的商品' : 'Select product that requires SN tracking',
    scanZone: isZh ? '扫码区' : 'Scan Zone',
    scanHint: isZh
      ? '扫码枪输入会像流水一样连续落在这个文本框中。'
      : 'Scanner input will stream directly into this text area.',
    placeholder: isZh
      ? '请点击此处获取焦点，然后使用扫码枪连续扫入序列号；或直接粘贴 Excel 中的 SN 码列表（每行一个）'
      : 'Focus here, then scan serial numbers continuously with the scanner, or paste an Excel list with one SN per line.',
    validCount: isZh ? '当前识别到的有效 SN 数量' : 'Valid serials detected',
    submit: isZh ? '确认批量入库' : 'Confirm Batch Stock In',
    emptySn: isZh ? '请先扫描或粘贴至少一个有效 SN 码' : 'Please scan or paste at least one valid serial number.',
    success: isZh ? '成功入库 {{count}} 件设备' : 'Successfully stocked in {{count}} devices.',
  };

  const [storeQuery, productQuery] = useQueries({
    queries: [
      { queryKey: ['stores'], queryFn: getStores },
      { queryKey: ['products'], queryFn: getProducts },
    ],
  });

  const stores = (storeQuery.data ?? []) as IStore[];
  const products = (productQuery.data ?? []) as IProduct[];
  const isStoreLocked = employee?.role === 'store_manager' || employee?.role === 'staff';

  useEffect(() => {
    if (isStoreLocked && employee?.store_id) {
      form.setFieldValue('store_id', employee.store_id);
      return;
    }

    if (!form.getFieldValue('store_id') && stores.length > 0) {
      form.setFieldValue('store_id', stores[0].id);
    }
  }, [employee?.store_id, form, isStoreLocked, stores]);

  const validSnCodes = useMemo(() => parseSerialCodes(rawValue), [rawValue]);

  const stockInMutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      if (validSnCodes.length === 0) {
        throw new Error(copy.emptySn);
      }

      return snStockIn(values.store_id!, values.product_id!, validSnCodes);
    },
    onSuccess: async () => {
      setRawValue('');
      messageApi.success(copy.success.replace('{{count}}', String(validSnCodes.length)));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] }),
      ]);
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    },
  });

  async function handleSubmit(): Promise<void> {
    if (validSnCodes.length === 0) {
      messageApi.warning(copy.emptySn);
      return;
    }

    try {
      await stockInMutation.mutateAsync();
    } catch {
      // handled by mutation
    }
  }

  return (
    <>
      {contextHolder}

      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Title level={3} className="!mb-2">
            {copy.title}
          </Title>
          <Paragraph type="secondary" className="!mb-0">
            {copy.description}
          </Paragraph>
        </div>

        <Card className="rounded-3xl">
          <Form<FormValues> form={form} layout="vertical">
            <div className="grid gap-5 lg:grid-cols-2">
              <Form.Item label={copy.selectStore} name="store_id" rules={[{ required: true, message: copy.chooseStore }]}>
                <Select
                  disabled={isStoreLocked}
                  loading={storeQuery.isLoading}
                  placeholder={copy.storePlaceholder}
                  options={stores.map((store) => ({
                    value: store.id,
                    label: store.name,
                  }))}
                />
              </Form.Item>

              <Form.Item label={copy.selectProduct} name="product_id" rules={[{ required: true, message: copy.chooseProduct }]}>
                <Select
                  showSearch
                  loading={productQuery.isLoading}
                  placeholder={copy.productPlaceholder}
                  optionFilterProp="label"
                  options={products.map((product) => ({
                    value: product.id,
                    label: `${product.name} (${product.sku})`,
                  }))}
                />
              </Form.Item>
            </div>

            <div className="mt-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
              <Space direction="vertical" size="middle" className="w-full">
                <Space align="center" size="middle">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: '#eff6ff', color: '#2563eb' }}
                  >
                    <BarcodeOutlined style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <Text strong className="block text-slate-900">
                      {copy.scanZone}
                    </Text>
                    <Text type="secondary">{copy.scanHint}</Text>
                  </div>
                </Space>

                <TextArea
                  rows={10}
                  value={rawValue}
                  onChange={(event) => setRawValue(event.target.value)}
                  placeholder={copy.placeholder}
                  className="font-mono text-[13px]"
                />
              </Space>
            </div>

            <div
              className="mt-5 flex flex-col gap-4 rounded-b-3xl px-5 py-5 lg:flex-row lg:items-center lg:justify-between"
              style={{
                background: '#ffffff',
                borderTop: '1px solid #f3f4f6',
                boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div>
                <Text type="secondary">{copy.validCount}</Text>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{validSnCodes.length}</div>
              </div>

              <Button type="primary" size="large" className="min-w-[220px]" loading={stockInMutation.isPending} onClick={() => void handleSubmit()}>
                {copy.submit}
              </Button>
            </div>
          </Form>
        </Card>
      </Space>
    </>
  );
}
