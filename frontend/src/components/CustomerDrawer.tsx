import { EditOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Button, DatePicker, Drawer, Empty, Form, Input, InputNumber, Modal, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import {
  createCustomerSaleRecord,
  createFittingRecord,
  createRepairRecord,
  getCustomerDetails,
  updateCustomer,
  type CustomerDetailFittingRecordResponse,
  type CustomerDetailResponse,
  type RepairRecordResponse,
  type StockTransactionResponse,
} from '../services/api';
import { getProducts, type IProduct } from '../services/product';
import { getStores, type IStore } from '../services/store';

const { Paragraph, Text } = Typography;
type SortableEntity = StockTransactionResponse | RepairRecordResponse | CustomerDetailFittingRecordResponse;

interface CustomerDrawerProps { customerId: string | null; open: boolean; onClose: () => void; }
interface CustomerFormValues { name: string; phone: string; gender?: string; birth_date?: Dayjs; address?: string; primary_store_id?: string; }
interface SaleRecordFormValues { store_id: string; product_id: string; transaction_date: Dayjs; quantity: number; unit_price: number; remark?: string; }
interface RepairFormValues { store_id: string; machine_model: string; receive_date: Dayjs; due_date: Dayjs; issue_description?: string; status: 'PENDING' | 'FACTORY' | 'DELIVERED'; }
interface FittingFormValues { store_id: string; product_id?: string; fitting_date: Dayjs; device_name?: string; fitting_notes?: string; result_summary?: string; }

const zh = {
  title: '客户全景档案', loading: '正在加载客户档案...', empty: '未找到客户详情',
  tabs: ['基础资料', '订单与持有设备', '保修与维修记录', '验配记录'],
  labels: {
    name: '姓名', phone: '电话', gender: '性别', birth: '生日', store: '归属门店', created: '建档时间', address: '地址',
    product: '设备', purchaseAt: '购买时间', qtyPrice: '数量 / 单价', spec: '规格', due: '预计交付日', handledBy: '经手人',
    state: '当前状态', deviceName: '设备名称', recordedBy: '记录人', machine: '机器型号', receive: '送修日期',
    issue: '故障描述', result: '结果总结', fittingNotes: '验配说明', fittingDate: '验配日期', remark: '备注', price: '成交价格', quantity: '数量',
  },
  btn: { edit: '编辑资料', addDevice: '补录设备', addRepair: '新增维修记录', addFitting: '新增验配记录' },
  hint: {
    tx: '拖拽卡片可调整设备展示顺序，最上方可作为当前主要佩戴设备。',
    rp: '拖拽卡片可调整查看顺序，把最紧急、最常跟进的维修单放到最上方。',
    ft: '拖拽卡片可调整展示顺序，把当前常参考的验配记录拖到前面。',
  },
  badge: { drop: '放到这里', current: '当前持有', priority: '优先跟进', reference: '当前参考' },
  status: { PENDING: '待修', FACTORY: '返厂', DELIVERED: '已交付' },
  modal: { edit: '编辑客户资料', sale: '补录持有设备', repair: '新增维修记录', fitting: '新增验配记录' },
  placeholder: {
    name: '请输入客户姓名', phone: '请输入联系电话', gender: '如：男 / 女 / 未知', address: '请输入地址', store: '请选择门店',
    product: '请选择产品', productOptional: '可选关联产品', remark: '可填写补录说明', machine: '请输入机器型号',
    issue: '请输入故障描述', device: '可手动填写设备名称', result: '请输入结果总结', notes: '请输入验配说明',
  },
  validate: {
    name: '请输入姓名', phone: '请输入电话', store: '请选择门店', product: '请选择设备', purchaseAt: '请选择时间',
    quantity: '请输入数量', price: '请输入价格', machine: '请输入机器型号', receive: '请选择送修日期', due: '请选择预计交付日',
    state: '请选择状态', fittingDate: '请选择验配日期',
  },
  msg: {
    updated: '客户资料已更新', updateFail: '更新客户资料失败', saleOk: '持有设备记录已补录', saleFail: '补录持有设备记录失败',
    repairOk: '维修记录已新增', repairFail: '新增维修记录失败', fittingOk: '验配记录已新增', fittingFail: '新增验配记录失败',
  },
  emptyTab: { tx: '暂无购买或持有设备记录', rp: '暂无维修记录', ft: '暂无验配记录' },
  unnamed: '未填写设备名称',
};

const en = {
  title: 'Customer profile', loading: 'Loading customer profile...', empty: 'Customer details not found',
  tabs: ['Basic info', 'Orders & devices', 'Warranty & repairs', 'Fitting records'],
  labels: {
    name: 'Name', phone: 'Phone', gender: 'Gender', birth: 'Birth date', store: 'Primary store', created: 'Created at', address: 'Address',
    product: 'Product', purchaseAt: 'Purchased', qtyPrice: 'Qty / Price', spec: 'Specification', due: 'Due date', handledBy: 'Handled by',
    state: 'Status', deviceName: 'Device', recordedBy: 'Recorded by', machine: 'Device model', receive: 'Received date',
    issue: 'Issue description', result: 'Result summary', fittingNotes: 'Fitting notes', fittingDate: 'Fitting date', remark: 'Remark', price: 'Sale price', quantity: 'Quantity',
  },
  btn: { edit: 'Edit profile', addDevice: 'Add device', addRepair: 'Add repair', addFitting: 'Add fitting' },
  hint: {
    tx: 'Drag cards to reorder the device stack and pin the current primary device at the top.',
    rp: 'Drag cards to keep the most urgent repair cases at the top.',
    ft: 'Drag cards to place the most useful fitting references at the top.',
  },
  badge: { drop: 'Drop here', current: 'Current device', priority: 'Priority', reference: 'Reference' },
  status: { PENDING: 'Pending', FACTORY: 'Factory', DELIVERED: 'Delivered' },
  modal: { edit: 'Edit customer', sale: 'Add device record', repair: 'Add repair record', fitting: 'Add fitting record' },
  placeholder: {
    name: 'Enter customer name', phone: 'Enter phone number', gender: 'For example: Male / Female / Unknown', address: 'Enter address', store: 'Select a store',
    product: 'Select a product', productOptional: 'Optional linked product', remark: 'Add an optional migration note', machine: 'Enter device model',
    issue: 'Describe the issue', device: 'Optional manual device name', result: 'Describe the fitting result', notes: 'Add fitting notes',
  },
  validate: {
    name: 'Please enter a name', phone: 'Please enter a phone number', store: 'Please select a store', product: 'Please select a device',
    purchaseAt: 'Please select a time', quantity: 'Please enter a quantity', price: 'Please enter a price', machine: 'Please enter a device model',
    receive: 'Please select a received date', due: 'Please select a due date', state: 'Please select a status', fittingDate: 'Please select a fitting date',
  },
  msg: {
    updated: 'Customer profile updated', updateFail: 'Failed to update customer profile', saleOk: 'Device record added', saleFail: 'Failed to add device record',
    repairOk: 'Repair record added', repairFail: 'Failed to add repair record', fittingOk: 'Fitting record added', fittingFail: 'Failed to add fitting record',
  },
  emptyTab: { tx: 'No purchase or device records yet', rp: 'No repair records yet', ft: 'No fitting records yet' },
  unnamed: 'Unnamed device',
};

function translateBrand(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, [string, string]> = { SIGNIA: ['西嘉', 'Signia'], PHONAK: ['峰力', 'Phonak'], PHILIPS: ['飞利浦', 'Philips'], SIEMENS: ['西门子', 'Siemens'], POWERONE: ['POWERONE', 'POWERONE'], ZHILI: ['至力', 'Zhili'] };
  return map[value]?.[isZh ? 0 : 1] ?? value;
}

function translateCategory(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, [string, string]> = { BTE: ['BTE', 'BTE'], RIC: ['RIC', 'RIC'], ITC: ['ITC', 'ITC'], ITE: ['ITE', 'ITE'], IIC: ['IIC', 'IIC'], CIC: ['CIC', 'CIC'], 'IIC/CIC': ['IIC/CIC', 'IIC/CIC'], 标准机: ['标准机', 'Standard'], 耳背机: ['耳背机', 'Behind-the-ear'], 定制机: ['定制机', 'Custom'], '2.0受话器': ['2.0受话器', 'Receiver 2.0'], '3.0受话器': ['3.0受话器', 'Receiver 3.0'], 充电器: ['充电器', 'Charger'], 耳模: ['耳模', 'Ear mold'], 配件: ['配件', 'Accessory'], 护理宝: ['护理宝', 'Care kit'], 同声移: ['同声移', 'CROS'], Demo机: ['Demo机', 'Demo'], 电池: ['电池', 'Battery'] };
  return map[value]?.[isZh ? 0 : 1] ?? value;
}

function formatDate(value: string | null, locale: string): string { return value ? dayjs(value).locale(locale).format('YYYY-MM-DD') : '-'; }
function formatDateTime(value: string | null, locale: string): string { return value ? dayjs(value).locale(locale).format('YYYY-MM-DD HH:mm') : '-'; }
function formatCurrency(value: number | string | null, locale: string): string { return value == null ? '-' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(Number(value)); }
function moveItem<T extends SortableEntity>(items: T[], activeId: string, overId: string): T[] { const from = items.findIndex((item) => item.id === activeId); const to = items.findIndex((item) => item.id === overId); if (from < 0 || to < 0 || from === to) return items; const next = [...items]; const [active] = next.splice(from, 1); next.splice(to, 0, active); return next; }
function getErrorMessage(error: unknown, fallback: string): string { if (error instanceof AxiosError && typeof error.response?.data?.detail === 'string' && error.response.data.detail.trim()) return error.response.data.detail; return fallback; }

function SortHint({ text }: { text: string }): JSX.Element { return <div style={{ marginBottom: 12, borderRadius: 12, border: '1px dashed #dbe4f0', background: '#f8faff', padding: '9px 11px' }}><Text type="secondary" style={{ fontSize: 11.5 }}>{text}</Text></div>; }

function RecordCard({ title, subtitle, badge, meta, description, overText, isDragging, isOver, onDragStart, onDragEnter, onDragEnd, onDrop }: { title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; meta?: ReactNode; description?: ReactNode; overText: string; isDragging?: boolean; isOver?: boolean; onDragStart?: () => void; onDragEnter?: () => void; onDragEnd?: () => void; onDrop?: () => void; }): JSX.Element {
  return (
    <div draggable onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={(event) => event.preventDefault()} onDragEnd={onDragEnd} onDrop={(event) => { event.preventDefault(); onDrop?.(); }} style={{ borderRadius: 16, border: isOver ? '1px solid #93c5fd' : '1px solid #e2e8f0', background: isDragging ? '#f8faff' : '#ffffff', boxShadow: isDragging ? '0 10px 30px rgba(37,99,235,0.08)' : '0 1px 2px rgba(15,23,42,0.04)', padding: 14, transition: 'all 0.18s ease', cursor: 'grab' }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '16px minmax(0, 1fr) auto', alignItems: 'start' }}>
        <HolderOutlined style={{ color: '#94a3b8', fontSize: 14, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          {badge ? <Space size={[6, 6]} wrap style={{ marginBottom: 7 }}>{badge}</Space> : null}
          <Text strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{title}</Text>
          {subtitle ? <Text type="secondary" style={{ display: 'block', marginTop: 3, fontSize: 12 }}>{subtitle}</Text> : null}
          {meta ? <div style={{ marginTop: 8 }}>{meta}</div> : null}
          {description ? <Paragraph style={{ marginTop: 10, marginBottom: 0, color: '#475569', lineHeight: 1.6, fontSize: 12.5 }}>{description}</Paragraph> : null}
        </div>
        {isOver ? <Tag color="processing">{overText}</Tag> : null}
      </div>
    </div>
  );
}

export function CustomerDrawer({ customerId, open, onClose }: CustomerDrawerProps): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [editOpen, setEditOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [fittingOpen, setFittingOpen] = useState(false);
  const [editForm] = Form.useForm<CustomerFormValues>();
  const [saleForm] = Form.useForm<SaleRecordFormValues>();
  const [repairForm] = Form.useForm<RepairFormValues>();
  const [fittingForm] = Form.useForm<FittingFormValues>();
  const [orderedTransactions, setOrderedTransactions] = useState<StockTransactionResponse[]>([]);
  const [orderedRepairs, setOrderedRepairs] = useState<RepairRecordResponse[]>([]);
  const [orderedFittings, setOrderedFittings] = useState<CustomerDetailFittingRecordResponse[]>([]);
  const [dragTx, setDragTx] = useState<string | null>(null);
  const [dragRp, setDragRp] = useState<string | null>(null);
  const [dragFt, setDragFt] = useState<string | null>(null);
  const [overTx, setOverTx] = useState<string | null>(null);
  const [overRp, setOverRp] = useState<string | null>(null);
  const [overFt, setOverFt] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const t = isZh ? zh : en;

  const detailQuery = useQuery({ queryKey: ['customer-details', customerId], queryFn: () => getCustomerDetails(customerId as string), enabled: open && Boolean(customerId) });
  const storesQuery = useQuery<IStore[]>({ queryKey: ['stores'], queryFn: getStores, enabled: open });
  const productsQuery = useQuery<IProduct[]>({ queryKey: ['products'], queryFn: () => getProducts(), enabled: open });
  const detail = detailQuery.data as CustomerDetailResponse | undefined;
  const stores = storesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  useEffect(() => { if (detail) { setOrderedTransactions(detail.transactions ?? []); setOrderedRepairs(detail.repairs ?? []); setOrderedFittings(detail.fitting_records ?? []); } }, [detail]);
  useEffect(() => { if (detail && editOpen) editForm.setFieldsValue({ name: detail.name, phone: detail.phone, gender: detail.gender ?? undefined, birth_date: detail.birth_date ? dayjs(detail.birth_date) : undefined, address: detail.address ?? undefined, primary_store_id: detail.primary_store_id ?? undefined }); }, [detail, editForm, editOpen]);
  useEffect(() => { if (saleOpen) saleForm.setFieldsValue({ store_id: employee?.store_id ?? detail?.transactions[0]?.store_id ?? stores[0]?.id, transaction_date: dayjs(), quantity: 1 }); }, [detail?.transactions, employee?.store_id, saleForm, saleOpen, stores]);
  useEffect(() => { if (repairOpen) repairForm.setFieldsValue({ store_id: employee?.store_id ?? detail?.primary_store_id ?? stores[0]?.id, receive_date: dayjs(), due_date: dayjs().add(7, 'day'), status: 'PENDING' }); }, [detail?.primary_store_id, employee?.store_id, repairForm, repairOpen, stores]);
  useEffect(() => { if (fittingOpen) fittingForm.setFieldsValue({ store_id: employee?.store_id ?? detail?.primary_store_id ?? stores[0]?.id, fitting_date: dayjs() }); }, [detail?.primary_store_id, employee?.store_id, fittingForm, fittingOpen, stores]);

  const storeOptions = useMemo(() => stores.map((store) => ({ label: store.name, value: store.id })), [stores]);
  const productOptions = useMemo(() => products.map((product) => ({ label: `${product.product_code} | ${isZh ? product.name_cn : product.name_en || product.name_cn}`, value: product.id, price: Number(product.original_price) })), [isZh, products]);

  const updateMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => updateCustomer(customerId as string, { name: values.name.trim(), phone: values.phone.trim(), gender: values.gender?.trim() || null, birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null, address: values.address?.trim() || null, primary_store_id: values.primary_store_id ?? null }),
    onSuccess: async () => { messageApi.success(t.msg.updated); setEditOpen(false); await queryClient.invalidateQueries({ queryKey: ['customers'] }); await queryClient.invalidateQueries({ queryKey: ['customer-details', customerId] }); },
    onError: (error) => messageApi.error(getErrorMessage(error, t.msg.updateFail)),
  });
  const saleMutation = useMutation({
    mutationFn: (values: SaleRecordFormValues) => createCustomerSaleRecord(customerId as string, { store_id: values.store_id, product_id: values.product_id, transaction_date: values.transaction_date.toISOString(), quantity: values.quantity, unit_price: values.unit_price, remark: values.remark?.trim() || null }),
    onSuccess: async () => { messageApi.success(t.msg.saleOk); setSaleOpen(false); saleForm.resetFields(); await queryClient.invalidateQueries({ queryKey: ['customer-details', customerId] }); await queryClient.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (error) => messageApi.error(getErrorMessage(error, t.msg.saleFail)),
  });
  const repairMutation = useMutation({
    mutationFn: (values: RepairFormValues) => createRepairRecord({ customer_id: customerId as string, store_id: values.store_id, machine_model: values.machine_model.trim(), receive_date: values.receive_date.format('YYYY-MM-DD'), due_date: values.due_date.format('YYYY-MM-DD'), issue_description: values.issue_description?.trim() || null, status: values.status }),
    onSuccess: async () => { messageApi.success(t.msg.repairOk); setRepairOpen(false); repairForm.resetFields(); await queryClient.invalidateQueries({ queryKey: ['customer-details', customerId] }); await queryClient.invalidateQueries({ queryKey: ['repairs'] }); },
    onError: (error) => messageApi.error(getErrorMessage(error, t.msg.repairFail)),
  });
  const fittingMutation = useMutation({
    mutationFn: (values: FittingFormValues) => createFittingRecord({ customer_id: customerId as string, store_id: values.store_id, product_id: values.product_id || null, fitting_date: values.fitting_date.format('YYYY-MM-DD'), device_name: values.device_name?.trim() || null, fitting_notes: values.fitting_notes?.trim() || null, result_summary: values.result_summary?.trim() || null }),
    onSuccess: async () => { messageApi.success(t.msg.fittingOk); setFittingOpen(false); fittingForm.resetFields(); await queryClient.invalidateQueries({ queryKey: ['customer-details', customerId] }); await queryClient.invalidateQueries({ queryKey: ['fittings'] }); },
    onError: (error) => messageApi.error(getErrorMessage(error, t.msg.fittingFail)),
  });

  async function submitCustomerEdit(): Promise<void> { await updateMutation.mutateAsync(await editForm.validateFields()); }
  async function submitSaleRecord(): Promise<void> { await saleMutation.mutateAsync(await saleForm.validateFields()); }
  async function submitRepairRecord(): Promise<void> { await repairMutation.mutateAsync(await repairForm.validateFields()); }
  async function submitFittingRecord(): Promise<void> { await fittingMutation.mutateAsync(await fittingForm.validateFields()); }

  return (
    <>
      {contextHolder}
      <Drawer className="customer-drawer--compact" title={t.title} width={840} open={open} onClose={onClose} destroyOnClose>
        {!detail ? (
          <Empty description={detailQuery.isLoading ? t.loading : t.empty} />
        ) : (
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: t.tabs[0],
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>{t.btn.edit}</Button>
                    </div>
                    <div className="customer-detail-grid">
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.name}</Text><div className="customer-detail-value">{detail.name}</div></div>
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.phone}</Text><div className="customer-detail-value">{detail.phone}</div></div>
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.gender}</Text><div className="customer-detail-value">{detail.gender || '-'}</div></div>
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.birth}</Text><div className="customer-detail-value">{formatDate(detail.birth_date, locale)}</div></div>
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.store}</Text><div className="customer-detail-value">{detail.primary_store_name || '-'}</div></div>
                      <div className="customer-detail-item"><Text type="secondary">{t.labels.created}</Text><div className="customer-detail-value">{formatDateTime(detail.created_at, locale)}</div></div>
                      <div className="customer-detail-item customer-detail-item--wide"><Text type="secondary">{t.labels.address}</Text><div className="customer-detail-value">{detail.address || '-'}</div></div>
                    </div>
                  </Space>
                ),
              },
              {
                key: 'transactions',
                label: t.tabs[1],
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><SortHint text={t.hint.tx} /></div>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setSaleOpen(true)}>{t.btn.addDevice}</Button>
                    </div>
                    {orderedTransactions.length === 0 ? <Empty description={t.emptyTab.tx} /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {orderedTransactions.map((record, index) => (
                          <RecordCard
                            key={record.id}
                            title={isZh ? record.product_name : record.product_name_en || record.product_name}
                            subtitle={`${record.product_code} · ${record.store_name}`}
                            badge={<Space size={[8, 8]} wrap><Tag color="blue">{translateCategory(record.category, isZh)}</Tag><Tag>{translateBrand(record.brand, isZh)}</Tag>{index === 0 ? <Tag color="cyan">{t.badge.current}</Tag> : null}</Space>}
                            meta={<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}><div><Text type="secondary">{t.labels.purchaseAt}</Text><div style={{ marginTop: 4 }}>{formatDateTime(record.transaction_date, locale)}</div></div><div><Text type="secondary">{t.labels.qtyPrice}</Text><div style={{ marginTop: 4 }}>{record.quantity} · {formatCurrency(record.unit_price, locale)}</div></div><div><Text type="secondary">{t.labels.spec}</Text><div style={{ marginTop: 4 }}>{record.specification || '-'}</div></div></div>}
                            description={record.remark || undefined}
                            overText={t.badge.drop}
                            isDragging={dragTx === record.id}
                            isOver={overTx === record.id && dragTx !== record.id}
                            onDragStart={() => setDragTx(record.id)}
                            onDragEnter={() => setOverTx(record.id)}
                            onDragEnd={() => { setDragTx(null); setOverTx(null); }}
                            onDrop={() => { if (!dragTx) return; setOrderedTransactions((current) => moveItem(current, dragTx, record.id)); setDragTx(null); setOverTx(null); }}
                          />
                        ))}
                      </div>
                    )}
                  </Space>
                ),
              },
              {
                key: 'repairs',
                label: t.tabs[2],
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><SortHint text={t.hint.rp} /></div>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setRepairOpen(true)}>{t.btn.addRepair}</Button>
                    </div>
                    {orderedRepairs.length === 0 ? <Empty description={t.emptyTab.rp} /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {orderedRepairs.map((record, index) => (
                          <RecordCard
                            key={record.id}
                            title={record.machine_model}
                            subtitle={`${record.store_name} · ${t.labels.receive} ${formatDate(record.receive_date, locale)}`}
                            badge={<Space size={[8, 8]} wrap>{record.status === 'DELIVERED' ? <Tag color="success">{t.status.DELIVERED}</Tag> : record.status === 'FACTORY' ? <Tag color="processing">{t.status.FACTORY}</Tag> : <Tag color="warning">{t.status.PENDING}</Tag>}{index === 0 ? <Tag color="magenta">{t.badge.priority}</Tag> : null}</Space>}
                            meta={<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}><div><Text type="secondary">{t.labels.due}</Text><div style={{ marginTop: 4 }}>{formatDate(record.due_date, locale)}</div></div><div><Text type="secondary">{t.labels.handledBy}</Text><div style={{ marginTop: 4 }}>{record.handled_by_name || '-'}</div></div><div><Text type="secondary">{t.labels.state}</Text><div style={{ marginTop: 4 }}>{record.status === 'DELIVERED' ? <Tag color="success">{t.status.DELIVERED}</Tag> : record.status === 'FACTORY' ? <Tag color="processing">{t.status.FACTORY}</Tag> : <Tag color="warning">{t.status.PENDING}</Tag>}</div></div></div>}
                            description={record.issue_description || undefined}
                            overText={t.badge.drop}
                            isDragging={dragRp === record.id}
                            isOver={overRp === record.id && dragRp !== record.id}
                            onDragStart={() => setDragRp(record.id)}
                            onDragEnter={() => setOverRp(record.id)}
                            onDragEnd={() => { setDragRp(null); setOverRp(null); }}
                            onDrop={() => { if (!dragRp) return; setOrderedRepairs((current) => moveItem(current, dragRp, record.id)); setDragRp(null); setOverRp(null); }}
                          />
                        ))}
                      </div>
                    )}
                  </Space>
                ),
              },
              {
                key: 'fittings',
                label: t.tabs[3],
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><SortHint text={t.hint.ft} /></div>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setFittingOpen(true)}>{t.btn.addFitting}</Button>
                    </div>
                    {orderedFittings.length === 0 ? <Empty description={t.emptyTab.ft} /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {orderedFittings.map((record, index) => (
                          <RecordCard
                            key={record.id}
                            title={record.device_name || record.product_name || t.unnamed}
                            subtitle={`${record.store_name} · ${t.labels.fittingDate} ${formatDate(record.fitting_date, locale)}`}
                            badge={<Space size={[8, 8]} wrap>{record.product_name ? <Tag color="blue">{record.product_name}</Tag> : null}{index === 0 ? <Tag color="geekblue">{t.badge.reference}</Tag> : null}</Space>}
                            meta={<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}><div><Text type="secondary">{t.labels.deviceName}</Text><div style={{ marginTop: 4 }}>{record.device_name || record.product_name || '-'}</div></div><div><Text type="secondary">{t.labels.recordedBy}</Text><div style={{ marginTop: 4 }}>{record.created_by_name || '-'}</div></div></div>}
                            description={record.result_summary || record.fitting_notes || undefined}
                            overText={t.badge.drop}
                            isDragging={dragFt === record.id}
                            isOver={overFt === record.id && dragFt !== record.id}
                            onDragStart={() => setDragFt(record.id)}
                            onDragEnter={() => setOverFt(record.id)}
                            onDragEnd={() => { setDragFt(null); setOverFt(null); }}
                            onDrop={() => { if (!dragFt) return; setOrderedFittings((current) => moveItem(current, dragFt, record.id)); setDragFt(null); setOverFt(null); }}
                          />
                        ))}
                      </div>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}

        <Modal title={t.modal.edit} open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => void submitCustomerEdit()} confirmLoading={updateMutation.isPending} destroyOnClose>
          <Form<CustomerFormValues> form={editForm} layout="vertical" preserve={false}>
            <Form.Item name="name" label={t.labels.name} rules={[{ required: true, message: t.validate.name }]}><Input placeholder={t.placeholder.name} /></Form.Item>
            <Form.Item name="phone" label={t.labels.phone} rules={[{ required: true, message: t.validate.phone }]}><Input placeholder={t.placeholder.phone} /></Form.Item>
            <Form.Item name="gender" label={t.labels.gender}><Input placeholder={t.placeholder.gender} /></Form.Item>
            <Form.Item name="birth_date" label={t.labels.birth}><DatePicker className="w-full" /></Form.Item>
            <Form.Item name="primary_store_id" label={t.labels.store}><Select allowClear options={storeOptions} placeholder={t.placeholder.store} /></Form.Item>
            <Form.Item name="address" label={t.labels.address}><Input.TextArea rows={3} placeholder={t.placeholder.address} /></Form.Item>
          </Form>
        </Modal>

        <Modal title={t.modal.sale} open={saleOpen} onCancel={() => setSaleOpen(false)} onOk={() => void submitSaleRecord()} confirmLoading={saleMutation.isPending} destroyOnClose>
          <Form<SaleRecordFormValues> form={saleForm} layout="vertical" preserve={false}>
            <Form.Item name="store_id" label={t.labels.store} rules={[{ required: true, message: t.validate.store }]}><Select options={storeOptions} placeholder={t.placeholder.store} /></Form.Item>
            <Form.Item name="product_id" label={t.labels.product} rules={[{ required: true, message: t.validate.product }]}>
              <Select showSearch options={productOptions} placeholder={t.placeholder.product} optionFilterProp="label" onChange={(value) => { const product = productOptions.find((item) => item.value === value); if (product) saleForm.setFieldValue('unit_price', product.price); }} />
            </Form.Item>
            <Form.Item name="transaction_date" label={t.labels.purchaseAt} rules={[{ required: true, message: t.validate.purchaseAt }]}><DatePicker showTime className="w-full" /></Form.Item>
            <Form.Item name="quantity" label={t.labels.quantity} rules={[{ required: true, message: t.validate.quantity }]}><InputNumber min={1} precision={0} className="w-full" /></Form.Item>
            <Form.Item name="unit_price" label={t.labels.price} rules={[{ required: true, message: t.validate.price }]}><InputNumber min={0} precision={2} className="w-full" /></Form.Item>
            <Form.Item name="remark" label={t.labels.remark}><Input.TextArea rows={3} placeholder={t.placeholder.remark} /></Form.Item>
          </Form>
        </Modal>

        <Modal title={t.modal.repair} open={repairOpen} onCancel={() => setRepairOpen(false)} onOk={() => void submitRepairRecord()} confirmLoading={repairMutation.isPending} destroyOnClose>
          <Form<RepairFormValues> form={repairForm} layout="vertical" preserve={false}>
            <Form.Item name="store_id" label={t.labels.store} rules={[{ required: true, message: t.validate.store }]}><Select options={storeOptions} placeholder={t.placeholder.store} /></Form.Item>
            <Form.Item name="machine_model" label={t.labels.machine} rules={[{ required: true, message: t.validate.machine }]}><Input placeholder={t.placeholder.machine} /></Form.Item>
            <Form.Item name="receive_date" label={t.labels.receive} rules={[{ required: true, message: t.validate.receive }]}><DatePicker className="w-full" /></Form.Item>
            <Form.Item name="due_date" label={t.labels.due} rules={[{ required: true, message: t.validate.due }]}><DatePicker className="w-full" /></Form.Item>
            <Form.Item name="status" label={t.labels.state} rules={[{ required: true, message: t.validate.state }]}><Select options={[{ label: t.status.PENDING, value: 'PENDING' }, { label: t.status.FACTORY, value: 'FACTORY' }, { label: t.status.DELIVERED, value: 'DELIVERED' }]} /></Form.Item>
            <Form.Item name="issue_description" label={t.labels.issue}><Input.TextArea rows={3} placeholder={t.placeholder.issue} /></Form.Item>
          </Form>
        </Modal>

        <Modal title={t.modal.fitting} open={fittingOpen} onCancel={() => setFittingOpen(false)} onOk={() => void submitFittingRecord()} confirmLoading={fittingMutation.isPending} destroyOnClose>
          <Form<FittingFormValues> form={fittingForm} layout="vertical" preserve={false}>
            <Form.Item name="store_id" label={t.labels.store} rules={[{ required: true, message: t.validate.store }]}><Select options={storeOptions} placeholder={t.placeholder.store} /></Form.Item>
            <Form.Item name="product_id" label={t.labels.product}><Select showSearch allowClear options={productOptions} placeholder={t.placeholder.productOptional} optionFilterProp="label" /></Form.Item>
            <Form.Item name="device_name" label={t.labels.deviceName}><Input placeholder={t.placeholder.device} /></Form.Item>
            <Form.Item name="fitting_date" label={t.labels.fittingDate} rules={[{ required: true, message: t.validate.fittingDate }]}><DatePicker className="w-full" /></Form.Item>
            <Form.Item name="result_summary" label={t.labels.result}><Input.TextArea rows={3} placeholder={t.placeholder.result} /></Form.Item>
            <Form.Item name="fitting_notes" label={t.labels.fittingNotes}><Input.TextArea rows={3} placeholder={t.placeholder.notes} /></Form.Item>
          </Form>
        </Modal>
      </Drawer>
    </>
  );
}
