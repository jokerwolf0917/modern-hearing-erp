import { EditOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
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
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
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

const { Paragraph, Title, Text } = Typography;

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

export function EmployeePage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<CreateEmployeeFormValues>();
  const [editForm] = Form.useForm<EditEmployeeFormValues>();
  const [resetForm] = Form.useForm<ResetPasswordValues>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<IEmployeeRecord | null>(null);
  const queryClient = useQueryClient();
  const createRole = Form.useWatch('role', createForm);
  const editRole = Form.useWatch('role', editForm);
  const { employee: currentEmployee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    admin: isZh ? '管理员' : 'Administrator',
    manager: isZh ? '店长' : 'Store Manager',
    staff: isZh ? '店员' : 'Staff',
    createSuccess: isZh ? '员工创建成功' : 'Employee created successfully.',
    updateSuccess: isZh ? '员工信息更新成功' : 'Employee updated successfully.',
    enabled: isZh ? '账号已启用' : 'Account enabled.',
    disabled: isZh ? '账号已禁用' : 'Account disabled.',
    passwordReset: isZh ? '密码重置成功' : 'Password reset successfully.',
    title: isZh ? '员工管理' : 'Employee Management',
    description: isZh
      ? '由管理员统一创建、调岗、晋升和维护员工账号，确保角色与门店绑定关系始终一致。'
      : 'Create, reassign and maintain employee accounts with clear role and store binding.',
    create: isZh ? '新建员工' : 'New Employee',
    securityRule: isZh
      ? '安全规则：当前登录管理员账号不可被自己禁用，防止系统失去管理入口。'
      : 'Safety rule: the currently logged-in administrator cannot disable their own account.',
    total: isZh ? '共 {{count}} 位员工' : '{{count}} employees',
    username: isZh ? '用户名' : 'Username',
    role: isZh ? '角色' : 'Role',
    store: isZh ? '所属门店' : 'Store',
    status: isZh ? '状态' : 'Status',
    action: isZh ? '操作' : 'Action',
    active: isZh ? '启用' : 'Active',
    inactive: isZh ? '禁用' : 'Inactive',
    edit: isZh ? '编辑' : 'Edit',
    enable: isZh ? '启用' : 'Enable',
    disable: isZh ? '禁用' : 'Disable',
    resetPassword: isZh ? '重置密码' : 'Reset Password',
    disableTitle: isZh ? '确认禁用该账号？' : 'Disable this account?',
    enableTitle: isZh ? '确认启用该账号？' : 'Enable this account?',
    disableDescription: isZh ? '禁用后该员工将无法登录系统。' : 'The employee will no longer be able to sign in.',
    enableDescription: isZh ? '启用后该员工可以重新登录系统。' : 'The employee will be able to sign in again.',
    confirm: isZh ? '确认' : 'Confirm',
    cancel: isZh ? '取消' : 'Cancel',
    createModal: isZh ? '新建员工' : 'Create Employee',
    saveEmployee: isZh ? '保存员工' : 'Save Employee',
    editModal: isZh ? '编辑员工' : 'Edit Employee',
    saveChanges: isZh ? '保存修改' : 'Save Changes',
    resetModal: isZh ? '重置密码' : 'Reset Password',
    confirmReset: isZh ? '确认重置' : 'Confirm Reset',
    initialPassword: isZh ? '初始密码' : 'Initial Password',
    newPassword: isZh ? '新密码' : 'New Password',
    usernameRequired: isZh ? '请输入用户名' : 'Please enter username.',
    passwordRequired: isZh ? '请输入初始密码' : 'Please enter initial password.',
    newPasswordRequired: isZh ? '请输入新密码' : 'Please enter new password.',
    roleRequired: isZh ? '请选择角色' : 'Please select a role.',
    storeRequired: isZh ? '非管理员账号必须选择所属门店' : 'Non-admin accounts must be bound to a store.',
    usernamePlaceholder: isZh ? '请输入登录用户名' : 'Enter login username',
    passwordPlaceholder: isZh ? '请输入至少 6 位初始密码' : 'Enter an initial password with at least 6 characters',
    newPasswordPlaceholder: isZh ? '请输入至少 6 位新密码' : 'Enter a new password with at least 6 characters',
    storePlaceholder: isZh ? '请选择所属门店' : 'Select store',
    adminStorePlaceholder: isZh ? 'ADMIN 账号无需绑定门店' : 'Admin accounts do not need a store',
  };

  function getRoleMeta(role: EmployeeRole): { label: string; color: string } {
    if (role === 'admin') {
      return { label: copy.admin, color: 'volcano' };
    }
    if (role === 'store_manager') {
      return { label: copy.manager, color: 'blue' };
    }
    return { label: copy.staff, color: 'default' };
  }

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
      messageApi.success(record.is_active ? copy.enabled : copy.disabled);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => resetEmployeePassword(id, newPassword),
    onSuccess: async () => {
      messageApi.success(copy.passwordReset);
      setIsResetModalOpen(false);
      resetForm.resetFields();
      setSelectedEmployee(null);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  useEffect(() => {
    if (createRole === 'admin') {
      createForm.setFieldValue('store_id', undefined);
    }
  }, [createForm, createRole]);

  useEffect(() => {
    if (editRole === 'admin') {
      editForm.setFieldValue('store_id', undefined);
    }
  }, [editForm, editRole]);

  const storeOptions = (storeQuery.data ?? []).map((store) => ({
    value: store.id,
    label: store.name,
  }));

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
      width: 140,
      render: (value: EmployeeRole) => {
        const meta = getRoleMeta(value);
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
      title: copy.action,
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
              title={record.is_active ? copy.disableTitle : copy.enableTitle}
              description={record.is_active ? copy.disableDescription : copy.enableDescription}
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
        store_id: values.role === 'admin' ? null : values.store_id ?? null,
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
          store_id: values.role === 'admin' ? null : values.store_id ?? null,
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Title level={3} className="!mb-2">
                {copy.title}
              </Title>
              <Paragraph type="secondary" className="!mb-0">
                {copy.description}
              </Paragraph>
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
              {copy.create}
            </Button>
          </div>

          <Text type="secondary">{copy.securityRule}</Text>

          <Table<IEmployeeRecord>
            rowKey="id"
            columns={columns}
            dataSource={employeeQuery.data ?? []}
            loading={employeeQuery.isLoading || employeeQuery.isFetching}
            pagination={{ pageSize: 10, showTotal: (total) => copy.total.replace('{{count}}', String(total)) }}
            scroll={{ x: 1080 }}
          />
        </Space>
      </Card>

      <Modal
        title={copy.createModal}
        open={isCreateModalOpen}
        onCancel={() => {
          if (createMutation.isPending) {
            return;
          }
          setIsCreateModalOpen(false);
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.saveEmployee}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<CreateEmployeeFormValues> form={createForm} layout="vertical" initialValues={{ role: 'staff' }}>
          <Form.Item label={copy.username} name="username" rules={[{ required: true, message: copy.usernameRequired }]}>
            <Input placeholder={copy.usernamePlaceholder} maxLength={80} />
          </Form.Item>

          <Form.Item label={copy.initialPassword} name="password" rules={[{ required: true, message: copy.passwordRequired }]}>
            <Input.Password placeholder={copy.passwordPlaceholder} maxLength={128} />
          </Form.Item>

          <Form.Item label={copy.role} name="role" rules={[{ required: true, message: copy.roleRequired }]}>
            <Select
              options={[
                { value: 'admin', label: 'ADMIN' },
                { value: 'store_manager', label: 'STORE_MANAGER' },
                { value: 'staff', label: 'STAFF' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label={copy.store}
            name="store_id"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (createRole !== 'admin' && !value) {
                    throw new Error(copy.storeRequired);
                  }
                },
              },
            ]}
          >
            <Select
              allowClear
              disabled={createRole === 'admin'}
              placeholder={createRole === 'admin' ? copy.adminStorePlaceholder : copy.storePlaceholder}
              options={storeOptions}
              loading={storeQuery.isLoading}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedEmployee ? `${copy.editModal}: ${selectedEmployee.username}` : copy.editModal}
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
          <Form.Item label={copy.username} name="username" rules={[{ required: true, message: copy.usernameRequired }]}>
            <Input placeholder={copy.usernamePlaceholder} maxLength={80} />
          </Form.Item>

          <Form.Item label={copy.role} name="role" rules={[{ required: true, message: copy.roleRequired }]}>
            <Select
              options={[
                { value: 'admin', label: 'ADMIN' },
                { value: 'store_manager', label: 'STORE_MANAGER' },
                { value: 'staff', label: 'STAFF' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label={copy.store}
            name="store_id"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (editRole !== 'admin' && !value) {
                    throw new Error(copy.storeRequired);
                  }
                },
              },
            ]}
          >
            <Select
              allowClear
              disabled={editRole === 'admin'}
              placeholder={editRole === 'admin' ? copy.adminStorePlaceholder : copy.storePlaceholder}
              options={storeOptions}
              loading={storeQuery.isLoading}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedEmployee ? `${copy.resetModal}: ${selectedEmployee.username}` : copy.resetModal}
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
        okText={copy.confirmReset}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<ResetPasswordValues> form={resetForm} layout="vertical">
          <Form.Item label={copy.newPassword} name="new_password" rules={[{ required: true, message: copy.newPasswordRequired }]}>
            <Input.Password placeholder={copy.newPasswordPlaceholder} maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
