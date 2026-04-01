import { DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
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
  Popover,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createProduct,
  exportProducts,
  getProducts,
  importProducts,
  type IProduct,
  type ProductPayload,
  updateProduct,
} from '../services/product';
import { getStores, type IStore } from '../services/store';

type StoreFilterValue = 'ALL' | string;

interface ProductFormValues {
  product_code: string;
  category: string;
  brand: string;
  name_cn: string;
  name_en?: string;
  specification?: string;
  matrix?: string;
  original_price: number;
  unit?: string;
  remark?: string;
}

interface ProductCopy {
  allStores: string;
  preview: {
    englishName: string;
    specification: string;
    matrix: string;
    originalPrice: string;
    unit: string;
    remark: string;
  };
  messages: {
    created: string;
    updated: string;
    imported: (imported: number, skipped: number) => string;
    exported: string;
    selectCsvFirst: string;
  };
  table: {
    productCode: string;
    category: string;
    brand: string;
    nameCn: string;
    nameEn: string;
    specification: string;
    matrix: string;
    originalPrice: string;
    unit: string;
    remark: string;
    action: string;
    edit: string;
    hoverHint: string;
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
    editTitle: string;
    createTitle: string;
    sectionBasic: string;
    productCode: string;
    category: string;
    brand: string;
    nameCn: string;
    nameEn: string;
    specification: string;
    matrix: string;
    unit: string;
    originalPrice: string;
    remark: string;
    productCodePlaceholder: string;
    categoryPlaceholder: string;
    brandPlaceholder: string;
    nameCnPlaceholder: string;
    nameEnPlaceholder: string;
    specificationPlaceholder: string;
    matrixPlaceholder: string;
    unitPlaceholder: string;
    remarkPlaceholder: string;
    validateProductCode: string;
    validateCategory: string;
    validateBrand: string;
    validateNameCn: string;
    validateOriginalPrice: string;
  };
  importModal: {
    title: string;
    selectFile: string;
  };
}

function getCopy(isZh: boolean): ProductCopy {
  if (isZh) {
    return {
      allStores: '全部门店',
      preview: {
        englishName: '英文名称',
        specification: '规格',
        matrix: '矩阵 / 型号',
        originalPrice: '原价',
        unit: '单位',
        remark: '备注',
      },
      messages: {
        created: '商品创建成功',
        updated: '商品更新成功',
        imported: (imported, skipped) => `导入完成，成功写入 ${imported} 条，跳过 ${skipped} 条`,
        exported: '商品资料已导出',
        selectCsvFirst: '请先选择 CSV 文件',
      },
      table: {
        productCode: '产品编号',
        category: '类别',
        brand: '品牌',
        nameCn: '中文名称',
        nameEn: '英文名称',
        specification: '规格',
        matrix: '矩阵 / 型号',
        originalPrice: '原价',
        unit: '单位',
        remark: '备注',
        action: '操作',
        edit: '编辑',
        hoverHint: '悬停查看完整参数',
      },
      toolbar: {
        keywordPlaceholder: '输入产品编号、名称、品牌、类别或规格搜索',
        search: '搜索',
        reset: '重置',
        import: '批量导入',
        export: '导出资料',
        create: '新建商品',
      },
      modal: {
        editTitle: '编辑商品',
        createTitle: '新建商品',
        sectionBasic: '基础资料',
        productCode: '产品编号',
        category: '类别',
        brand: '品牌',
        nameCn: '中文名称',
        nameEn: '英文名称',
        specification: '规格',
        matrix: '矩阵 / 型号',
        unit: '单位',
        originalPrice: '原价',
        remark: '备注',
        productCodePlaceholder: '例如：SIG-312-X',
        categoryPlaceholder: '选择产品类别',
        brandPlaceholder: '选择产品品牌',
        nameCnPlaceholder: '请输入中文名称',
        nameEnPlaceholder: '请输入英文名称',
        specificationPlaceholder: '请输入规格',
        matrixPlaceholder: '请输入矩阵或型号',
        unitPlaceholder: '例如：台 / 对 / 盒',
        remarkPlaceholder: '补充说明，例如适用门店、渠道备注、库存提示等',
        validateProductCode: '请输入产品编号',
        validateCategory: '请选择类别',
        validateBrand: '请选择品牌',
        validateNameCn: '请输入中文名称',
        validateOriginalPrice: '请输入原价',
      },
      importModal: {
        title: '批量导入商品',
        selectFile: '选择 CSV 文件',
      },
    };
  }

  return {
    allStores: 'All stores',
    preview: {
      englishName: 'English name',
      specification: 'Specification',
      matrix: 'Matrix / model',
      originalPrice: 'Original price',
      unit: 'Unit',
      remark: 'Remark',
    },
    messages: {
      created: 'Product created successfully',
      updated: 'Product updated successfully',
      imported: (imported, skipped) => `Import complete. Added ${imported} products and skipped ${skipped}.`,
      exported: 'Product catalog exported',
      selectCsvFirst: 'Please select a CSV file first',
    },
    table: {
      productCode: 'Product code',
      category: 'Category',
      brand: 'Brand',
      nameCn: 'Chinese name',
      nameEn: 'English name',
      specification: 'Specification',
      matrix: 'Matrix / model',
      originalPrice: 'Original price',
      unit: 'Unit',
      remark: 'Remark',
      action: 'Action',
      edit: 'Edit',
      hoverHint: 'Hover to view full details',
    },
    toolbar: {
      keywordPlaceholder: 'Search by code, name, brand, category or specification',
      search: 'Search',
      reset: 'Reset',
      import: 'Import',
      export: 'Export',
      create: 'New product',
    },
    modal: {
      editTitle: 'Edit product',
      createTitle: 'New product',
      sectionBasic: 'Basic information',
      productCode: 'Product code',
      category: 'Category',
      brand: 'Brand',
      nameCn: 'Chinese name',
      nameEn: 'English name',
      specification: 'Specification',
      matrix: 'Matrix / model',
      unit: 'Unit',
      originalPrice: 'Original price',
      remark: 'Remark',
      productCodePlaceholder: 'For example: SIG-312-X',
      categoryPlaceholder: 'Select category',
      brandPlaceholder: 'Select brand',
      nameCnPlaceholder: 'Enter Chinese name',
      nameEnPlaceholder: 'Enter English name',
      specificationPlaceholder: 'Enter specification',
      matrixPlaceholder: 'Enter matrix or model',
      unitPlaceholder: 'For example: unit / pair / box',
      remarkPlaceholder: 'Add optional notes such as store scope, channel note or stock hint',
      validateProductCode: 'Please enter a product code',
      validateCategory: 'Please select a category',
      validateBrand: 'Please select a brand',
      validateNameCn: 'Please enter a Chinese name',
      validateOriginalPrice: 'Please enter an original price',
    },
    importModal: {
      title: 'Import products',
      selectFile: 'Select CSV file',
    },
  };
}

