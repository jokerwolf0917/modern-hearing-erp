import { DownloadOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
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

import {
  createProduct,
  getProducts,
  importProducts,
  updateProduct,
  type CreateProductPayload,
  type IProduct,
  type UpdateProductPayload,
} from '../services/product';

const { Dragger } = Upload;
const { Paragraph, Text, Title } = Typography;

interface ProductFormValues {
  name: string;
  sku: string;
  category: string;
  retail_price: number;
  cost_price: number;
  brand: string;
  manufacturer: string;
  registration_no: string;
  has_sn_tracking: boolean;
}

function toPrice(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function ProductPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ProductFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-US';

  const copy = {
    createSuccess: isZh ? '商品创建成功' : 'Product created successfully.',
    updateSuccess: isZh ? '商品更新成功' : 'Product updated successfully.',
    importSuccess: isZh ? '成功导入 {{count}} 条商品数据' : 'Imported {{count}} product records successfully.',
    csvOnly: isZh ? '只能上传 CSV 文件' : 'Only CSV files are supported.',
    chooseCsv: isZh ? '请先选择 CSV 文件' : 'Please choose a CSV file first.',
    title: isZh ? '商品管理' : 'Product Management',
    description: isZh
      ? '维护商品主数据，统一管理品牌、价格、医疗监管字段和 SN 追踪策略。'
      : 'Maintain product master data with pricing, brand, regulatory fields and SN tracking policies.',
    downloadTemplate: isZh ? '下载模板' : 'Download Template',
    import: isZh ? '批量导入' : 'Bulk Import',
    create: isZh ? '新建商品' : 'New Product',
    total: isZh ? '共 {{count}} 个商品' : '{{count}} products',
    productName: isZh ? '商品名称' : 'Product',
    sku: 'SKU',
    category: isZh ? '商品类型' : 'Category',
    brand: isZh ? '品牌' : 'Brand',
    costPrice: isZh ? '成本价' : 'Cost Price',
    retailPrice: isZh ? '零售价' : 'Retail Price',
    snEnabled: isZh ? '是否机编' : 'Serial Tracking',
    action: isZh ? '操作' : 'Action',
    edit: isZh ? '编辑' : 'Edit',
    snTracking: isZh ? 'SN 追踪' : 'SN Tracking',
    regularProduct: isZh ? '普通商品' : 'Regular Product',
    modalEdit: isZh ? '编辑商品' : 'Edit Product',
    modalCreate: isZh ? '新建商品' : 'Create Product',
    saveEdit: isZh ? '保存修改' : 'Save Changes',
    saveCreate: isZh ? '保存商品' : 'Save Product',
    cancel: isZh ? '取消' : 'Cancel',
    basic: isZh ? '基本信息' : 'Basic Information',
    finance: isZh ? '财务信息' : 'Financial Information',
    regulatory: isZh ? '医疗监管信息' : 'Regulatory Information',
    nameRequired: isZh ? '请输入商品名称' : 'Please enter product name.',
    skuRequired: isZh ? '请输入 SKU' : 'Please enter SKU.',
    categoryRequired: isZh ? '请输入商品类型' : 'Please enter category.',
    brandRequired: isZh ? '请输入品牌' : 'Please enter brand.',
    retailRequired: isZh ? '请输入零售价' : 'Please enter retail price.',
    costRequired: isZh ? '请输入成本价' : 'Please enter cost price.',
    manufacturerRequired: isZh ? '请输入生产厂家' : 'Please enter manufacturer.',
    registrationRequired: isZh ? '请输入医疗器械注册证号' : 'Please enter registration number.',
    namePlaceholder: isZh ? '请输入商品名称' : 'Enter product name',
    skuPlaceholder: isZh ? '请输入商品 SKU' : 'Enter product SKU',
    categoryPlaceholder: isZh ? '例如：助听器 / 配件' : 'Example: Hearing Aid / Accessory',
    brandPlaceholder: isZh ? '例如：SIGNIA / PHONAK' : 'Example: SIGNIA / PHONAK',
    manufacturerPlaceholder: isZh ? '请输入生产厂家' : 'Enter manufacturer',
    registrationPlaceholder: isZh ? '请输入医疗器械注册证号' : 'Enter registration number',
    snLabel: isZh ? '启用机编 / SN 追踪' : 'Enable SN Tracking',
    snExtra: isZh
      ? '开启后，该商品入库和销售必须扫码追踪唯一序列号。'
      : 'When enabled, stock-in and sales must bind unique serial numbers.',
    snOn: isZh ? '启用 SN' : 'SN On',
    snOff: isZh ? '普通商品' : 'Regular',
    importTitle: isZh ? 'CSV 批量导入商品' : 'Import Products from CSV',
    importStart: isZh ? '开始导入' : 'Start Import',
    importHint: isZh ? '推荐模板列顺序：`name, sku, category, retail_price`' : 'Recommended column order: `name, sku, category, retail_price`',
    uploadText: isZh ? '点击或拖拽 CSV 文件到这里' : 'Click or drag a CSV file here',
    uploadHint: isZh ? '仅支持 .csv 文件，导入后会自动刷新商品列表。' : 'Only .csv files are supported. The list refreshes after import.',
  };

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(value);
  }

  function currencyFormatter(value: string | number | undefined): string {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    return `¥ ${value}`;
  }

  function currencyParser(value: string | undefined): string {
    return (value ?? '').replace(/[¥,\s]/g, '');
  }

  function downloadProductTemplate(): void {
    const csvContent =
      'name,sku,category,retail_price\nSignia Pure 312 X BTE,SIG-BTE-100,Hearing Aid,6500.00\nEar Dome,ACC-EAR-001,Accessory,39.00\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const productQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(payload),
    onSuccess: async () => {
      messageApi.success(copy.createSuccess);
      closeProductModal();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: UpdateProductPayload }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      messageApi.success(copy.updateSuccess);
      closeProductModal();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importProducts(file),
    onSuccess: async (result) => {
      messageApi.success(copy.importSuccess.replace('{{count}}', String(result.imported_count)));
      setIsImportModalOpen(false);
      setImportFileList([]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const columns: ColumnsType<IProduct> = [
    { title: copy.productName, dataIndex: 'name', key: 'name', width: 220 },
    { title: copy.sku, dataIndex: 'sku', key: 'sku', width: 160 },
    { title: copy.category, dataIndex: 'category', key: 'category', width: 140 },
    { title: copy.brand, dataIndex: 'brand', key: 'brand', width: 120, render: (value: string | null) => value ?? '-' },
    {
      title: copy.costPrice,
      dataIndex: 'cost_price',
      key: 'cost_price',
      width: 130,
      render: (value: number | string) => formatCurrency(toPrice(value)),
    },
    {
      title: copy.retailPrice,
      dataIndex: 'retail_price',
      key: 'retail_price',
      width: 130,
      render: (value: number | string) => formatCurrency(toPrice(value)),
    },
    {
      title: copy.snEnabled,
      dataIndex: 'has_sn_tracking',
      key: 'has_sn_tracking',
      width: 120,
      render: (value: boolean) => <Tag color={value ? 'blue' : 'default'}>{value ? copy.snTracking : copy.regularProduct}</Tag>,
    },
    {
      title: copy.action,
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingProduct(record);
            form.setFieldsValue({
              name: record.name,
              sku: record.sku,
              category: record.category,
              retail_price: toPrice(record.retail_price),
              cost_price: toPrice(record.cost_price),
              brand: record.brand ?? '',
              manufacturer: record.manufacturer ?? '',
              registration_no: record.registration_no ?? '',
              has_sn_tracking: record.has_sn_tracking,
            });
            setIsModalOpen(true);
          }}
        >
          {copy.edit}
        </Button>
      ),
    },
  ];

  function closeProductModal(): void {
    setIsModalOpen(false);
    setEditingProduct(null);
    form.resetFields();
  }

  const handleCreateOrUpdate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      if (editingProduct) {
        await updateMutation.mutateAsync({
          productId: editingProduct.id,
          payload: values,
        });
        return;
      }
      await createMutation.mutateAsync(values);
    } catch {
      // handled by form
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

  const modalBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {contextHolder}

      <Card className="rounded-3xl">
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
              <Button icon={<DownloadOutlined />} onClick={downloadProductTemplate}>
                {copy.downloadTemplate}
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setIsImportModalOpen(true)}>
                {copy.import}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingProduct(null);
                  form.resetFields();
                  form.setFieldsValue({ has_sn_tracking: false });
                  setIsModalOpen(true);
                }}
              >
                {copy.create}
              </Button>
            </Space>
          </div>

          <Table<IProduct>
            rowKey="id"
            columns={columns}
            dataSource={productQuery.data ?? []}
            loading={productQuery.isLoading || productQuery.isFetching}
            pagination={{ pageSize: 10, showTotal: (total) => copy.total.replace('{{count}}', String(total)) }}
            scroll={{ x: 1320 }}
          />
        </Space>
      </Card>

      <Modal
        title={editingProduct ? copy.modalEdit : copy.modalCreate}
        open={isModalOpen}
        onCancel={() => {
          if (!modalBusy) {
            closeProductModal();
          }
        }}
        onOk={() => void handleCreateOrUpdate()}
        confirmLoading={modalBusy}
        okText={editingProduct ? copy.saveEdit : copy.saveCreate}
        cancelText={copy.cancel}
        width={920}
        destroyOnHidden
      >
        <Form<ProductFormValues> form={form} layout="vertical" initialValues={{ has_sn_tracking: false }}>
          <Divider orientation="left">{copy.basic}</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={copy.productName} name="name" rules={[{ required: true, message: copy.nameRequired }]}>
                <Input placeholder={copy.namePlaceholder} maxLength={150} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.sku} name="sku" rules={[{ required: true, message: copy.skuRequired }]}>
                <Input placeholder={copy.skuPlaceholder} maxLength={64} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.category} name="category" rules={[{ required: true, message: copy.categoryRequired }]}>
                <Input placeholder={copy.categoryPlaceholder} maxLength={80} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.brand} name="brand" rules={[{ required: true, message: copy.brandRequired }]}>
                <Input placeholder={copy.brandPlaceholder} maxLength={80} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={copy.snLabel} name="has_sn_tracking" valuePropName="checked" extra={<Text type="secondary">{copy.snExtra}</Text>}>
                <Switch checkedChildren={copy.snOn} unCheckedChildren={copy.snOff} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">{copy.finance}</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={copy.retailPrice} name="retail_price" rules={[{ required: true, message: copy.retailRequired }]}>
                <InputNumber className="w-full" min={0.01} precision={2} formatter={currencyFormatter} parser={currencyParser} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.costPrice} name="cost_price" rules={[{ required: true, message: copy.costRequired }]}>
                <InputNumber className="w-full" min={0} precision={2} formatter={currencyFormatter} parser={currencyParser} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">{copy.regulatory}</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={isZh ? '生产厂家' : 'Manufacturer'} name="manufacturer" rules={[{ required: true, message: copy.manufacturerRequired }]}>
                <Input placeholder={copy.manufacturerPlaceholder} maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={isZh ? '医疗器械注册证号' : 'Registration No.'} name="registration_no" rules={[{ required: true, message: copy.registrationRequired }]}>
                <Input placeholder={copy.registrationPlaceholder} maxLength={120} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={copy.importTitle}
        open={isImportModalOpen}
        onCancel={() => {
          if (!importMutation.isPending) {
            setIsImportModalOpen(false);
            setImportFileList([]);
          }
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
    </>
  );
}
