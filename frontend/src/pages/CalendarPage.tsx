import { CalendarOutlined, CheckCircleOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Calendar,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import {
  createAppointment,
  getAppointments,
  updateAppointmentStatus,
  type AppointmentStatus,
  type CreateAppointmentPayload,
  type IAppointment,
} from '../services/appointment';
import { getCustomers } from '../services/customer';
import { getStores } from '../services/store';

const { Paragraph, Text, Title } = Typography;

type AppointmentTypeValue = '初诊' | '调音' | '保养';

interface AppointmentFormValues {
  store_id: string;
  customer_id: string;
  appointment_time: Dayjs;
  type: AppointmentTypeValue;
  notes?: string;
}

const APPOINTMENT_TYPE_VALUES: AppointmentTypeValue[] = ['初诊', '调音', '保养'];

const APPOINTMENT_TYPE_COLORS: Record<AppointmentTypeValue, string> = {
  初诊: '#94a3b8',
  调音: '#2563eb',
  保养: '#10b981',
};

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { hour12: false });
}

export function CalendarPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<AppointmentFormValues>();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const locale = isZh ? 'zh-CN' : 'en-AU';
  const isStoreUser = employee?.role === 'store_manager' || employee?.role === 'staff';
  const [panelValue, setPanelValue] = useState<Dayjs>(() => dayjs());
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerKeyword, setCustomerKeyword] = useState('');

  const copy = {
    eyebrow: 'CRM Calendar',
    title: isZh ? '预约日历' : 'Appointment Calendar',
    description: isZh
      ? '用清晰的月视图统一管理初诊、调音与保养预约。点击任意日期即可查看当天安排，并继续新增预约或更新状态。'
      : 'Manage first-visit, fitting and maintenance appointments in a clean monthly view. Click any date to inspect the day and continue scheduling from there.',
    pending: isZh ? '待到店' : 'Pending',
    completed: isZh ? '已完成' : 'Completed',
    cancelled: isZh ? '已取消' : 'Cancelled',
    currentMonth: isZh ? '当前月份' : 'Current month',
    moreCount: isZh ? '还有 {{count}} 条预约' : '{{count}} more appointments',
    dayModalTitle: selectedDate
      ? isZh
        ? `${selectedDate.format('YYYY年M月D日')} 预约安排`
        : `Appointments on ${selectedDate.format('MMM D, YYYY')}`
      : isZh
        ? '预约安排'
        : 'Appointments',
    dayModalHint: isZh
      ? '可直接完成、取消预约，或继续为当天新增到店安排。'
      : 'Update appointment status or add more visits for the selected day.',
    addAppointment: isZh ? '新增预约' : 'Add Appointment',
    noAppointments: isZh ? '当天暂无预约安排' : 'No appointments for this day',
    appointmentTime: isZh ? '预约时间' : 'Appointment Time',
    employee: isZh ? '接待员工' : 'Employee',
    store: isZh ? '所属门店' : 'Store',
    customer: isZh ? '客户' : 'Customer',
    customerPlaceholder: isZh ? '输入客户姓名或电话搜索' : 'Search by customer name or phone',
    customerSearching: isZh ? '搜索中...' : 'Searching...',
    customerEmpty: isZh ? '未找到匹配客户' : 'No matching customers',
    type: isZh ? '预约类型' : 'Appointment Type',
    notes: isZh ? '备注' : 'Notes',
    notesPlaceholder: isZh ? '填写客户诉求、设备情况或回访重点' : 'Add customer needs, device notes or follow-up focus',
    createTitle: isZh ? '新增预约' : 'Create Appointment',
    save: isZh ? '保存预约' : 'Save Appointment',
    cancel: isZh ? '取消' : 'Cancel',
    chooseStore: isZh ? '请选择门店' : 'Please select a store.',
    chooseCustomer: isZh ? '请选择客户' : 'Please select a customer.',
    chooseTime: isZh ? '请选择预约时间' : 'Please select appointment time.',
    chooseType: isZh ? '请选择预约类型' : 'Please select appointment type.',
    storePlaceholder: isZh ? '请选择门店' : 'Select store',
    typePlaceholder: isZh ? '请选择预约类型' : 'Select appointment type',
    createSuccess: isZh ? '预约已创建' : 'Appointment created.',
    updateSuccess: isZh ? '预约状态已更新' : 'Appointment status updated.',
    completeAction: isZh ? '完成' : 'Complete',
    cancelAction: isZh ? '取消预约' : 'Cancel appointment',
  };

  const rangeStart = panelValue.startOf('month').startOf('day').toISOString();
  const rangeEnd = panelValue.endOf('month').endOf('day').toISOString();

  const appointmentTypeLabelMap: Record<AppointmentTypeValue, string> = {
    初诊: isZh ? '初诊' : 'Initial Visit',
    调音: isZh ? '调音' : 'Fitting',
    保养: isZh ? '保养' : 'Maintenance',
  };

  const appointmentTypeOptions = APPOINTMENT_TYPE_VALUES.map((value) => ({
    value,
    label: appointmentTypeLabelMap[value],
  }));

  function getTypeMeta(type: string): { color: string; label: string } {
    const safeType = APPOINTMENT_TYPE_VALUES.find((item) => item === type);
    return {
      color: safeType ? APPOINTMENT_TYPE_COLORS[safeType] : '#cbd5e1',
      label: safeType ? appointmentTypeLabelMap[safeType] : type,
    };
  }

  function getStatusMeta(status: AppointmentStatus): { color: string; label: string } {
    if (status === 'completed') {
      return { color: 'success', label: copy.completed };
    }
    if (status === 'cancelled') {
      return { color: 'default', label: copy.cancelled };
    }
    return { color: 'processing', label: copy.pending };
  }

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', rangeStart, rangeEnd],
    queryFn: () => getAppointments({ startTime: rangeStart, endTime: rangeEnd }),
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'calendar-selector', customerKeyword],
    queryFn: () =>
      getCustomers({
        q: customerKeyword.trim() || undefined,
        page: 1,
        page_size: 100,
      }),
  });

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const appointmentMap = useMemo(() => {
    const grouped = new Map<string, IAppointment[]>();

    for (const appointment of appointmentsQuery.data ?? []) {
      const key = dayjs(appointment.appointment_time).format('YYYY-MM-DD');
      const current = grouped.get(key) ?? [];
      current.push(appointment);
      grouped.set(key, current);
    }

    return grouped;
  }, [appointmentsQuery.data]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return appointmentMap.get(selectedDate.format('YYYY-MM-DD')) ?? [];
  }, [appointmentMap, selectedDate]);

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.name} / ${item.phone}`,
      })),
    [customersQuery.data],
  );

  const storeOptions = useMemo(
    () =>
      (storesQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [storesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => createAppointment(payload),
    onSuccess: async () => {
      messageApi.success(copy.createSuccess);
      setIsCreateModalOpen(false);
      createForm.resetFields();
      setCustomerKeyword('');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(id, status),
    onSuccess: async () => {
      messageApi.success(copy.updateSuccess);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const pendingCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'pending').length;
  const completedCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'completed').length;
  const cancelledCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'cancelled').length;

  const openCreateModal = (): void => {
    const baseDate = selectedDate ?? panelValue;
    createForm.setFieldsValue({
      store_id: isStoreUser ? employee?.store_id ?? undefined : undefined,
      appointment_time: baseDate.hour(10).minute(0).second(0),
      type: '初诊',
      notes: '',
    });
    setCustomerKeyword('');
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (): Promise<void> => {
    const values = await createForm.validateFields();

    await createMutation.mutateAsync({
      store_id: values.store_id,
      customer_id: values.customer_id,
      appointment_time: values.appointment_time.toISOString(),
      type: values.type,
      notes: values.notes?.trim() || undefined,
    });
  };

  return (
    <>
      {contextHolder}

      <Space direction="vertical" size={24} className="w-full">
        <div className="page-hero">
          <Space size="small" className="!mb-2">
            <CalendarOutlined style={{ color: '#2563eb' }} />
            <Text style={{ color: '#2563eb', fontWeight: 600 }}>{copy.eyebrow}</Text>
          </Space>
          <Title level={1} className="page-title !mb-2">
            {copy.title}
          </Title>
          <Paragraph className="page-hero-meta !mb-0">{copy.description}</Paragraph>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <Text type="secondary">{copy.pending}</Text>
            <div className="mt-2 text-[28px] font-semibold leading-none text-slate-950">{pendingCount}</div>
          </Card>
          <Card>
            <Text type="secondary">{copy.completed}</Text>
            <div className="mt-2 text-[28px] font-semibold leading-none text-slate-950">{completedCount}</div>
          </Card>
          <Card>
            <Text type="secondary">{copy.cancelled}</Text>
            <div className="mt-2 text-[28px] font-semibold leading-none text-slate-950">{cancelledCount}</div>
          </Card>
        </div>

        <Card>
          <Space direction="vertical" size={20} className="w-full">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Space size={12} wrap>
                {appointmentTypeOptions.map((item) => (
                  <div
                    key={item.value}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] text-slate-600"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: APPOINTMENT_TYPE_COLORS[item.value] }}
                    />
                    {item.label}
                  </div>
                ))}
              </Space>

              <div className="flex items-center gap-3">
                <Text type="secondary">{copy.currentMonth}</Text>
                <Text strong>{panelValue.format(isZh ? 'YYYY年M月' : 'MMMM YYYY')}</Text>
              </div>
            </div>

            <Calendar
              value={panelValue}
              fullscreen
              onPanelChange={(value) => setPanelValue(value)}
              onSelect={(value) => {
                setSelectedDate(value);
                setIsDayModalOpen(true);
              }}
              cellRender={(current, info) => {
                if (info.type !== 'date') {
                  return info.originNode;
                }

                const dayAppointments = appointmentMap.get(current.format('YYYY-MM-DD')) ?? [];
                if (dayAppointments.length === 0) {
                  return info.originNode;
                }

                return (
                  <div className="mt-3 space-y-1.5">
                    {dayAppointments.slice(0, 3).map((appointment) => {
                      const typeMeta = getTypeMeta(appointment.type);

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDate(current);
                            setIsDayModalOpen(true);
                          }}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: typeMeta.color }}
                          />
                          <span className="truncate">
                            {dayjs(appointment.appointment_time).format('HH:mm')} {appointment.customer_name}
                          </span>
                        </button>
                      );
                    })}
                    {dayAppointments.length > 3 ? (
                      <div className="px-1 text-xs text-slate-400">
                        {copy.moreCount.replace('{{count}}', String(dayAppointments.length - 3))}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
          </Space>
        </Card>
      </Space>

      <Modal
        title={copy.dayModalTitle}
        open={isDayModalOpen}
        footer={null}
        onCancel={() => setIsDayModalOpen(false)}
        width={820}
        destroyOnHidden
      >
        <Space direction="vertical" size={20} className="w-full">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Text type="secondary">{copy.dayModalHint}</Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {copy.addAppointment}
            </Button>
          </div>

          {selectedDayAppointments.length === 0 ? (
            <Empty description={copy.noAppointments} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={selectedDayAppointments}
              renderItem={(item) => {
                const statusMeta = getStatusMeta(item.status);
                const typeMeta = getTypeMeta(item.type);

                return (
                  <List.Item className="rounded-2xl border border-slate-200 px-5 py-5">
                    <Space direction="vertical" size={12} className="w-full">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Text strong>{item.customer_name}</Text>
                          <Text type="secondary">{item.customer_phone}</Text>
                          <Tag color={statusMeta.color} bordered={false}>
                            {statusMeta.label}
                          </Tag>
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-600">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: typeMeta.color }}
                            />
                            {typeMeta.label}
                          </div>
                        </div>

                        <Space>
                          {item.status === 'pending' ? (
                            <Button
                              type="default"
                              icon={<CheckCircleOutlined />}
                              loading={updateStatusMutation.isPending}
                              onClick={() => void updateStatusMutation.mutateAsync({ id: item.id, status: 'completed' })}
                            >
                              {copy.completeAction}
                            </Button>
                          ) : null}
                          {item.status === 'pending' ? (
                            <Button
                              danger
                              type="text"
                              icon={<CloseOutlined />}
                              loading={updateStatusMutation.isPending}
                              onClick={() => void updateStatusMutation.mutateAsync({ id: item.id, status: 'cancelled' })}
                            >
                              {copy.cancelAction}
                            </Button>
                          ) : null}
                        </Space>
                      </div>

                      <div className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:grid-cols-3">
                        <div>
                          <Text type="secondary">{copy.appointmentTime}</Text>
                          <div className="mt-1 font-medium text-slate-900">{formatDateTime(item.appointment_time, locale)}</div>
                        </div>
                        <div>
                          <Text type="secondary">{copy.employee}</Text>
                          <div className="mt-1 font-medium text-slate-900">{item.employee_username}</div>
                        </div>
                        <div>
                          <Text type="secondary">{copy.store}</Text>
                          <div className="mt-1 font-medium text-slate-900">{item.store_name}</div>
                        </div>
                      </div>

                      {item.notes ? <Paragraph className="!mb-0">{item.notes}</Paragraph> : null}
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </Space>
      </Modal>

      <Modal
        title={copy.createTitle}
        open={isCreateModalOpen}
        onCancel={() => {
          if (!createMutation.isPending) {
            setIsCreateModalOpen(false);
          }
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.save}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <Form<AppointmentFormValues>
          form={createForm}
          layout="vertical"
          initialValues={{
            store_id: isStoreUser ? employee?.store_id ?? undefined : undefined,
            type: '初诊',
          }}
        >
          <Form.Item label={copy.store} name="store_id" rules={[{ required: true, message: copy.chooseStore }]}>
            <Select
              options={storeOptions}
              placeholder={copy.storePlaceholder}
              disabled={isStoreUser}
              loading={storesQuery.isLoading}
            />
          </Form.Item>

          <Form.Item label={copy.customer} name="customer_id" rules={[{ required: true, message: copy.chooseCustomer }]}>
            <Select
              showSearch
              filterOption={false}
              options={customerOptions}
              placeholder={copy.customerPlaceholder}
              loading={customersQuery.isLoading}
              onSearch={(value) => setCustomerKeyword(value)}
              notFoundContent={customersQuery.isLoading ? copy.customerSearching : copy.customerEmpty}
            />
          </Form.Item>

          <Form.Item
            label={copy.appointmentTime}
            name="appointment_time"
            rules={[{ required: true, message: copy.chooseTime }]}
          >
            <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          <Form.Item label={copy.type} name="type" rules={[{ required: true, message: copy.chooseType }]}>
            <Select options={appointmentTypeOptions} placeholder={copy.typePlaceholder} />
          </Form.Item>

          <Form.Item label={copy.notes} name="notes">
            <Input.TextArea rows={4} placeholder={copy.notesPlaceholder} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