function getBrandOptions(isZh: boolean): Array<{ label: string; value: string }> {
  return [
    { label: isZh ? '西嘉 / SIGNIA' : 'Signia / SIGNIA', value: 'SIGNIA' },
    { label: isZh ? '峰力 / PHONAK' : 'Phonak / PHONAK', value: 'PHONAK' },
    { label: isZh ? '飞利浦 / PHILIPS' : 'Philips / PHILIPS', value: 'PHILIPS' },
    { label: isZh ? '西门子 / SIEMENS' : 'Siemens / SIEMENS', value: 'SIEMENS' },
    { label: 'POWERONE', value: 'POWERONE' },
    { label: isZh ? '至力 / ZHILI' : 'Zhili / ZHILI', value: 'ZHILI' },
  ];
}

function getCategoryOptions(isZh: boolean): Array<{ label: string; value: string }> {
  return [
    { label: 'BTE', value: 'BTE' },
    { label: 'RIC', value: 'RIC' },
    { label: 'ITC', value: 'ITC' },
    { label: 'ITE', value: 'ITE' },
    { label: 'IIC', value: 'IIC' },
    { label: 'CIC', value: 'CIC' },
    { label: 'IIC/CIC', value: 'IIC/CIC' },
    { label: isZh ? '标准机' : 'Standard', value: '标准机' },
    { label: isZh ? '耳背机' : 'Behind-the-ear', value: '耳背机' },
    { label: isZh ? '定制机' : 'Custom', value: '定制机' },
    { label: isZh ? '2.0受话器' : 'Receiver 2.0', value: '2.0受话器' },
    { label: isZh ? '3.0受话器' : 'Receiver 3.0', value: '3.0受话器' },
    { label: isZh ? '充电器' : 'Charger', value: '充电器' },
    { label: isZh ? '耳模' : 'Ear mold', value: '耳模' },
    { label: isZh ? '配件' : 'Accessory', value: '配件' },
    { label: isZh ? '护理宝' : 'Care kit', value: '护理宝' },
    { label: isZh ? '同声移' : 'CROS', value: '同声移' },
    { label: 'Demo', value: 'Demo机' },
    { label: isZh ? '电池' : 'Battery', value: '电池' },
  ];
}

