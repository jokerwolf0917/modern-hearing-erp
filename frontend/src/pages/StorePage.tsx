import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Radio, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createStore, getStores, type CreateStorePayload, type IStore } from '../services/store';

interface StoreFormValues {
  name: string;
  address: string;
  phone: string;
  store_type: 'street' | 'hospital';
}

function getCopy(isZh: boolean) {
  return {
    store: isZh ? '门店' : 'Store',
    searchPlaceholder: isZh ? '输入门店名称、地址或电话搜索' : 'Search by store name, address, or phone',
    search: isZh ? '搜索' : 'Search',
    reset: isZh ? '重置' : 'Reset',
    newStore: isZh ? '新建门店' : 'New Store',
    createSuccess: isZh ? '门店创建成功' : 'Store created successfully',
    storeName: isZh ? '门店名称' : 'Store Name',
    storeType: isZh ? '门店类型' : 'Store Type',
    address: isZh ? '地址' : 'Address',
    phone: isZh ? '电话' : 'Phone',
    createdAt: isZh ? '创建时间' : 'Created At',
    total: (count: number) => (isZh ? `共 ${count} 家门店` : `${count} stores`),
    saveStore: isZh ? '保存门店' : 'Save Store',
    cancel: isZh ? '取消' : 'Cancel',
    inputStoreName: isZh ? '请输入门店名称' : 'Enter store name',
    inputAddress: isZh ? '请输入门店地址' : 'Enter store address',
    inputPhone: isZh ? '请输入门店电话' : 'Enter store phone',
    hospital: isZh ? '医院店' : 'Hospital',
    street: isZh ? '街边店' : 'Street',
  };
}

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { hour12: false });
}

function getStoreTypeMeta(value: IStore['store_type'], isZh: boolean): { label: string; color: string } {
  return value === 'hospital'
    ? { label: isZh ? '医院店' : 'Hospital', color: 'blue' }
    : { label: isZh ? '街边店' : 'Street', color: 'green' };
}

export function StorePage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<StoreFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const copy = getCopy(isZh);
  const dateLocale = isZh ? 'zh-CN' : 'en-AU';

  const storeQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateStorePayload) => createStore(payload),
    onSuccess: async () => {
      messageApi.success(copy.createSuccess);
      setIsModalOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const stores = storeQuery.data ?? [];

  const filteredStores = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return stores;
    }

    return stores.filter((item) => {
      const typeLabel = item.store_type === 'hospital' ? copy.hospital : copy.street;
      return [item.name, item.address ?? '', item.phone ?? '', item.store_type, typeLabel]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [copy.hospital, copy.street, keyword, stores]);

  const columns: ColumnsType<IStore> = [
    {
      title: copy.storeName,
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: copy.storeType,
      dataIndex: 'store_type',
      key: 'store_type',
      width: 140,
      render: (value: IStore['store_type']) => {
        const meta = getStoreTypeMeta(value, isZh);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: copy.address,
      dataIndex: 'address',
      key: 'address',
      render: (value: string | null) => value ?? '-',
    },
    {
      title: copy.phone,
      dataIndex: 'phone',
      key: 'phone',
      width: 160,
      render: (value: string | null) => value ?? '-',
    },
    {
      title: copy.createdAt,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value, dateLocale),
    },
  ];

  const handleCreate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
    } catch {
      // handled by form and mutation
    }
  };

  return (
    <>
      {contextHolder}

      <Card className="rounded-2xl shadow-sm">
        <Space direction="vertical" size="large" className="w-full">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
              <Input
                allowClear
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={() => setKeyword(searchInput.trim())}
                prefix={<SearchOutlined />}
                placeholder={copy.searchPlaceholder}
                style={{ width: 360, maxWidth: '100%' }}
              />
              <Button onClick={() => setKeyword(searchInput.trim())}>{copy.search}</Button>
              <Button
                onClick={() => {
                  setSearchInput('');
                  setKeyword('');
                }}
              >
                {copy.reset}
              </Button>
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              {copy.newStore}
            </Button>
          </div>

          <Table<IStore>
            rowKey="id"
            columns={columns}
            dataSource={filteredStores}
            loading={storeQuery.isLoading || storeQuery.isFetching}
            pagination={{ pageSize: 10, showTotal: (total) => copy.total(total) }}
            scroll={{ x: 960 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.newStore}
        open={isModalOpen}
        onCancel={() => {
          if (!createMutation.isPending) {
            setIsModalOpen(false);
          }
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.saveStore}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<StoreFormValues> form={form} layout="vertical" initialValues={{ store_type: 'street' }}>
          <Form.Item label={copy.storeName} name="name" rules={[{ required: true, message: copy.inputStoreName }]}>
            <Input placeholder={copy.inputStoreName} maxLength={120} />
          </Form.Item>

          <Form.Item label={copy.address} name="address" rules={[{ required: true, message: copy.inputAddress }]}>
            <Input placeholder={copy.inputAddress} maxLength={255} />
          </Form.Item>

          <Form.Item label={copy.phone} name="phone" rules={[{ required: true, message: copy.inputPhone }]}>
            <Input placeholder={copy.inputPhone} maxLength={30} />
          </Form.Item>

          <Form.Item label={copy.storeType} name="store_type">
            <Radio.Group>
              <Radio value="street">{copy.street}</Radio>
              <Radio value="hospital">{copy.hospital}</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
