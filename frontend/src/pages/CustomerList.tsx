import { DownloadOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomerDrawer } from '../components/CustomerDrawer';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createCustomer,
  exportCustomers,
  getCustomers,
  importCustomers,
  type CustomerCreatePayload,
  type CustomerResponse,
} from '../services/api';
import { type IStore, getStores } from '../services/store';

type StoreFilterValue = 'ALL' | string;

interface CustomerFormValues {
  name: string;
  phone: string;
  gender?: string;
  birth_date?: Dayjs;
  address?: string;
  primary_store_id?: string;
}

interface CustomerCopy {
  allStores: string;
  preview: {
    primaryStore: string;
    gender: string;
    birthDate: string;
    address: string;
    createdAt: string;
  };
  messages: {
    created: string;
    imported: (count: number) => string;
    exported: string;
    duplicate: string;
  };
  table: {
    name: string;
    phone: string;
    store: string;
    gender: string;
    birthDate: string;
    address: string;
    createdAt: string;
    action: string;
    details: string;
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
    name: string;
    phone: string;
    gender: string;
    birthDate: string;
    address: string;
    store: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    genderPlaceholder: string;
    addressPlaceholder: string;
    storePlaceholder: string;
    validateName: string;
    validatePhone: string;
  };
  pagination: (total: number) => string;
}

function getCopy(isZh: boolean): CustomerCopy {
  if (isZh) {
    return {
      allStores: '全部门店',
      preview: {
        primaryStore: '所属门店',
        gender: '性别',
        birthDate: '生日',
        address: '地址',
        createdAt: '建档时间',
      },
      messages: {
        created: '客户创建成功',
        imported: (count) => `导入完成，成功导入 ${count} 条客户记录`,
        exported: '客户数据已导出',
        duplicate: '该客户已存在（姓名、电话、性别、生日完全一致），禁止重复录入',
      },
      table: {
        name: '姓名',
        phone: '电话',
        store: '所属门店',
        gender: '性别',
        birthDate: '生日',
        address: '地址',
        createdAt: '建档时间',
        action: '操作',
        details: '查看详情',
      },
      toolbar: {
        keywordPlaceholder: '输入姓名或电话搜索',
        search: '搜索',
        reset: '重置',
        import: '导入记录',
        export: '导出记录',
        create: '新建客户',
      },
      modal: {
        title: '新建客户',
        name: '姓名',
        phone: '电话',
        gender: '性别',
        birthDate: '生日',
        address: '地址',
        store: '所属门店',
        namePlaceholder: '请输入客户姓名',
        phonePlaceholder: '请输入联系电话',
        genderPlaceholder: '如：男 / 女 / 未知',
        addressPlaceholder: '请输入地址',
        storePlaceholder: '选择所属门店',
        validateName: '请输入姓名',
        validatePhone: '请输入电话',
      },
      pagination: (total) => `共 ${total} 位客户`,
    };
  }

  return {
    allStores: 'All stores',
    preview: {
      primaryStore: 'Primary store',
      gender: 'Gender',
      birthDate: 'Birth date',
      address: 'Address',
      createdAt: 'Created at',
    },
    messages: {
      created: 'Customer created successfully',
      imported: (count) => `Import complete. Added ${count} customer records.`,
      exported: 'Customer data exported',
      duplicate: 'This customer already exists (same name, phone, gender and birth date).',
    },
    table: {
      name: 'Name',
      phone: 'Phone',
      store: 'Store',
      gender: 'Gender',
      birthDate: 'Birth date',
      address: 'Address',
      createdAt: 'Created at',
      action: 'Action',
      details: 'View details',
    },
    toolbar: {
      keywordPlaceholder: 'Search by name or phone',
      search: 'Search',
      reset: 'Reset',
      import: 'Import',
      export: 'Export',
      create: 'New customer',
    },
    modal: {
      title: 'New customer',
      name: 'Name',
      phone: 'Phone',
      gender: 'Gender',
      birthDate: 'Birth date',
      address: 'Address',
      store: 'Primary store',
      namePlaceholder: 'Enter customer name',
      phonePlaceholder: 'Enter contact number',
      genderPlaceholder: 'For example: Male / Female / Unknown',
      addressPlaceholder: 'Enter address',
      storePlaceholder: 'Select primary store',
      validateName: 'Please enter a name',
      validatePhone: 'Please enter a phone number',
    },
    pagination: (total) => `${total} customers`,
  };
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '-';
  return dayjs(value).locale(locale).format('YYYY-MM-DD');
}