function translateBrand(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, { zh: string; en: string }> = {
    SIGNIA: { zh: '西嘉', en: 'Signia' },
    PHONAK: { zh: '峰力', en: 'Phonak' },
    PHILIPS: { zh: '飞利浦', en: 'Philips' },
    SIEMENS: { zh: '西门子', en: 'Siemens' },
    POWERONE: { zh: 'POWERONE', en: 'POWERONE' },
    ZHILI: { zh: '至力', en: 'Zhili' },
  };
  return map[value]?.[isZh ? 'zh' : 'en'] ?? value;
}

function translateCategory(value: string | null | undefined, isZh: boolean): string {
  if (!value) return '-';
  const map: Record<string, { zh: string; en: string }> = {
    BTE: { zh: 'BTE', en: 'BTE' },
    RIC: { zh: 'RIC', en: 'RIC' },
    ITC: { zh: 'ITC', en: 'ITC' },
    ITE: { zh: 'ITE', en: 'ITE' },
    IIC: { zh: 'IIC', en: 'IIC' },
    CIC: { zh: 'CIC', en: 'CIC' },
    'IIC/CIC': { zh: 'IIC/CIC', en: 'IIC/CIC' },
    标准机: { zh: '标准机', en: 'Standard' },
    耳背机: { zh: '耳背机', en: 'Behind-the-ear' },
    定制机: { zh: '定制机', en: 'Custom' },
    '2.0受话器': { zh: '2.0受话器', en: 'Receiver 2.0' },
    '3.0受话器': { zh: '3.0受话器', en: 'Receiver 3.0' },
    充电器: { zh: '充电器', en: 'Charger' },
    耳模: { zh: '耳模', en: 'Ear mold' },
    配件: { zh: '配件', en: 'Accessory' },
    护理宝: { zh: '护理宝', en: 'Care kit' },
    同声移: { zh: '同声移', en: 'CROS' },
    Demo机: { zh: 'Demo机', en: 'Demo' },
    电池: { zh: '电池', en: 'Battery' },
  };
  return map[value]?.[isZh ? 'zh' : 'en'] ?? value;
}

function compareText(left?: string | null, right?: string | null): number {
  return (left ?? '').localeCompare(right ?? '', 'zh-CN');
}

function compareNumber(left: number | string, right: number | string): number {
  return Number(left) - Number(right);
}

function formatCurrency(value: number | string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(Number(value));
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

function renderPreviewField(label: string, value: string | number | null | undefined): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="max-w-[220px] text-right text-sm text-slate-700">{value || '-'}</span>
    </div>
  );
}

function renderProductPreview(product: IProduct, copy: ProductCopy, isZh: boolean, locale: string): JSX.Element {
  return (
    <div className="w-[340px]">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{isZh ? product.name_cn : product.name_en || product.name_cn}</div>
        <div className="mt-1 text-xs text-slate-500">{product.product_code}</div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Tag color="blue">{translateCategory(product.category, isZh)}</Tag>
        <Tag>{translateBrand(product.brand, isZh)}</Tag>
      </div>
      <div className="divide-y divide-slate-100">
        {renderPreviewField(copy.preview.englishName, product.name_en)}
        {renderPreviewField(copy.preview.specification, product.specification)}
        {renderPreviewField(copy.preview.matrix, product.matrix)}
        {renderPreviewField(copy.preview.originalPrice, formatCurrency(product.original_price, locale))}
        {renderPreviewField(copy.preview.unit, product.unit)}
        {renderPreviewField(copy.preview.remark, product.remark)}
      </div>
    </div>
  );
}

