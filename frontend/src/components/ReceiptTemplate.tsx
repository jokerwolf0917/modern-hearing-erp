import { ClockCircleOutlined, EnvironmentOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { Card, Descriptions } from 'antd';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { IOrderListItem } from '../services/order';

interface ReceiptTemplateProps {
  order: IOrderListItem | null;
}

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { hour12: false });
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale);
}

function formatCurrency(value: number | string, locale: string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(function ReceiptTemplate(
  { order },
  ref,
) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const printedAt = formatDateTime(new Date().toISOString(), locale);

  const copy = {
    brand: isZh ? '听力 ERP 多门店系统' : 'Hearing ERP Multi-store System',
    title: isZh ? '销售凭证' : 'Sales Receipt',
    hint: isZh ? '医疗器械销售记录，请妥善保管。' : 'Medical-device sales record. Please keep this document safely.',
    orderNo: isZh ? '订单号' : 'Order No.',
    printedAt: isZh ? '打印时间' : 'Printed At',
    customer: isZh ? '客户姓名' : 'Customer',
    store: isZh ? '开单门店' : 'Store',
    time: isZh ? '接待时间' : 'Issued At',
    status: isZh ? '订单状态' : 'Status',
    paid: isZh ? '已完成' : 'Completed',
    returned: isZh ? '已退货' : 'Returned',
    cancelled: isZh ? '已取消' : 'Cancelled',
    product: isZh ? '商品名称' : 'Product',
    unitPrice: isZh ? '单价' : 'Unit Price',
    quantity: isZh ? '数量' : 'Qty',
    subtotal: isZh ? '小计' : 'Subtotal',
    warrantyUntil: isZh ? '保修至' : 'Warranty Until',
    total: isZh ? '总金额' : 'Total',
    signature: isZh ? '客户签名' : 'Customer Signature',
    stamp: isZh ? '诊所盖章' : 'Clinic Stamp',
    disclaimerTitle: isZh ? '免责声明 / 温馨提示' : 'Notice',
    disclaimerLine1: isZh
      ? '感谢您的信任，请妥善保管此凭证作为保修依据。'
      : 'Thank you for your trust. Please keep this receipt as proof for warranty service.',
    disclaimerLine2: isZh
      ? '高值医疗器械商品的序列号与保修期信息已随本凭证一并记录。'
      : 'Serial-number and warranty information for high-value medical devices is recorded on this receipt.',
  };

  const statusLabel =
    order?.status === 'returned'
      ? copy.returned
      : order?.status === 'cancelled'
        ? copy.cancelled
        : copy.paid;

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        background: '#fff',
        color: '#111827',
        padding: '18mm 14mm',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Microsoft YaHei", sans-serif',
      }}
    >
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 8mm;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .receipt-card {
              box-shadow: none !important;
              border: 1px solid #e5e7eb !important;
            }

            .receipt-table {
              page-break-inside: auto;
            }

            .receipt-table tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}
      </style>

      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6 }}>{copy.brand}</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{copy.title}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{copy.hint}</div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          gap: 20,
          fontSize: 13,
          color: '#334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined />
          <span>
            {copy.orderNo}: {order ? order.id.slice(0, 8).toUpperCase() : '-'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClockCircleOutlined />
          <span>
            {copy.printedAt}: {printedAt}
          </span>
        </div>
      </div>

      <Card
        className="receipt-card"
        bordered={false}
        styles={{ body: { padding: 16, boxShadow: 'none' } }}
        style={{ marginBottom: 18, borderRadius: 14 }}
      >
        <Descriptions
          column={2}
          size="small"
          items={[
            {
              key: 'customer',
              label: (
                <span>
                  <UserOutlined style={{ marginRight: 6 }} />
                  {copy.customer}
                </span>
              ),
              children: order?.customer_name ?? '-',
            },
            {
              key: 'store',
              label: (
                <span>
                  <EnvironmentOutlined style={{ marginRight: 6 }} />
                  {copy.store}
                </span>
              ),
              children: order?.store_name ?? '-',
            },
            {
              key: 'time',
              label: copy.time,
              children: order ? formatDateTime(order.created_at, locale) : '-',
            },
            {
              key: 'status',
              label: copy.status,
              children: statusLabel,
            },
          ]}
        />
      </Card>

      <table
        className="receipt-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: 22,
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {[copy.product, copy.unitPrice, copy.quantity, copy.subtotal].map((title) => (
              <th
                key={title}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #111827',
                  textAlign: title === copy.product ? 'left' : 'right',
                  fontWeight: 700,
                }}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(order?.items ?? []).map((item, index) => (
            <tr key={`${item.sku}-${index}`}>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>SKU: {item.sku}</div>
                {item.serial_details.map((serial) => (
                  <div key={serial.sn_code} style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                    SN: {serial.sn_code}
                    {serial.warranty_ends_at ? ` | ${copy.warrantyUntil}: ${formatDate(serial.warranty_ends_at, locale)}` : ''}
                  </div>
                ))}
              </td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                {formatCurrency(item.unit_price, locale)}
              </td>
              <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.quantity}</td>
              <td
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #e5e7eb',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {formatCurrency(Number(item.unit_price) * item.quantity, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <div
          style={{
            minWidth: 280,
            borderTop: '2px solid #111827',
            paddingTop: 14,
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{copy.total}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{order ? formatCurrency(order.total_amount, locale) : '-'}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 28,
          marginBottom: 30,
        }}
      >
        <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 10, minHeight: 54 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{copy.signature}</div>
        </div>
        <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 10, minHeight: 54 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{copy.stamp}</div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px dashed #94a3b8',
          paddingTop: 14,
          fontSize: 12,
          lineHeight: 1.8,
          color: '#475569',
        }}
      >
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{copy.disclaimerTitle}</div>
        <div>{copy.disclaimerLine1}</div>
        <div>{copy.disclaimerLine2}</div>
      </div>
    </div>
  );
});
