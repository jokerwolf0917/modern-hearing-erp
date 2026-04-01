import { DownloadOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, DatePicker, Form, Input, Modal, Popover, Select, Space, Table, Tag, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createRepairRecord,
  exportRepairs,
  getCustomers,
  getRepairs,
  importRepairs,
  type RepairRecordResponse,
} from '../services/api';
import { getStores, type IStore } from '../services/store';

type StoreFilterValue = 'ALL' | string;

interface RepairFormValues {
  customer_id: string;
  store_id: string;
  machine_model: string;
  receive_date: Dayjs;
  due_date: Dayjs;
  issue_description?: string;
  status: 'PENDING' | 'FACTORY' | 'DELIVERED';
}

interface RepairCopy {
  allStores: string;
  untitledCustomer: string;
  status: {
    delivered: string;
    factory: string;
    pending: string;
    overdue: string;
    dueSoon: string;
  };
  preview: {
    machineModel: string;
    receiveDate: string;
    dueDate: string;
    issueDescription: string;
  };
  messages: {
    created: string;
    createFailed: string;
    imported: (imported: number, skipped: number) => string;
    importFailed: string;
    exported: string;
  };
  table: {
    store: string;
    customerName: string;
    phone: string;
    machineModel: string;
    receiveDate: string;
    dueDate: string;
    status: string;
  };
  toolbar: {
    keywordPlaceholder: string;
    search: string;
    reset: string;
    import: string;
    export: string;
    create: string;
  };
  modal: {
    title: string;
    customer: string;
    customerPlaceholder: string;
    store: string;
    storePlaceholder: string;
    machineModel: string;
    machineModelPlaceholder: string;
    receiveDate: string;
    dueDate: string;
    status: string;
    issueDescription: string;
    issueDescriptionPlaceholder: string;
    validateCustomer: string;
    validateStore: string;
    validateMachineModel: string;
    validateReceiveDate: string;
    validateDueDate: string;
    validateStatus: string;
  };
}

function getCopy(isZh: boolean): RepairCopy {
  if (isZh) {
    return {
      allStores: '全部门店',
      untitledCustomer: '未命名客户',
      status: {
        delivered: '已交付',
        factory: '返厂',
        pending: '待修',
        overdue: '已超期',
        dueSoon: '临近交付',
      },
      preview: {
        machineModel: '机器型号',
        receiveDate: '送修日期',
        dueDate: '预计交付',
        issueDescription: '故障描述',
      },
      messages: {
        created: '维修记录已新增',
        createFailed: '新增维修记录失败',
        imported: (imported, skipped) => `导入完成，成功导入 ${imported} 条，跳过 ${skipped} 条`,
        importFailed: '批量导入失败',
        exported: '维修记录已导出',
      },
      table: {
        store: '门店',
        customerName: '客户姓名',
        phone: '电话',
        machineModel: '机器型号',
        receiveDate: '送修日期',
        dueDate: '预计交付日',
        status: '状态',
      },
      toolbar: {
        keywordPlaceholder: '输入客户姓名、电话或机器型号搜索',
        search: '搜索',
        reset: '重置',
        import: '导入记录',
        export: '导出记录',
        create: '新建维修',
      },
      modal: {
        title: '新建维修',
        customer: '客户',
        customerPlaceholder: '选择客户',
        store: '门店',
        storePlaceholder: '选择门店',
        machineModel: '机器型号',
        machineModelPlaceholder: '例如：Signia Pure 312 X',
        receiveDate: '送修日期',
        dueDate: '预计交付日',
        status: '状态',
        issueDescription: '故障描述',
        issueDescriptionPlaceholder: '请输入故障描述',
        validateCustomer: '请选择客户',
        validateStore: '请选择门店',
        validateMachineModel: '请输入机器型号',
        validateReceiveDate: '请选择送修日期',
        validateDueDate: '请选择预计交付日',
        validateStatus: '请选择状态',
      },
    };
  }

  return {
    allStores: 'All stores',
    untitledCustomer: 'Unnamed customer',
    status: {
      delivered: 'Delivered',
      factory: 'Factory',
      pending: 'Pending',
      overdue: 'Overdue',
      dueSoon: 'Due soon',
    },
    preview: {
      machineModel: 'Device model',
      receiveDate: 'Received',
      dueDate: 'Due date',
      issueDescription: 'Issue',
    },
    messages: {
      created: 'Repair record created',
      createFailed: 'Failed to create repair record',
      imported: (imported, skipped) => `Import complete. Added ${imported} records and skipped ${skipped}.`,
      importFailed: 'Bulk import failed',
      exported: 'Repair records exported',
    },
    table: {
      store: 'Store',
      customerName: 'Customer',
      phone: 'Phone',
      machineModel: 'Device model',
      receiveDate: 'Received',
      dueDate: 'Due date',
      status: 'Status',
    },
    toolbar: {
      keywordPlaceholder: 'Search by customer, phone or device model',
      search: 'Search',
      reset: 'Reset',
      import: 'Import',
      export: 'Export',
      create: 'New repair',
    },
    modal: {
      title: 'New repair',
      customer: 'Customer',
      customerPlaceholder: 'Select customer',
      store: 'Store',
      storePlaceholder: 'Select store',
      machineModel: 'Device model',
      machineModelPlaceholder: 'For example: Signia Pure 312 X',
      receiveDate: 'Received date',
      dueDate: 'Due date',
      status: 'Status',
      issueDescription: 'Issue description',
      issueDescriptionPlaceholder: 'Describe the reported issue',
      validateCustomer: 'Please select a customer',
      validateStore: 'Please select a store',
      validateMachineModel: 'Please enter a device model',
      validateReceiveDate: 'Please select a received date',
      validateDueDate: 'Please select a due date',
      validateStatus: 'Please select a status',
    },
  };
}

