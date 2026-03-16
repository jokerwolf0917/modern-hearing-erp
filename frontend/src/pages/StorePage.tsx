import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Radio, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

import { createStore, getStores, type CreateStorePayload, type IStore } from '../services/store';

const { Paragraph, Title } = Typography;

interface StoreFormValues {
  name: string;
  address: string;
  phone: string;
  store_type: 'street' | 'hospital';
}

export function StorePage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<StoreFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-US';

  const copy = {
    createSuccess: isZh ? '门店创建成功' : 'Store created successfully.',
    title: isZh ? '门店管理' : 'Store Management',
    description: isZh
      ? '维护门店主数据，为库存、调拨、收银等模块提供统一的真实门店来源。'
      : 'Maintain live store master data used by inventory, transfers and checkout.',
    create: isZh ? '新建门店' : 'New Store',
    total: isZh ? '共 {{count}} 家门店' : '{{count}} stores',
    modalTitle: isZh ? '新建门店' : 'Create Store',
    save: isZh ? '保存门店' : 'Save Store',
    cancel: isZh ? '取消' : 'Cancel',
    name: isZh ? '名称' : 'Name',
    address: isZh ? '地址' : 'Address',
    phone: isZh ? '电话' : 'Phone',
    type: isZh ? '类型' : 'Type',
    createdAt: isZh ? '创建时间' : 'Created At',
    nameRequired: isZh ? '请输入门店名称' : 'Please enter store name.',
    addressRequired: isZh ? '请输入门店地址' : 'Please enter store address.',
    phoneRequired: isZh ? '请输入门店电话' : 'Please enter store phone.',
    namePlaceholder: isZh ? '请输入门店名称' : 'Enter store name',
    addressPlaceholder: isZh ? '请输入门店地址' : 'Enter store address',
    phonePlaceholder: isZh ? '请输入门店电话' : 'Enter store phone',
    storeType: isZh ? '门店类型' : 'Store Type',
    hospital: isZh ? '医院店' : 'Hospital',
    street: isZh ? '街边店' : 'Street',
  };

  function formatDateTime(value: string): string {
    return new Date(value).toLocaleString(locale, { hour12: false });
  }

  function getStoreTypeMeta(value: IStore['store_type']): { label: string; color: string } {
    return value === 'hospital'
      ? { label: copy.hospital, color: 'blue' }
      : { label: copy.street, color: 'green' };
  }

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

  const columns: ColumnsType<IStore> = [
    {
      title: copy.name,
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: copy.type,
      dataIndex: 'store_type',
      key: 'store_type',
      width: 120,
      render: (value: IStore['store_type']) => {
        const meta = getStoreTypeMeta(value);
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
      render: (value: string) => formatDateTime(value),
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Title level={3} className="!mb-2">
                {copy.title}
              </Title>
              <Paragraph type="secondary" className="!mb-0">
                {copy.description}
              </Paragraph>
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              {copy.create}
            </Button>
          </div>

          <Table<IStore>
            rowKey="id"
            columns={columns}
            dataSource={storeQuery.data ?? []}
            loading={storeQuery.isLoading || storeQuery.isFetching}
            pagination={{ pageSize: 10, showTotal: (total) => copy.total.replace('{{count}}', String(total)) }}
            scroll={{ x: 960 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.modalTitle}
        open={isModalOpen}
        onCancel={() => {
          if (createMutation.isPending) {
            return;
          }
          setIsModalOpen(false);
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.save}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<StoreFormValues> form={form} layout="vertical" initialValues={{ store_type: 'street' }}>
          <Form.Item label={copy.name} name="name" rules={[{ required: true, message: copy.nameRequired }]}>
            <Input placeholder={copy.namePlaceholder} maxLength={120} />
          </Form.Item>

          <Form.Item label={copy.address} name="address" rules={[{ required: true, message: copy.addressRequired }]}>
            <Input placeholder={copy.addressPlaceholder} maxLength={255} />
          </Form.Item>

          <Form.Item label={copy.phone} name="phone" rules={[{ required: true, message: copy.phoneRequired }]}>
            <Input placeholder={copy.phonePlaceholder} maxLength={30} />
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
