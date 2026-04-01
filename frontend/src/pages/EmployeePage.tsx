import { EditOutlined, LockOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import {
  createEmployee,
  getEmployees,
  resetEmployeePassword,
  toggleEmployeeActive,
  updateEmployee,
  type CreateEmployeePayload,
  type EmployeeRole,
  type IEmployeeRecord,
  type UpdateEmployeePayload,
} from '../services/employee';
import { getStores } from '../services/store';

interface CreateEmployeeFormValues {
  username: string;
  password: string;
  role: EmployeeRole;
  store_id?: string;
}

interface EditEmployeeFormValues {
  username: string;
  role: EmployeeRole;
  store_id?: string;
}

interface ResetPasswordValues {
  new_password: string;
}

function getCopy(isZh: boolean) {
  return {
    username: isZh ? '用户名' : 'Username',
    role: isZh ? '角色' : 'Role',
    store: isZh ? '所属门店' : 'Assigned Store',
    status: isZh ? '状态' : 'Status',
    actions: isZh ? '操作' : 'Actions',
    active: isZh ? '启用' : 'Active',
    inactive: isZh ? '禁用' : 'Disabled',
    admin: isZh ? '管理员' : 'Admin',
    manager: isZh ? '店长' : 'Store Manager',
    staff: isZh ? '店员' : 'Staff',
    searchPlaceholder: isZh ? '输入用户名、角色或门店搜索' : 'Search by username, role, or store',
    search: isZh ? '搜索' : 'Search',
    reset: isZh ? '重置' : 'Reset',
    newEmployee: isZh ? '新建员工' : 'New Employee',
    createSuccess: isZh ? '员工创建成功' : 'Employee created successfully',
    updateSuccess: isZh ? '员工信息更新成功' : 'Employee updated successfully',
    enableSuccess: isZh ? '账号已启用' : 'Account enabled',
    disableSuccess: isZh ? '账号已禁用' : 'Account disabled',
    resetPasswordSuccess: isZh ? '密码重置成功' : 'Password reset successfully',
    edit: isZh ? '编辑' : 'Edit',
    enable: isZh ? '启用' : 'Enable',
    disable: isZh ? '禁用' : 'Disable',
    resetPassword: isZh ? '重置密码' : 'Reset Password',
    confirm: isZh ? '确认' : 'Confirm',
    cancel: isZh ? '取消' : 'Cancel',
    saveEmployee: isZh ? '保存员工' : 'Save Employee',
    saveChanges: isZh ? '保存修改' : 'Save Changes',
    confirmResetPassword: isZh ? '确认重置' : 'Reset Password',
    newPassword: isZh ? '新密码' : 'New Password',
    inputUsername: isZh ? '请输入用户名' : 'Enter username',
    inputLoginUsername: isZh ? '请输入登录用户名' : 'Enter login username',
    initialPassword: isZh ? '初始密码' : 'Initial Password',
    inputInitialPassword: isZh ? '请输入初始密码' : 'Enter initial password',
    inputLongPassword: isZh ? '请输入至少 6 位初始密码' : 'Enter at least 6 characters',
    selectRole: isZh ? '请选择角色' : 'Select role',
    selectStore: isZh ? '请选择所属门店' : 'Select assigned store',
    adminNoStore: isZh ? '管理员账号无需绑定门店' : 'Admin accounts do not require a store',
    nonAdminStoreRequired: isZh ? '非管理员账号必须绑定门店' : 'Non-admin accounts must be assigned to a store',
    inputNewPassword: isZh ? '请输入新密码' : 'Enter new password',
    inputLongNewPassword: isZh ? '请输入至少 6 位新密码' : 'Enter at least 6 characters',
    total: (count: number) => (isZh ? `共 ${count} 位员工` : `${count} employees`),
    editEmployee: (username?: string) => (isZh ? `编辑员工${username ? `：${username}` : ''}` : `Edit Employee${username ? `: ${username}` : ''}`),
    resetPasswordFor: (username?: string) => (isZh ? `重置密码${username ? `：${username}` : ''}` : `Reset Password${username ? `: ${username}` : ''}`),
    confirmDisableTitle: isZh ? '确认禁用该账号？' : 'Disable this account?',
    confirmEnableTitle: isZh ? '确认启用该账号？' : 'Enable this account?',
    confirmDisableDesc: isZh ? '禁用后该员工将无法登录系统。' : 'The employee will no longer be able to sign in.',
    confirmEnableDesc: isZh ? '启用后该员工可以重新登录系统。' : 'The employee will be able to sign in again.',
  };
}

function getRoleMeta(role: EmployeeRole, copy: ReturnType<typeof getCopy>): { label: string; color: string } {
  if (role === 'ADMIN') {
    return { label: copy.admin, color: 'volcano' };
  }
  if (role === 'STORE_MANAGER') {
    return { label: copy.manager, color: 'blue' };
  }
  return { label: copy.staff, color: 'default' };
}

export function EmployeePage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<CreateEmployeeFormValues>();
  const [editForm] = Form.useForm<EditEmployeeFormValues>();
  const [resetForm] = Form.useForm<ResetPasswordValues>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<IEmployeeRecord | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const queryClient = useQueryClient();
  const createRole = Form.useWatch('role', createForm);
  const editRole = Form.useWatch('role', editForm);
  const { employee: currentEmployee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const copy = getCopy(isZh);

  const employeeQuery = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  });

  const storeQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: async () => {
      messageApi.success(copy.createSuccess);
      setIsCreateModalOpen(false);
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeePayload }) => updateEmployee(id, payload),
    onSuccess: async () => {
      messageApi.success(copy.updateSuccess);
      setIsEditModalOpen(false);
      editForm.resetFields();
      setSelectedEmployee(null);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleEmployeeActive(id),
    onSuccess: async (record) => {
      messageApi.success(record.is_active ? copy.enableSuccess : copy.disableSuccess);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => resetEmployeePassword(id, newPassword),
    onSuccess: async () => {
      messageApi.success(copy.resetPasswordSuccess);
      setIsResetModalOpen(false);
      resetForm.resetFields();
      setSelectedEmployee(null);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  useEffect(() => {
    if (createRole === 'ADMIN') {
      createForm.setFieldValue('store_id', undefined);
    }
  }, [createForm, createRole]);

  useEffect(() => {
    if (editRole === 'ADMIN') {
      editForm.setFieldValue('store_id', undefined);
    }
  }, [editForm, editRole]);

  const employees = employeeQuery.data ?? [];

  const storeOptions = (storeQuery.data ?? []).map((store) => ({
    value: store.id,
    label: store.name,
  }));

  const roleOptions = [
    { value: 'ADMIN', label: copy.admin },
    { value: 'STORE_MANAGER', label: copy.manager },
    { value: 'STAFF', label: copy.staff },
  ];

  const filteredEmployees = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return employees;
    }

    return employees.filter((item) => {
      const roleLabel = getRoleMeta(item.role, copy).label;
      return [item.username, item.store_name ?? '', item.role, roleLabel]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [copy, employees, keyword]);

  const columns: ColumnsType<IEmployeeRecord> = [
    {
      title: copy.username,
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: copy.role,
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (value: EmployeeRole) => {
        const meta = getRoleMeta(value, copy);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: copy.store,
      dataIndex: 'store_name',
      key: 'store_name',
      render: (value: string | null) => value ?? '-',
    },
    {
      title: copy.status,
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? copy.active : copy.inactive}</Tag>,
    },
    {
      title: copy.actions,
      key: 'action',
      width: 320,
      render: (_, record) => {
        const isSelf = record.id === currentEmployee?.id;
        const isBusy = toggleMutation.isPending || resetPasswordMutation.isPending || updateMutation.isPending;

        return (
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              disabled={isBusy}
              onClick={() => {
                setSelectedEmployee(record);
                editForm.setFieldsValue({
                  username: record.username,
                  role: record.role,
                  store_id: record.store_id ?? undefined,
                });
                setIsEditModalOpen(true);
              }}
            >
              {copy.edit}
            </Button>

            <Popconfirm
              title={record.is_active ? copy.confirmDisableTitle : copy.confirmEnableTitle}
              description={record.is_active ? copy.confirmDisableDesc : copy.confirmEnableDesc}
              okText={copy.confirm}
              cancelText={copy.cancel}
              onConfirm={() => toggleMutation.mutate(record.id)}
              disabled={isSelf}
            >
              <Button danger={record.is_active} disabled={isSelf || isBusy} loading={toggleMutation.isPending}>
                {record.is_active ? copy.disable : copy.enable}
              </Button>
            </Popconfirm>

            <Button
              icon={<LockOutlined />}
              disabled={isBusy}
              onClick={() => {
                setSelectedEmployee(record);
                setIsResetModalOpen(true);
              }}
            >
              {copy.resetPassword}
            </Button>
          </Space>
        );
      },
    },
  ];

  const handleCreate = async (): Promise<void> => {
    try {
      const values = await createForm.validateFields();
      await createMutation.mutateAsync({
        username: values.username.trim(),
        password: values.password,
        role: values.role,
        store_id: values.role === 'ADMIN' ? null : values.store_id ?? null,
      });
    } catch {
      // handled by form and mutation
    }
  };

  const handleUpdate = async (): Promise<void> => {
    if (!selectedEmployee) {
      return;
    }

    try {
      const values = await editForm.validateFields();
      await updateMutation.mutateAsync({
        id: selectedEmployee.id,
        payload: {
          username: values.username.trim(),
          role: values.role,
          store_id: values.role === 'ADMIN' ? null : values.store_id ?? null,
        },
      });
    } catch {
      // handled by form and mutation
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!selectedEmployee) {
      return;
    }

    try {
      const values = await resetForm.validateFields();
      await resetPasswordMutation.mutateAsync({
        id: selectedEmployee.id,
        newPassword: values.new_password,
      });
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

            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
              {copy.newEmployee}
            </Button>
          </div>

          <Table<IEmployeeRecord>
            rowKey="id"
            columns={columns}
            dataSource={filteredEmployees}
            loading={employeeQuery.isLoading || employeeQuery.isFetching}
            pagination={{ pageSize: 10, showTotal: (total) => copy.total(total) }}
            scroll={{ x: 1080 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.newEmployee}
        open={isCreateModalOpen}
        onCancel={() => {
          if (!createMutation.isPending) {
            setIsCreateModalOpen(false);
          }
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.saveEmployee}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<CreateEmployeeFormValues> form={createForm} layout="vertical" initialValues={{ role: 'STAFF' }}>
          <Form.Item label={copy.username} name="username" rules={[{ required: true, message: copy.inputUsername }]}>
            <Input placeholder={copy.inputLoginUsername} maxLength={80} />
          </Form.Item>

          <Form.Item
            label={copy.initialPassword}
            name="password"
            rules={[{ required: true, message: copy.inputInitialPassword }]}
          >
            <Input.Password placeholder={copy.inputLongPassword} maxLength={128} />
          </Form.Item>

          <Form.Item label={copy.role} name="role" rules={[{ required: true, message: copy.selectRole }]}>
            <Select options={roleOptions} />
          </Form.Item>

          <Form.Item
            label={copy.store}
            name="store_id"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (createRole !== 'ADMIN' && !value) {
                    throw new Error(copy.nonAdminStoreRequired);
                  }
                },
              },
            ]}
          >
            <Select
              allowClear
              disabled={createRole === 'ADMIN'}
              placeholder={createRole === 'ADMIN' ? copy.adminNoStore : copy.selectStore}
              options={storeOptions}
              loading={storeQuery.isLoading}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={copy.editEmployee(selectedEmployee?.username)}
        open={isEditModalOpen}
        onCancel={() => {
          if (updateMutation.isPending) {
            return;
          }
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
          editForm.resetFields();
        }}
        onOk={() => void handleUpdate()}
        confirmLoading={updateMutation.isPending}
        okText={copy.saveChanges}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<EditEmployeeFormValues> form={editForm} layout="vertical">
          <Form.Item label={copy.username} name="username" rules={[{ required: true, message: copy.inputUsername }]}>
            <Input placeholder={copy.inputLoginUsername} maxLength={80} />
          </Form.Item>

          <Form.Item label={copy.role} name="role" rules={[{ required: true, message: copy.selectRole }]}>
            <Select options={roleOptions} />
          </Form.Item>

          <Form.Item
            label={copy.store}
            name="store_id"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (editRole !== 'ADMIN' && !value) {
                    throw new Error(copy.nonAdminStoreRequired);
                  }
                },
              },
            ]}
          >
            <Select
              allowClear
              disabled={editRole === 'ADMIN'}
              placeholder={editRole === 'ADMIN' ? copy.adminNoStore : copy.selectStore}
              options={storeOptions}
              loading={storeQuery.isLoading}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={copy.resetPasswordFor(selectedEmployee?.username)}
        open={isResetModalOpen}
        onCancel={() => {
          if (resetPasswordMutation.isPending) {
            return;
          }
          setIsResetModalOpen(false);
          setSelectedEmployee(null);
          resetForm.resetFields();
        }}
        onOk={() => void handleResetPassword()}
        confirmLoading={resetPasswordMutation.isPending}
        okText={copy.confirmResetPassword}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<ResetPasswordValues> form={resetForm} layout="vertical">
          <Form.Item label={copy.newPassword} name="new_password" rules={[{ required: true, message: copy.inputNewPassword }]}>
            <Input.Password placeholder={copy.inputLongNewPassword} maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