export function ProductPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ProductFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const copy = useMemo(() => getCopy(isZh), [isZh]);
  const brandOptions = useMemo(() => getBrandOptions(isZh), [isZh]);
  const categoryOptions = useMemo(() => getCategoryOptions(isZh), [isZh]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
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

  const productQuery = useQuery({
    queryKey: ['products', effectiveStoreId],
    queryFn: () => getProducts(effectiveStoreId),
  });

  const filteredProducts = useMemo(() => {
    const source = productQuery.data ?? [];
    const needle = keyword.trim().toLowerCase();
    if (!needle) return source;

    return source.filter((item) =>
      [
        item.product_code,
        translateCategory(item.category, isZh),
        translateBrand(item.brand, isZh),
        item.name_cn,
        item.name_en,
        item.specification,
        item.matrix,
        item.unit,
        item.remark,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [isZh, keyword, productQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.created);
      closeProductModal();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductPayload }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.updated);
      closeProductModal();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importProducts(file),
    onSuccess: async (result) => {
      messageApi.success(copy.messages.imported(result.imported_count, result.skipped_count));
      setIsImportModalOpen(false);
      setImportFileList([]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportProducts,
    onSuccess: (blob) => {
      downloadBlob(blob, `products-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
      messageApi.success(copy.messages.exported);
    },
  });

  const storeOptions = useMemo(
    () => buildStoreOptions(storesQuery.data ?? [], isAdmin, copy.allStores),
    [storesQuery.data, isAdmin, copy.allStores],
  );

  const columns: ColumnsType<IProduct> = useMemo(
    () => [
      {
        title: copy.table.productCode,
        dataIndex: 'product_code',
        key: 'product_code',
        width: 160,
        fixed: 'left',
        sorter: (a, b) => compareText(a.product_code, b.product_code),
        sortDirections: ['ascend', 'descend'],
        render: (_value, record) => (
          <Popover placement="rightTop" content={renderProductPreview(record, copy, isZh, locale)} trigger="hover">
            <div className="cursor-pointer">
              <div className="font-medium text-slate-900">{record.product_code}</div>
              <div className="text-xs text-slate-400">{copy.table.hoverHint}</div>
            </div>
          </Popover>
        ),
      },
      {
        title: copy.table.category,
        key: 'category_display',
        width: 120,
        sorter: (a, b) => compareText(translateCategory(a.category, isZh), translateCategory(b.category, isZh)),
        sortDirections: ['ascend', 'descend'],
        render: (_, record) => translateCategory(record.category, isZh),
      },
      {
        title: copy.table.brand,
        key: 'brand_display',
        width: 120,
        sorter: (a, b) => compareText(translateBrand(a.brand, isZh), translateBrand(b.brand, isZh)),
        sortDirections: ['ascend', 'descend'],
        render: (_, record) => translateBrand(record.brand, isZh),
      },
      {
        title: copy.table.nameCn,
        dataIndex: 'name_cn',
        key: 'name_cn',
        width: 220,
        sorter: (a, b) => compareText(a.name_cn, b.name_cn),
        sortDirections: ['ascend', 'descend'],
        render: (value, record) => (
          <Popover placement="rightTop" content={renderProductPreview(record, copy, isZh, locale)} trigger="hover">
            <span className="cursor-pointer font-medium text-slate-900">{value}</span>
          </Popover>
        ),
      },
      {
        title: copy.table.nameEn,
        dataIndex: 'name_en',
        key: 'name_en',
        width: 220,
        sorter: (a, b) => compareText(a.name_en, b.name_en),
        sortDirections: ['ascend', 'descend'],
        render: (value) => value || '-',
      },
      {
        title: copy.table.specification,
        dataIndex: 'specification',
        key: 'specification',
        width: 180,
        sorter: (a, b) => compareText(a.specification, b.specification),
        sortDirections: ['ascend', 'descend'],
        render: (value) => value || '-',
      },
      {
        title: copy.table.matrix,
        dataIndex: 'matrix',
        key: 'matrix',
        width: 160,
        sorter: (a, b) => compareText(a.matrix, b.matrix),
        sortDirections: ['ascend', 'descend'],
        render: (value) => value || '-',
      },
      {
        title: copy.table.originalPrice,
        dataIndex: 'original_price',
        key: 'original_price',
        width: 140,
        sorter: (a, b) => compareNumber(a.original_price, b.original_price),
        sortDirections: ['ascend', 'descend'],
        render: (value: number | string) => formatCurrency(value, locale),
      },
      {
        title: copy.table.unit,
        dataIndex: 'unit',
        key: 'unit',
        width: 100,
        sorter: (a, b) => compareText(a.unit, b.unit),
        sortDirections: ['ascend', 'descend'],
        render: (value) => value || '-',
      },
      {
        title: copy.table.remark,
        dataIndex: 'remark',
        key: 'remark',
        width: 220,
        sorter: (a, b) => compareText(a.remark, b.remark),
        sortDirections: ['ascend', 'descend'],
        render: (value) => value || '-',
      },
      {
        title: copy.table.action,
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingProduct(record);
              form.setFieldsValue({
                product_code: record.product_code,
                category: record.category,
                brand: record.brand,
                name_cn: record.name_cn,
                name_en: record.name_en ?? undefined,
                specification: record.specification ?? undefined,
                matrix: record.matrix ?? undefined,
                original_price: Number(record.original_price),
                unit: record.unit ?? undefined,
                remark: record.remark ?? undefined,
              });
              setIsModalOpen(true);
            }}
          >
            {copy.table.edit}
          </Button>
        ),
      },
    ],
    [copy, form, isZh, locale],
  );

  function closeProductModal(): void {
    setIsModalOpen(false);
    setEditingProduct(null);
    form.resetFields();
  }

  async function handleCreateOrUpdate(): Promise<void> {
    try {
      const values = await form.validateFields();
      const payload: ProductPayload = {
        product_code: values.product_code.trim(),
        category: values.category,
        brand: values.brand,
        name_cn: values.name_cn.trim(),
        name_en: values.name_en?.trim() || null,
        specification: values.specification?.trim() || null,
        matrix: values.matrix?.trim() || null,
        original_price: values.original_price,
        unit: values.unit?.trim() || null,
        remark: values.remark?.trim() || null,
      };

      if (editingProduct) {
        await updateMutation.mutateAsync({ productId: editingProduct.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      return;
    }
  }

  async function handleImport(): Promise<void> {
    const file = importFileList[0]?.originFileObj;
    if (!file) {
      messageApi.warning(copy.messages.selectCsvFirst);
      return;
    }

    await importMutation.mutateAsync(file);
  }

  function handleSearch(): void {
    setKeyword(keywordInput.trim());
  }

  function handleReset(): void {
    setKeywordInput('');
    setKeyword('');
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
              <Button icon={<UploadOutlined />} onClick={() => setIsImportModalOpen(true)}>
                {copy.toolbar.import}
              </Button>
              <Button icon={<DownloadOutlined />} loading={exportMutation.isPending} onClick={() => void exportMutation.mutateAsync()}>
                {copy.toolbar.export}
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingProduct(null);
                  form.resetFields();
                  setIsModalOpen(true);
                }}
              >
                {copy.toolbar.create}
              </Button>
            </div>
          </div>

          <Table<IProduct>
            rowKey="id"
            columns={columns}
            dataSource={filteredProducts}
            loading={productQuery.isLoading || productQuery.isFetching}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1800 }}
          />
        </Space>
      </Card>

      <Modal
        title={editingProduct ? copy.modal.editTitle : copy.modal.createTitle}
        open={isModalOpen}
        onCancel={closeProductModal}
        onOk={() => void handleCreateOrUpdate()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={920}
        destroyOnClose
      >
        <Form<ProductFormValues> form={form} layout="vertical" preserve={false}>
          <Divider orientation="left">{copy.modal.sectionBasic}</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={copy.modal.productCode}
                name="product_code"
                rules={[{ required: true, message: copy.modal.validateProductCode }]}
              >
                <Input placeholder={copy.modal.productCodePlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={copy.modal.category}
                name="category"
                rules={[{ required: true, message: copy.modal.validateCategory }]}
              >
                <Select showSearch optionFilterProp="label" options={categoryOptions} placeholder={copy.modal.categoryPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.modal.brand} name="brand" rules={[{ required: true, message: copy.modal.validateBrand }]}>
                <Select showSearch optionFilterProp="label" options={brandOptions} placeholder={copy.modal.brandPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={copy.modal.nameCn}
                name="name_cn"
                rules={[{ required: true, message: copy.modal.validateNameCn }]}
              >
                <Input placeholder={copy.modal.nameCnPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.modal.nameEn} name="name_en">
                <Input placeholder={copy.modal.nameEnPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.modal.specification} name="specification">
                <Input placeholder={copy.modal.specificationPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.modal.matrix} name="matrix">
                <Input placeholder={copy.modal.matrixPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={copy.modal.unit} name="unit">
                <Input placeholder={copy.modal.unitPlaceholder} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={copy.modal.originalPrice}
                name="original_price"
                rules={[{ required: true, message: copy.modal.validateOriginalPrice }]}
              >
                <InputNumber className="w-full" min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={copy.modal.remark} name="remark">
                <Input.TextArea rows={3} placeholder={copy.modal.remarkPlaceholder} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={copy.importModal.title}
        open={isImportModalOpen}
        onCancel={() => {
          setIsImportModalOpen(false);
          setImportFileList([]);
        }}
        onOk={() => void handleImport()}
        confirmLoading={importMutation.isPending}
        destroyOnClose
      >
        <Space direction="vertical" size="middle" className="w-full">
          <Upload
            accept=".csv"
            fileList={importFileList}
            maxCount={1}
            beforeUpload={(file) => {
              setImportFileList([
                {
                  uid: file.uid,
                  name: file.name,
                  status: 'done',
                  originFileObj: file,
                },
              ]);
              return false;
            }}
            onRemove={() => {
              setImportFileList([]);
              return true;
            }}
          >
            <Button icon={<UploadOutlined />}>{copy.importModal.selectFile}</Button>
          </Upload>
        </Space>
      </Modal>
    </>
  );
}
