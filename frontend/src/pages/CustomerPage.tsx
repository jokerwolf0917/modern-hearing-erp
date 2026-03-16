import { DownloadOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer';
import {
  createCustomer,
  getCustomers,
  importCustomers,
  type CreateCustomerPayload,
  type ICustomer,
} from '../services/customer';

const { Dragger } = Upload;
const { Paragraph, Title } = Typography;

interface CustomerFormValues {
  name: string;
  phone: string;
  age: number;
  gender: '男' | '女' | '未知';
  hearing_loss_type: '正常' | '轻度' | '中度' | '重度' | '极重度';
}

export function CustomerPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CustomerFormValues>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-US';

  const genderLabelMap = {
    男: isZh ? '男' : 'Male',
    女: isZh ? '女' : 'Female',
    未知: isZh ? '未知' : 'Unknown',
  } as const;

  const hearingLossLabelMap = {
    正常: isZh ? 'Normal' : 'Normal',
    轻度: isZh ? '轻度' : 'Mild',
    中度: isZh ? '中度' : 'Moderate',
    重度: isZh ? '重度' : 'Severe',
    极重度: isZh ? '极重度' : 'Profound',
  } as const;

  const copy = {
    createSuccess: isZh ? '客户创建成功' : 'Customer created successfully.',
    importSuccess: isZh ? '成功导入 {{count}} 条客户数据' : 'Imported {{count}} customer records successfully.',
    csvOnly: isZh ? '只能上传 CSV 文件' : 'Only CSV files are supported.',
    chooseCsv: isZh ? '请先选择 CSV 文件' : 'Please choose a CSV file first.',
    title: isZh ? '客户管理' : 'Customer Management',
    description: isZh
      ? '管理客户基础档案，支持快速检索、建档，以及 CSV 批量导入提效。'
      : 'Manage customer profiles with quick search, manual creation and CSV bulk import.',
    searchPlaceholder: isZh ? '按姓名或电话搜索' : 'Search by name or phone',
    search: isZh ? '搜索' : 'Search',
    downloadTemplate: isZh ? '下载模板' : 'Download Template',
    import: isZh ? '批量导入' : 'Bulk Import',
    create: isZh ? '新建客户' : 'New Customer',
    total: isZh ? '共 {{count}} 位客户' : '{{count}} customers',
    name: isZh ? '姓名' : 'Name',
    phone: isZh ? '电话' : 'Phone',
    age: isZh ? '年龄' : 'Age',
    gender: isZh ? '性别' : 'Gender',
    hearingLoss: isZh ? '听损类型' : 'Hearing Loss',
    createdAt: isZh ? '建档时间' : 'Created At',
    action: isZh ? '操作' : 'Action',
    details: isZh ? '查看详情' : 'View Details',
    notFilled: isZh ? '未填写' : 'Not set',
    modalTitle: isZh ? '新建客户' : 'Create Customer',
    save: isZh ? '保存客户' : 'Save Customer',
    cancel: isZh ? '取消' : 'Cancel',
    importTitle: isZh ? 'CSV 批量导入客户' : 'Import Customers from CSV',
    importStart: isZh ? '开始导入' : 'Start Import',
    importHint: isZh
      ? '推荐模板列顺序：`name, phone, age, gender, hearing_loss_type`'
      : 'Recommended column order: `name, phone, age, gender, hearing_loss_type`',
    uploadText: isZh ? '点击或拖拽 CSV 文件到这里' : 'Click or drag a CSV file here',
    uploadHint: isZh ? '仅支持 .csv 文件，导入后会自动刷新客户列表。' : 'Only .csv files are supported. The list refreshes after import.',
    nameRequired: isZh ? '请输入姓名' : 'Please enter name.',
    phoneRequired: isZh ? '请输入电话' : 'Please enter phone.',
    ageRequired: isZh ? '请输入年龄' : 'Please enter age.',
    genderRequired: isZh ? '请选择性别' : 'Please select gender.',
    hearingLossRequired: isZh ? '请选择听损类型' : 'Please select hearing loss level.',
    namePlaceholder: isZh ? '请输入客户姓名' : 'Enter customer name',
    phonePlaceholder: isZh ? '请输入联系电话' : 'Enter phone number',
    agePlaceholder: isZh ? '请输入年龄' : 'Enter age',
  };

  const hearingLossOptions = [
    { value: '正常', label: hearingLossLabelMap.正常 },
    { value: '轻度', label: hearingLossLabelMap.轻度 },
    { value: '中度', label: hearingLossLabelMap.中度 },
    { value: '重度', label: hearingLossLabelMap.重度 },
    { value: '极重度', label: hearingLossLabelMap.极重度 },
  ];

  function formatDateTime(value: string): string {
    return new Date(value).toLocaleString(locale, { hour12: false });
  }

  function getHearingLossColor(value: string | null): string {
    const mapping: Record<string, string> = {
      正常: 'green',
      轻度: 'lime',
      中度: 'gold',
      重度: 'orange',
      极重度: 'red',
    };

    return value ? mapping[value] ?? 'default' : 'default';
  }

  function downloadCustomerTemplate(): void {
    const csvContent =
      'name,phone,age,gender,hearing_loss_type\nAlice,13800000000,65,女,中度\nBob,13900000000,58,男,轻度\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customer-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const columns: ColumnsType<ICustomer> = [
    { title: copy.name, dataIndex: 'name', key: 'name', width: 120 },
    { title: copy.phone, dataIndex: 'phone', key: 'phone', width: 160 },
    {
      title: copy.age,
      dataIndex: 'age',
      key: 'age',
      width: 100,
      render: (value: number | null) => value ?? '-',
    },
    {
      title: copy.gender,
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (value: keyof typeof genderLabelMap | null) => (value ? genderLabelMap[value] : '-'),
    },
    {
      title: copy.hearingLoss,
      dataIndex: 'hearing_loss_type',
      key: 'hearing_loss_type',
      width: 130,
      render: (value: keyof typeof hearingLossLabelMap | null) => (
        <Tag color={getHearingLossColor(value)}>{value ? hearingLossLabelMap[value] : copy.notFilled}</Tag>
      ),
    },
    {
      title: copy.createdAt,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: copy.action,
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedCustomer(record);
            setIsDrawerOpen(true);
          }}
        >
          {copy.details}
        </Button>
      ),
    },
  ];

  const customerQuery = useQuery({
    queryKey: ['customers', searchKeyword, page, pageSize],
    queryFn: () =>
      getCustomers({
        q: searchKeyword || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => createCustomer(payload),
    onSuccess: async () => {
      messageApi.success(copy.createSuccess);
      setIsModalOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importCustomers(file),
    onSuccess: async (result) => {
      messageApi.success(copy.importSuccess.replace('{{count}}', String(result.imported_count)));
      setIsImportModalOpen(false);
      setImportFileList([]);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const handleSearch = (): void => {
    setPage(1);
    setSearchKeyword(searchInput.trim());
  };

  const handleCreate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
    } catch {
      // handled by form and mutation
    }
  };

  const uploadProps: UploadProps = {
    accept: '.csv',
    maxCount: 1,
    beforeUpload: (file) => {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (!isCsv) {
        messageApi.error(copy.csvOnly);
        return Upload.LIST_IGNORE;
      }

      setImportFileList([
        {
          uid: file.uid,
          name: file.name,
          status: 'done',
        },
      ]);
      return false;
    },
    onRemove: () => {
      setImportFileList([]);
      return true;
    },
    fileList: importFileList,
  };

  const handleImport = async (): Promise<void> => {
    const file = importFileList[0]?.originFileObj;
    if (!file) {
      messageApi.warning(copy.chooseCsv);
      return;
    }

    try {
      await importMutation.mutateAsync(file);
    } catch {
      // handled by request layer
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

            <Space wrap>
              <Input
                allowClear
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                placeholder={copy.searchPlaceholder}
                className="w-[280px]"
              />
              <Button onClick={handleSearch}>{copy.search}</Button>
              <Button icon={<DownloadOutlined />} onClick={downloadCustomerTemplate}>
                {copy.downloadTemplate}
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setIsImportModalOpen(true)}>
                {copy.import}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                {copy.create}
              </Button>
            </Space>
          </div>

          <Table<ICustomer>
            rowKey="id"
            columns={columns}
            dataSource={customerQuery.data?.items ?? []}
            loading={customerQuery.isLoading || customerQuery.isFetching}
            pagination={{
              current: page,
              pageSize,
              total: customerQuery.data?.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => copy.total.replace('{{count}}', String(total)),
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
            scroll={{ x: 980 }}
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
        <Form<CustomerFormValues> form={form} layout="vertical" initialValues={{ gender: '未知', hearing_loss_type: '轻度' }}>
          <Form.Item label={copy.name} name="name" rules={[{ required: true, message: copy.nameRequired }]}>
            <Input placeholder={copy.namePlaceholder} maxLength={120} />
          </Form.Item>
          <Form.Item label={copy.phone} name="phone" rules={[{ required: true, message: copy.phoneRequired }]}>
            <Input placeholder={copy.phonePlaceholder} maxLength={30} />
          </Form.Item>
          <Form.Item label={copy.age} name="age" rules={[{ required: true, message: copy.ageRequired }]}>
            <InputNumber className="w-full" min={0} max={120} precision={0} placeholder={copy.agePlaceholder} />
          </Form.Item>
          <Form.Item label={copy.gender} name="gender" rules={[{ required: true, message: copy.genderRequired }]}>
            <Radio.Group>
              <Radio value="男">{genderLabelMap.男}</Radio>
              <Radio value="女">{genderLabelMap.女}</Radio>
              <Radio value="未知">{genderLabelMap.未知}</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label={copy.hearingLoss} name="hearing_loss_type" rules={[{ required: true, message: copy.hearingLossRequired }]}>
            <Select options={hearingLossOptions} placeholder={copy.hearingLossRequired} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={copy.importTitle}
        open={isImportModalOpen}
        onCancel={() => {
          if (importMutation.isPending) {
            return;
          }
          setIsImportModalOpen(false);
          setImportFileList([]);
        }}
        onOk={() => void handleImport()}
        confirmLoading={importMutation.isPending}
        okText={copy.importStart}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Space direction="vertical" size="middle" className="w-full">
          <Paragraph type="secondary" className="!mb-0">
            {copy.importHint}
          </Paragraph>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{copy.uploadText}</p>
            <p className="ant-upload-hint">{copy.uploadHint}</p>
          </Dragger>
        </Space>
      </Modal>

      <CustomerDetailDrawer
        customer={selectedCustomer}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedCustomer(null);
        }}
      />
    </>
  );
}
