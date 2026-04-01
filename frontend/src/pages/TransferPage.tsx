import { useMutation, useQueries } from '@tanstack/react-query';
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Skeleton, Tabs, Typography, message } from 'antd';
import type { AxiosError } from 'axios';
import dayjs, { type Dayjs } from 'dayjs';

import { getProducts } from '../services/product';
import { getStores } from '../services/store';
import { stockIn, transferStock, type StockInPayload, type TransferStockPayload } from '../services/inventory';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';
import type { IProduct } from '../services/product';
import type { IStore } from '../services/store';

const { Paragraph, Text, Title } = Typography;

interface StockInFormValues {
  transaction_date: Dayjs;
  store_id: string;
  product_id: string;
  quantity: number;
  remark?: string;
}

interface TransferFormValues {
  transaction_date: Dayjs;
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
  remark?: string;
}

export function TransferPage(): JSX.Element {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [stockInForm] = Form.useForm<StockInFormValues>();
  const [transferForm] = Form.useForm<TransferFormValues>();

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, '提交失败，请稍后重试');
  };

  const [storeQuery, productQuery] = useQueries({
    queries: [
      { queryKey: ['stores'], queryFn: getStores },
      { queryKey: ['products'], queryFn: () => getProducts() },
    ],
  });

  const stores: IStore[] = (storeQuery.data as IStore[] | undefined) ?? [];
  const products: IProduct[] = (productQuery.data as IProduct[] | undefined) ?? [];
  const isLoading = storeQuery.isLoading || productQuery.isLoading;

  const stockInMutation = useMutation({
    mutationFn: (payload: StockInPayload) => stockIn(payload),
    onSuccess: () => {
      messageApi.success('入库流水已登记');
      stockInForm.resetFields();
      stockInForm.setFieldValue('transaction_date', dayjs());
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload: TransferStockPayload) => transferStock(payload),
    onSuccess: () => {
      messageApi.success('出库 / 调拨流水已登记');
      transferForm.resetFields();
      transferForm.setFieldValue('transaction_date', dayjs());
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <>
      {messageContextHolder}

      <div className="page-stack">
        <div className="page-hero">
          <Text type="secondary">入库表 / 出库表</Text>
          <Title level={1} className="page-title !mb-0">
            库存调拨
          </Title>
          <Paragraph className="page-hero-meta !mb-0">
            按照 Excel 流水结构记录入库、调拨和门店出入库动作，时间、数量和备注都会同步写入后台流水。
          </Paragraph>
        </div>

        <Card>
          <Tabs
            items={[
              {
                key: 'stock-in',
                label: '入库登记',
                children: (
                  <Form<StockInFormValues>
                    layout="vertical"
                    form={stockInForm}
                    initialValues={{ transaction_date: dayjs() }}
                    onFinish={(values) =>
                      stockInMutation.mutate({
                        store_id: values.store_id,
                        product_id: values.product_id,
                        quantity: values.quantity,
                        transaction_date: values.transaction_date.toISOString(),
                        remark: values.remark?.trim() || undefined,
                      })
                    }
                  >
                    <Form.Item name="transaction_date" label="入库日期" rules={[{ required: true, message: '请选择入库日期' }]}>
                      <DatePicker className="w-full" showTime />
                    </Form.Item>
                    <Form.Item name="store_id" label="入库门店" rules={[{ required: true, message: '请选择门店' }]}>
                      <Select placeholder="选择入库门店" options={stores.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item name="product_id" label="产品编号 / 商品" rules={[{ required: true, message: '请选择商品' }]}>
                      <Select
                        showSearch
                        placeholder="选择商品"
                        optionFilterProp="label"
                        options={products.map((item) => ({
                          value: item.id,
                          label: `${item.product_code} | ${item.category_display} | ${item.brand_display} | ${item.name_cn}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name="quantity" label="入库数量" rules={[{ required: true, message: '请输入入库数量' }]}>
                      <InputNumber min={1} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item name="remark" label="备注">
                      <Input.TextArea rows={3} placeholder="例如：补货、到货、盘盈入库等" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={stockInMutation.isPending}>
                      提交入库
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'transfer',
                label: '出库 / 调拨',
                children: (
                  <Form<TransferFormValues>
                    layout="vertical"
                    form={transferForm}
                    initialValues={{ transaction_date: dayjs() }}
                    onFinish={(values) =>
                      transferMutation.mutate({
                        from_store_id: values.from_store_id,
                        to_store_id: values.to_store_id,
                        product_id: values.product_id,
                        quantity: values.quantity,
                        transaction_date: values.transaction_date.toISOString(),
                        remark: values.remark?.trim() || undefined,
                      })
                    }
                  >
                    <Form.Item name="transaction_date" label="出库日期" rules={[{ required: true, message: '请选择出库日期' }]}>
                      <DatePicker className="w-full" showTime />
                    </Form.Item>
                    <Form.Item name="from_store_id" label="调出门店" rules={[{ required: true, message: '请选择调出门店' }]}>
                      <Select placeholder="选择调出门店" options={stores.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item
                      name="to_store_id"
                      label="调入门店"
                      rules={[
                        { required: true, message: '请选择调入门店' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || value !== getFieldValue('from_store_id')) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('调入门店不能与调出门店相同'));
                          },
                        }),
                      ]}
                    >
                      <Select placeholder="选择调入门店" options={stores.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                    <Form.Item name="product_id" label="产品编号 / 商品" rules={[{ required: true, message: '请选择商品' }]}>
                      <Select
                        showSearch
                        placeholder="选择商品"
                        optionFilterProp="label"
                        options={products.map((item) => ({
                          value: item.id,
                          label: `${item.product_code} | ${item.category_display} | ${item.brand_display} | ${item.name_cn}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name="quantity" label="出库数量" rules={[{ required: true, message: '请输入出库数量' }]}>
                      <InputNumber min={1} precision={0} className="w-full" />
                    </Form.Item>
                    <Form.Item name="remark" label="备注">
                      <Input.TextArea rows={3} placeholder="例如：门店调拨、借出、配件外发等" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={transferMutation.isPending}>
                      提交出库 / 调拨
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