function formatDateTime(value: string, locale: string): string {
  return dayjs(value).locale(locale).format('YYYY-MM-DD HH:mm');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildStoreOptions(
  stores: IStore[],
  isAdmin: boolean,
  allStoresLabel: string,
): Array<{ label: string; value: StoreFilterValue }> {
  const base = stores.map((store) => ({ label: store.name, value: store.id }));
  return isAdmin ? [{ label: allStoresLabel, value: 'ALL' }, ...base] : base;
}

function renderCustomerPreview(record: CustomerResponse, copy: CustomerCopy, locale: string): JSX.Element {
  return (
    <div className="w-[320px]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{record.name}</div>
        <div className="mt-1 text-xs text-slate-500">{record.phone}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.primaryStore}</span>
          <span>{record.primary_store_name || '-'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.gender}</span>
          <span>{record.gender || '-'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.birthDate}</span>
          <span>{formatDate(record.birth_date, locale)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.address}</span>
          <span className="max-w-[200px] text-right">{record.address || '-'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-400">{copy.preview.createdAt}</span>
          <span>{formatDateTime(record.created_at, locale)}</span>
        </div>
      </div>
    </div>
  );
}

export function CustomerList(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CustomerFormValues>();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-cn' : 'en-au';
  const copy = useMemo(() => getCopy(isZh), [isZh]);
  const queryClient = useQueryClient();
  const { employee: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const preferredAdminStore = settings.defaultStoreId ?? 'ALL';
  const [selectedStore, setSelectedStore] = useState<StoreFilterValue>(
    preferredAdminStore === null ? 'ALL' : preferredAdminStore,
  );

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  useEffect(() => {
    if (!currentUser) return;
    if (isAdmin) {
      setSelectedStore((previous) => previous || (preferredAdminStore === null ? 'ALL' : preferredAdminStore));
      return;
    }
    if (currentUser.store_id) {
      setSelectedStore(currentUser.store_id);
    }
  }, [currentUser, isAdmin, preferredAdminStore]);

  const effectiveStoreId =
    isAdmin ? (selectedStore === 'ALL' ? undefined : selectedStore) : currentUser?.store_id ?? undefined;

  const customerQuery = useQuery({
    queryKey: ['customers', keyword, page, pageSize, effectiveStoreId],
    queryFn: () =>
      getCustomers({
        q: keyword || undefined,
        page,
        page_size: pageSize,
        store_id: effectiveStoreId,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CustomerCreatePayload) => createCustomer(payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.created);
      setCreateOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importCustomers(file),
    onSuccess: async (result) => {
      messageApi.success(copy.messages.imported(result.imported_count));
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportCustomers,
    onSuccess: (blob) => {
      downloadBlob(blob, 'customers.csv');
      messageApi.success(copy.messages.exported);
    },
  });

  const storeOptions = useMemo(
    () => buildStoreOptions(storesQuery.data ?? [], isAdmin, copy.allStores),
    [storesQuery.data, isAdmin, copy.allStores],
  );

  const columns: ColumnsType<CustomerResponse> = useMemo(
    () => [
      {
        title: copy.table.name,
        dataIndex: 'name',
        key: 'name',
        width: 160,
        render: (value: string, record) => (
          <Popover placement="rightTop" content={renderCustomerPreview(record, copy, locale)} trigger="hover">
            <span className="cursor-pointer font-medium text-slate-900">{value}</span>
          </Popover>
        ),
      },
      { title: copy.table.phone, dataIndex: 'phone', key: 'phone', width: 160 },
      {
        title: copy.table.store,
        dataIndex: 'primary_store_name',
        key: 'primary_store_name',
        width: 180,
        render: (value: string | null) => value || '-',
      },
      {
        title: copy.table.gender,
        dataIndex: 'gender',
        key: 'gender',
        width: 100,
        render: (value: string | null) => value || '-',
      },
      {
        title: copy.table.birthDate,
        dataIndex: 'birth_date',
        key: 'birth_date',
        width: 140,
        render: (value: string | null) => formatDate(value, locale),
      },
      {
        title: copy.table.address,
        dataIndex: 'address',
        key: 'address',
        render: (value: string | null) => value || '-',
      },
      {
        title: copy.table.createdAt,
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value: string) => formatDateTime(value, locale),
      },
      {
        title: copy.table.action,
        key: 'action',
        width: 120,
        render: (_value, record) => (
          <Button
            type="link"
            onClick={() => {
              setSelectedCustomerId(record.id);
              setDrawerOpen(true);
            }}
          >
            {copy.table.details}
          </Button>
        ),
      },
    ],
    [copy, locale],
  );

  async function handleCreate(): Promise<void> {
    try {
      const values = await form.validateFields();
      const primaryStoreId = isAdmin ? values.primary_store_id || null : currentUser?.store_id ?? null;

      await createMutation.mutateAsync({
        name: values.name.trim(),
        phone: values.phone.trim(),
        gender: values.gender?.trim() || null,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        address: values.address?.trim() || null,
        primary_store_id: primaryStoreId,
      });
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        messageApi.error(copy.messages.duplicate);
      }
    }
  }

  function handleSearch(): void {
    setPage(1);
    setKeyword(keywordInput.trim());
  }

  function handleReset(): void {
    setKeywordInput('');
    setKeyword('');
    setPage(1);
    if (isAdmin) {
      setSelectedStore(preferredAdminStore === null ? 'ALL' : preferredAdminStore);
    }
  }

  function openCreateModal(): void {
    form.resetFields();
    form.setFieldsValue({
      primary_store_id: isAdmin
        ? selectedStore === 'ALL'
          ? undefined
          : selectedStore
        : currentUser?.store_id ?? undefined,
    });
    setCreateOpen(true);
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
                value={isAdmin ? selectedStore : currentUser?.store_id ?? undefined}
                options={storeOptions}
                loading={storesQuery.isLoading}
                disabled={!isAdmin}
                onChange={(value) => {
                  setPage(1);
                  setSelectedStore(value);
                }}
              />
              <Input
                allowClear
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                placeholder={copy.toolbar.keywordPlaceholder}
                className="toolbar-search"
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

          <Table<CustomerResponse>
            rowKey="id"
            columns={columns}
            dataSource={customerQuery.data?.items ?? []}
            loading={customerQuery.isLoading || customerQuery.isFetching}
            pagination={{
              current: page,
              pageSize,
              total: customerQuery.data?.total ?? 0,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
              showSizeChanger: true,
              showTotal: (total) => copy.pagination(total),
            }}
            scroll={{ x: 1100 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.modal.title}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<CustomerFormValues> form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label={copy.modal.name} rules={[{ required: true, message: copy.modal.validateName }]}>
            <Input placeholder={copy.modal.namePlaceholder} />
          </Form.Item>
          <Form.Item
            name="phone"
            label={copy.modal.phone}
            rules={[{ required: true, message: copy.modal.validatePhone }]}
          >
            <Input placeholder={copy.modal.phonePlaceholder} />
          </Form.Item>
          <Form.Item name="gender" label={copy.modal.gender}>
            <Input placeholder={copy.modal.genderPlaceholder} />
          </Form.Item>
          <Form.Item name="birth_date" label={copy.modal.birthDate}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="address" label={copy.modal.address}>
            <Input.TextArea rows={3} placeholder={copy.modal.addressPlaceholder} />
          </Form.Item>
          {isAdmin ? (
            <Form.Item name="primary_store_id" label={copy.modal.store}>
              <Select
                placeholder={copy.modal.storePlaceholder}
                options={(storesQuery.data ?? []).map((store) => ({ label: store.name, value: store.id }))}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <CustomerDrawer
        customerId={selectedCustomerId}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCustomerId(null);
        }}
      />
    </>
  );
}