function formatDate(value: string, locale: string): string {
  return dayjs(value).locale(locale).format('YYYY-MM-DD');
}

function buildStoreOptions(
  stores: IStore[],
  isAdmin: boolean,
  allStoresLabel: string,
): Array<{ label: string; value: StoreFilterValue }> {
  const base = stores.map((store) => ({ label: store.name, value: store.id }));
  return isAdmin ? [{ label: allStoresLabel, value: 'ALL' }, ...base] : base;
}

function renderStatusTag(status: RepairRecordResponse['status'], copy: RepairCopy): JSX.Element {
  if (status === 'DELIVERED') return <Tag color="success">{copy.status.delivered}</Tag>;
  if (status === 'FACTORY') return <Tag color="processing">{copy.status.factory}</Tag>;
  return <Tag color="warning">{copy.status.pending}</Tag>;
}

function renderDueDate(status: RepairRecordResponse['status'], dueDate: string, copy: RepairCopy, locale: string): JSX.Element {
  if (status === 'DELIVERED') {
    return <Tag color="success">{copy.status.delivered}</Tag>;
  }

  const today = dayjs().startOf('day');
  const due = dayjs(dueDate).startOf('day');
  const diffDays = due.diff(today, 'day');

  if (due.isBefore(today, 'day')) {
    return (
      <Space size={8}>
        <Tag color="error">{copy.status.overdue}</Tag>
        <span>{formatDate(dueDate, locale)}</span>
      </Space>
    );
  }

  if (diffDays <= 3) {
    return (
      <Space size={8}>
        <Tag color="warning">{copy.status.dueSoon}</Tag>
        <span>{formatDate(dueDate, locale)}</span>
      </Space>
    );
  }

  return <span>{formatDate(dueDate, locale)}</span>;
}

