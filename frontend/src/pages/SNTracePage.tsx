import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Descriptions, Empty, Input, Skeleton, Space, Tag, Timeline, Typography } from 'antd';
import type { AxiosError } from 'axios';

import { traceSN, type SNTraceResult } from '../services/inventory';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Paragraph, Text, Title } = Typography;
const { Search } = Input;

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString(locale, { hour12: false });
}

export function SNTracePage(): JSX.Element {
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-US';

  const copy = {
    eyebrow: 'SN Trace',
    title: isZh ? '全局 SN 溯源查询' : 'Global SN Trace',
    description: isZh
      ? '输入设备 SN 码，快速联查门店、商品、订单、客户与保修状态。'
      : 'Enter a device serial number to trace its store, product, sale, customer and warranty status.',
    button: isZh ? '溯源查询' : 'Trace',
    placeholder: isZh ? '请使用扫码枪扫入或手动输入设备 SN 码' : 'Scan or enter a device serial number',
    emptyBefore: isZh ? '输入 SN 码后即可查看设备全生命周期信息' : 'Enter an SN code to inspect the full device lifecycle',
    notFound: isZh ? `未查询到 SN 码 ${submittedKeyword}，请核对输入后重试` : `No result found for SN ${submittedKeyword}. Please verify the code and try again.`,
    failed: isZh ? '溯源查询失败，请稍后重试。' : 'Trace lookup failed. Please try again later.',
    profile: isZh ? '设备档案' : 'Device Profile',
    timeline: isZh ? '生命周期时间轴' : 'Lifecycle Timeline',
    snCode: isZh ? 'SN 码' : 'SN Code',
    product: isZh ? '设备名称' : 'Device',
    status: isZh ? '当前状态' : 'Status',
    store: isZh ? '所属门店' : 'Store',
    customer: isZh ? '购买客户' : 'Customer',
    order: isZh ? '销售订单' : 'Order',
    soldAt: isZh ? '售出时间' : 'Sold At',
    warranty: isZh ? '保修截止日' : 'Warranty End',
    inStock: isZh ? '在库' : 'In Stock',
    sold: isZh ? '已售出' : 'Sold',
    returned: isZh ? '已退回' : 'Returned',
    defective: isZh ? '故障/报损' : 'Defective',
    expired: isZh ? '（已过保）' : '(Expired)',
    stockedInNode: isZh ? '入库' : 'Stocked In',
    salesNode: isZh ? '销售开单' : 'Sales Order',
    warrantyNode: isZh ? '保修期' : 'Warranty',
    unregisteredCustomer: isZh ? '未登记客户' : 'Unregistered customer',
    validWarranty: isZh ? '当前仍在保修期内' : 'Still under warranty',
    invalidWarranty: isZh ? '保修期已失效' : 'Warranty has expired',
  };

  function getStatusMeta(status: SNTraceResult['status']): { label: string; color: string } {
    switch (status) {
      case 'in_stock':
        return { label: copy.inStock, color: 'green' };
      case 'sold':
        return { label: copy.sold, color: 'blue' };
      case 'returned':
        return { label: copy.returned, color: 'orange' };
      case 'defective':
        return { label: copy.defective, color: 'red' };
      default:
        return { label: status, color: 'default' };
    }
  }

  function getWarrantyText(result: SNTraceResult): { value: string; danger: boolean } {
    if (!result.warranty_ends_at) return { value: '-', danger: false };
    if (result.is_warranty_valid) return { value: formatDateTime(result.warranty_ends_at, locale), danger: false };
    return { value: `${formatDateTime(result.warranty_ends_at, locale)} ${copy.expired}`, danger: true };
  }

  const traceQuery = useQuery({
    queryKey: ['sn-trace', submittedKeyword],
    queryFn: () => traceSN(submittedKeyword),
    enabled: submittedKeyword.trim().length > 0,
    retry: false,
  });

  const traceResult = traceQuery.data;
  const statusMeta = traceResult ? getStatusMeta(traceResult.status) : null;
  const warrantyText = traceResult ? getWarrantyText(traceResult) : null;
  const axiosError = traceQuery.error as AxiosError<ApiErrorResponse> | null;
  const isNotFound = axiosError?.response?.status === 404;

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card bordered={false} className="rounded-3xl" styles={{ body: { padding: 28, borderBottom: '1px solid #e5e7eb' } }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Space size="small" className="!mb-2">
              <SearchOutlined style={{ color: '#2563eb' }} />
              <Text style={{ color: '#2563eb', fontWeight: 600 }}>{copy.eyebrow}</Text>
            </Space>
            <Title level={3} className="!mb-2">
              {copy.title}
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              {copy.description}
            </Paragraph>
          </div>

          <div className="w-full max-w-2xl">
            <Search
              size="large"
              enterButton={copy.button}
              allowClear
              value={keyword}
              placeholder={copy.placeholder}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => setSubmittedKeyword(value.trim())}
            />
          </div>
        </div>
      </Card>

      {!submittedKeyword ? (
        <Card className="rounded-3xl">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={copy.emptyBefore} />
        </Card>
      ) : null}

      {traceQuery.isLoading ? (
        <Card className="rounded-3xl">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : null}

      {submittedKeyword && isNotFound ? (
        <Card className="rounded-3xl">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={copy.notFound} />
        </Card>
      ) : null}

      {submittedKeyword && traceQuery.isError && !isNotFound ? (
        <Card className="rounded-3xl">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={normalizeApiErrorMessage(axiosError?.response?.data, copy.failed)}
          />
        </Card>
      ) : null}

      {traceResult ? (
        <Card className="rounded-3xl">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Descriptions
              bordered
              title={copy.profile}
              column={1}
              labelStyle={{ width: 140 }}
              items={[
                { key: 'sn', label: copy.snCode, children: <Text code>{traceResult.sn_code}</Text> },
                { key: 'product', label: copy.product, children: traceResult.product_name },
                {
                  key: 'status',
                  label: copy.status,
                  children: statusMeta ? <Tag color={statusMeta.color}>{statusMeta.label}</Tag> : '-',
                },
                { key: 'store', label: copy.store, children: traceResult.store_name },
                { key: 'customer', label: copy.customer, children: traceResult.customer_name ?? '-' },
                {
                  key: 'order',
                  label: copy.order,
                  children: traceResult.order_id ? (
                    <Text copyable={{ text: traceResult.order_id }}>
                      {traceResult.order_id.slice(0, 8).toUpperCase()}
                    </Text>
                  ) : (
                    '-'
                  ),
                },
                { key: 'sold-at', label: copy.soldAt, children: formatDateTime(traceResult.sold_at, locale) },
                {
                  key: 'warranty',
                  label: copy.warranty,
                  children: warrantyText?.danger ? <Text type="danger">{warrantyText.value}</Text> : warrantyText?.value,
                },
              ]}
            />

            <Card title={copy.timeline} bordered={false} styles={{ body: { paddingTop: 8 } }}>
              <Timeline
                items={[
                  {
                    color: 'green',
                    children: (
                      <div>
                        <div className="font-medium text-slate-900">{copy.stockedInNode}</div>
                        <div className="text-slate-500">{formatDateTime(traceResult.stocked_in_at, locale)}</div>
                        <div className="text-slate-500">{copy.store}: {traceResult.store_name}</div>
                      </div>
                    ),
                  },
                  ...(traceResult.sold_at
                    ? [
                        {
                          color: 'blue',
                          children: (
                            <div>
                              <div className="font-medium text-slate-900">{copy.salesNode}</div>
                              <div className="text-slate-500">{formatDateTime(traceResult.sold_at, locale)}</div>
                              <div className="text-slate-500">
                                {copy.customer}: {traceResult.customer_name ?? copy.unregisteredCustomer}
                              </div>
                            </div>
                          ),
                        },
                      ]
                    : []),
                  ...(traceResult.warranty_ends_at
                    ? [
                        {
                          color: traceResult.is_warranty_valid ? 'gray' : 'red',
                          children: (
                            <div>
                              <div className="font-medium text-slate-900">{copy.warrantyNode}</div>
                              <div className="text-slate-500">
                                {copy.warranty}: {formatDateTime(traceResult.warranty_ends_at, locale)}
                              </div>
                              <div className="text-slate-500">
                                {traceResult.is_warranty_valid ? copy.validWarranty : copy.invalidWarranty}
                              </div>
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Card>
          </div>
        </Card>
      ) : null}
    </Space>
  );
}