function renderRepairPreview(record: RepairRecordResponse, copy: RepairCopy, locale: string): JSX.Element {
  return (
    <div className="w-[320px]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{record.customer_name || copy.untitledCustomer}</div>
        <div className="mt-1 text-xs text-slate-500">{record.customer_phone || '-'}</div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {renderStatusTag(record.status, copy)}
        <Tag>{record.store_name}</Tag>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.machineModel}</span>
          <span>{record.machine_model}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.receiveDate}</span>
          <span>{formatDate(record.receive_date, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.dueDate}</span>
          <span>{formatDate(record.due_date, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.issueDescription}</span>
          <span className="max-w-[200px] text-right">{record.issue_description || '-'}</span>
        </div>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function RepairDashboard(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-cn' : 'en-au';
  const copy = useMemo(() => getCopy(isZh), [isZh]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<RepairFormValues>();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const isAdmin = employee?.role === 'ADMIN';
  const preferredAdminStore = settings.defaultStoreId ?? 'ALL';
  const [selectedStore, setSelectedStore] = useState<StoreFilterValue>(
    preferredAdminStore === null ? 'ALL' : preferredAdminStore,
  );

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  useEffect(() => {
    if (!employee) return;
    if (isAdmin) {
      setSelectedStore((previous) => previous || (preferredAdminStore === null ? 'ALL' : preferredAdminStore));
      return;
    }
    if (employee.store_id) {
      setSelectedStore(employee.store_id);
    }
  }, [employee, isAdmin, preferredAdminStore]);

  const effectiveStoreId =
    isAdmin ? (selectedStore === 'ALL' ? undefined : selectedStore) : employee?.store_id ?? undefined;

  const repairsQuery = useQuery({
    queryKey: ['repairs', searchKeyword, effectiveStoreId],
    queryFn: () =>
      getRepairs({
        search: searchKeyword || undefined,
        store_id: effectiveStoreId,
      }),
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'repair-form-options', effectiveStoreId],
    queryFn: () =>
      getCustomers({
        page: 1,
        page_size: 100,
        store_id: effectiveStoreId,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (values: RepairFormValues) =>
      createRepairRecord({
        customer_id: values.customer_id,
        store_id: values.store_id,
        machine_model: values.machine_model.trim(),
        receive_date: values.receive_date.format('YYYY-MM-DD'),
        due_date: values.due_date.format('YYYY-MM-DD'),
        issue_description: values.issue_description?.trim() || null,
        status: values.status,
      }),
    onSuccess: async () => {
      messageApi.success(copy.messages.created);
      setCreateOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['repairs'] });
      await queryClient.invalidateQueries({ queryKey: ['customer-details'] });
    },
    onError: (error: unknown) => {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail as string)
          : copy.messages.createFailed;
      messageApi.error(detail);
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importRepairs(file),
    onSuccess: async (result) => {
      messageApi.success(copy.messages.imported(result.imported_count, result.skipped_count));
      await queryClient.invalidateQueries({ queryKey: ['repairs'] });
    },
    onError: (error: unknown) => {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
          ? ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail as string)
          : copy.messages.importFailed;
      messageApi.error(detail);
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportRepairs,
    onSuccess: (blob) => {
      downloadBlob(blob, `repairs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
      messageApi.success(copy.messages.exported);
    },
  });

  const storeOptions = useMemo(
    () => buildStoreOptions(storesQuery.data ?? [], isAdmin, copy.allStores),
    [storesQuery.data, isAdmin, copy.allStores],
  );

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.items ?? []).map((customer) => ({
        label: `${customer.name} | ${customer.phone}`,
        value: customer.id,
      })),
    [customersQuery.data],
  );

  const sortedData = useMemo(
    () =>
      [...(repairsQuery.data ?? [])].sort(
        (left, right) => dayjs(left.due_date).valueOf() - dayjs(right.due_date).valueOf(),
      ),
    [repairsQuery.data],
  );

  const columns: ColumnsType<RepairRecordResponse> = useMemo(
    () => [
      {
        title: copy.table.store,
        dataIndex: 'store_name',
        key: 'store_name',
        width: 160,
      },
      {
        title: copy.table.customerName,
        dataIndex: 'customer_name',
        key: 'customer_name',
        width: 160,
        render: (value, record) => (
          <Popover placement="rightTop" content={renderRepairPreview(record, copy, locale)} trigger="hover">
            <span className="cursor-pointer font-medium text-slate-900">{value || '-'}</span>
          </Popover>
        ),
      },
      {
        title: copy.table.phone,
        dataIndex: 'customer_phone',
        key: 'customer_phone',
        width: 150,
      },
      {
        title: copy.table.machineModel,
        dataIndex: 'machine_model',
        key: 'machine_model',
        render: (value, record) => (
          <Popover placement="rightTop" content={renderRepairPreview(record, copy, locale)} trigger="hover">
            <span className="cursor-pointer text-slate-700">{value}</span>
          </Popover>
        ),
      },
      {
        title: copy.table.receiveDate,
        dataIndex: 'receive_date',
        key: 'receive_date',
        width: 140,
        sorter: (left, right) => dayjs(left.receive_date).valueOf() - dayjs(right.receive_date).valueOf(),
        render: (value: string) => formatDate(value, locale),
      },
      {
        title: copy.table.dueDate,
        dataIndex: 'due_date',
        key: 'due_date',
        width: 220,
        defaultSortOrder: 'ascend',
        sorter: (left, right) => dayjs(left.due_date).valueOf() - dayjs(right.due_date).valueOf(),
        render: (value: string, record) => renderDueDate(record.status, value, copy, locale),
      },
      {
        title: copy.table.status,
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: RepairRecordResponse['status']) => renderStatusTag(value, copy),
      },
    ],
    [copy, locale],
  );

  function openCreateModal(): void {
    form.resetFields();
    form.setFieldsValue({
      store_id: effectiveStoreId,
      receive_date: dayjs(),
      due_date: dayjs().add(7, 'day'),
      status: 'PENDING',
    });
    setCreateOpen(true);
  }

  function handleSearch(): void {
    setSearchKeyword(searchInput.trim());
  }

  function handleReset(): void {
    setSearchInput('');
    setSearchKeyword('');
    if (isAdmin) {
      setSelectedStore(preferredAdminStore === null ? 'ALL' : preferredAdminStore);
    }
  }

  return (
    <>
      {contextHolder}

      <Card bodyStyle={{ padding: 20 }}>
        <Space direction="vertical" size="middle" className="w-full">
          <div className="page-toolbar">
            <div className="toolbar-filters toolbar-filters--search">
              <Select
                className="toolbar-select"
                value={isAdmin ? selectedStore : employee?.store_id ?? undefined}
                options={storeOptions}
                loading={storesQuery.isLoading}
                disabled={!isAdmin}
                onChange={(value) => setSelectedStore(value)}
              />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={copy.toolbar.keywordPlaceholder}
                className="toolbar-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={handleSearch}
              />
              <Button onClick={handleSearch}>{copy.toolbar.search}</Button>
              <Button onClick={handleReset}>{copy.toolbar.reset}</Button>
            </div>

            <div className="toolbar-actions">
              {isAdmin ? (
                <Upload
                  accept=".csv"
                  showUploadList={false}
                  beforeUpload={(file: File) => {
                    void importMutation.mutateAsync(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={importMutation.isPending}>
                    {copy.toolbar.import}
                  </Button>
                </Upload>
              ) : null}

              {isAdmin ? (
                <Button
                  icon={<DownloadOutlined />}
                  loading={exportMutation.isPending}
                  onClick={() => void exportMutation.mutateAsync()}
                >
                  {copy.toolbar.export}
                </Button>
              ) : null}

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                {copy.toolbar.create}
              </Button>
            </div>
          </div>

          <Table<RepairRecordResponse>
            rowKey="id"
            columns={columns}
            dataSource={sortedData}
            loading={repairsQuery.isLoading || repairsQuery.isFetching}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1100 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.modal.title}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<RepairFormValues>
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={(values) => void createMutation.mutateAsync(values)}
        >
          <Form.Item name="customer_id" label={copy.modal.customer} rules={[{ required: true, message: copy.modal.validateCustomer }]}>
            <Select showSearch optionFilterProp="label" placeholder={copy.modal.customerPlaceholder} options={customerOptions} />
          </Form.Item>
          <Form.Item name="store_id" label={copy.modal.store} rules={[{ required: true, message: copy.modal.validateStore }]}>
            <Select
              placeholder={copy.modal.storePlaceholder}
              options={(storesQuery.data ?? []).map((store) => ({ label: store.name, value: store.id }))}
              disabled={!isAdmin}
            />
          </Form.Item>
          <Form.Item
            name="machine_model"
            label={copy.modal.machineModel}
            rules={[{ required: true, message: copy.modal.validateMachineModel }]}
          >
            <Input placeholder={copy.modal.machineModelPlaceholder} />
          </Form.Item>
          <Form.Item
            name="receive_date"
            label={copy.modal.receiveDate}
            rules={[{ required: true, message: copy.modal.validateReceiveDate }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            name="due_date"
            label={copy.modal.dueDate}
            rules={[{ required: true, message: copy.modal.validateDueDate }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="status" label={copy.modal.status} rules={[{ required: true, message: copy.modal.validateStatus }]}>
            <Select
              options={[
                { label: copy.status.pending, value: 'PENDING' },
                { label: copy.status.factory, value: 'FACTORY' },
                { label: copy.status.delivered, value: 'DELIVERED' },
              ]}
            />
          </Form.Item>
          <Form.Item name="issue_description" label={copy.modal.issueDescription}>
            <Input.TextArea rows={3} placeholder={copy.modal.issueDescriptionPlaceholder} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
