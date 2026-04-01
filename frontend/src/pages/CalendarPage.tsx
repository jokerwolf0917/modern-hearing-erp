import {
  CheckCircleOutlined,
  CloseOutlined,
  LeftOutlined,
  UnorderedListOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppSettings } from '../contexts/AppSettingsContext';
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
import { getStores, type IStore } from '../services/store';

const { Paragraph, Text, Title } = Typography;

type StoreFilterValue = 'ALL' | string;
type AppointmentTypeValue = '初诊' | '调音' | '保养';

interface AppointmentFormValues {
  store_id: string;
  customer_id: string;
  appointment_time: Dayjs;
  type: AppointmentTypeValue;
  notes?: string;
}

interface CalendarCopy {
  allStores: string;
  prevWeek: string;
  nextWeek: string;
  weekAppointments: (count: number) => string;
  today: string;
  appointmentCount: (count: number) => string;
  daySchedule: string;
  dayScheduleHint: string;
  emptyDay: string;
  labels: {
    time: string;
    employee: string;
    store: string;
    currentView: string;
    todaySummary: string;
    weekSummary: string;
    total: string;
    pending: string;
    completed: string;
    cancelled: string;
    todayAppointments: string;
    storeField: string;
    customerField: string;
    appointmentTime: string;
    appointmentType: string;
    notes: string;
  };
  actions: {
    complete: string;
    cancel: string;
    create: string;
    fullRecords: string;
    save: string;
  };
  modal: {
    createTitle: string;
    recordsTitle: string;
    cancel: string;
  };
  placeholders: {
    store: string;
    customer: string;
    customerLoading: string;
    customerEmpty: string;
    type: string;
    notes: string;
  };
  messages: {
    created: string;
    updated: string;
    fullRangeEmpty: string;
    currentViewStore: string;
    currentViewAll: string;
  };
  validation: {
    store: string;
    customer: string;
    time: string;
    type: string;
  };
  status: {
    pending: string;
    completed: string;
    cancelled: string;
  };
  types: Record<AppointmentTypeValue, string>;
}

function getCalendarCopy(isZh: boolean): CalendarCopy {
  if (isZh) {
    return {
      allStores: '全部门店',
      prevWeek: '上一周',
      nextWeek: '下一周',
      weekAppointments: (count) => `本周 ${count} 条预约`,
      today: '今天',
      appointmentCount: (count) => `${count} 条预约`,
      daySchedule: '当日安排',
      dayScheduleHint: '点击右侧状态按钮可直接完成或取消预约',
      emptyDay: '当天暂无预约安排',
      labels: {
        time: '时间',
        employee: '员工',
        store: '门店',
        currentView: '当前查看',
        todaySummary: '当日速览',
        weekSummary: '本周摘要',
        total: '总预约',
        pending: '待到店',
        completed: '已完成',
        cancelled: '已取消',
        todayAppointments: '今日预约',
        storeField: '所属门店',
        customerField: '客户',
        appointmentTime: '预约时间',
        appointmentType: '预约类型',
        notes: '备注',
      },
      actions: {
        complete: '完成',
        cancel: '取消',
        create: '新增预约',
        fullRecords: '查看完整记录',
        save: '保存预约',
      },
      modal: {
        createTitle: '新增预约',
        recordsTitle: '完整记录',
        cancel: '取消',
      },
      placeholders: {
        store: '请选择门店',
        customer: '输入客户姓名或手机号搜索',
        customerLoading: '搜索中...',
        customerEmpty: '未找到匹配客户',
        type: '请选择预约类型',
        notes: '填写客户诉求、设备情况或回访重点',
      },
      messages: {
        created: '预约已创建',
        updated: '预约状态已更新',
        fullRangeEmpty: '当前范围内暂无预约记录',
        currentViewStore: '当前按门店筛选，仅展示该门店本周预约。',
        currentViewAll: '当前展示全部门店本周预约。',
      },
      validation: {
        store: '请选择门店',
        customer: '请选择客户',
        time: '请选择预约时间',
        type: '请选择预约类型',
      },
      status: {
        pending: '待到店',
        completed: '已完成',
        cancelled: '已取消',
      },
      types: {
        初诊: '初诊',
        调音: '调音',
        保养: '保养',
      },
    };
  }

  return {
    allStores: 'All stores',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    weekAppointments: (count) => `${count} appointments this week`,
    today: 'Today',
    appointmentCount: (count) => `${count} appointments`,
    daySchedule: 'Schedule',
    dayScheduleHint: 'Use the action buttons on the right to complete or cancel appointments.',
    emptyDay: 'No appointments scheduled for this day',
    labels: {
      time: 'Time',
      employee: 'Employee',
      store: 'Store',
      currentView: 'Current view',
      todaySummary: 'Day summary',
      weekSummary: 'Week summary',
      total: 'Total',
      pending: 'Pending',
      completed: 'Completed',
      cancelled: 'Cancelled',
      todayAppointments: 'Today',
      storeField: 'Store',
      customerField: 'Customer',
      appointmentTime: 'Appointment time',
      appointmentType: 'Appointment type',
      notes: 'Notes',
    },
    actions: {
      complete: 'Complete',
      cancel: 'Cancel',
      create: 'New appointment',
      fullRecords: 'View full records',
      save: 'Save appointment',
    },
    modal: {
      createTitle: 'New appointment',
      recordsTitle: 'Full records',
      cancel: 'Cancel',
    },
    placeholders: {
      store: 'Select store',
      customer: 'Search by customer name or phone',
      customerLoading: 'Searching...',
      customerEmpty: 'No matching customers found',
      type: 'Select type',
      notes: 'Add customer goals, device notes, or follow-up focus',
    },
    messages: {
      created: 'Appointment created',
      updated: 'Appointment status updated',
      fullRangeEmpty: 'No appointment records in the current range',
      currentViewStore: 'Currently filtered by store, showing only this store’s weekly appointments.',
      currentViewAll: 'Currently showing weekly appointments for all stores.',
    },
    validation: {
      store: 'Please select a store',
      customer: 'Please select a customer',
      time: 'Please select an appointment time',
      type: 'Please select an appointment type',
    },
    status: {
      pending: 'Pending',
      completed: 'Completed',
      cancelled: 'Cancelled',
    },
    types: {
      初诊: 'First visit',
      调音: 'Tuning',
      保养: 'Maintenance',
    },
  };
}

function formatDateTime(value: string): string {
  return dayjs(value).format('YYYY-MM-DD HH:mm');
}

function buildStoreOptions(stores: IStore[], isAdmin: boolean, allStores: string): Array<{ label: string; value: StoreFilterValue }> {
  const base = stores.map((store) => ({ label: store.name, value: store.id }));
  return isAdmin ? [{ label: allStores, value: 'ALL' }, ...base] : base;
}

function getStatusTag(status: AppointmentStatus, copy: CalendarCopy): JSX.Element {
  if (status === 'completed') {
    return <Tag color="success">{copy.status.completed}</Tag>;
  }
  if (status === 'cancelled') {
    return <Tag>{copy.status.cancelled}</Tag>;
  }
  return <Tag color="processing">{copy.status.pending}</Tag>;
}

function getTypeConfig(type: string, copy: CalendarCopy): { label: string; color: string } {
  const colorMap: Record<string, string> = { 初诊: '#3157d5', 调音: '#10b981', 保养: '#f59e0b' };
  return {
    label: copy.types[type as AppointmentTypeValue] ?? type,
    color: colorMap[type] ?? '#94a3b8',
  };
}

export function CalendarPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [createForm] = Form.useForm<AppointmentFormValues>();
  const queryClient = useQueryClient();
  const { employee } = useAuth();
  const { settings } = useAppSettings();
  const { i18n } = useTranslation();
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh');
  const copy = useMemo(() => getCalendarCopy(isZh), [isZh]);
  const isAdmin = employee?.role === 'ADMIN';
  const isStoreUser = employee?.role === 'STORE_MANAGER' || employee?.role === 'STAFF';

  const preferredAdminStore = settings.defaultStoreId ?? 'ALL';
  const [selectedStore, setSelectedStore] = useState<StoreFilterValue>(
    preferredAdminStore === null ? 'ALL' : preferredAdminStore,
  );
  const [weekAnchor, setWeekAnchor] = useState(dayjs().startOf('week'));
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [customerKeyword, setCustomerKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);

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

  const weekStart = weekAnchor.startOf('week').startOf('day');
  const weekEnd = weekAnchor.endOf('week').endOf('day');

  useEffect(() => {
    const isWithinWeek =
      (selectedDate.isAfter(weekStart, 'day') || selectedDate.isSame(weekStart, 'day')) &&
      (selectedDate.isBefore(weekEnd, 'day') || selectedDate.isSame(weekEnd, 'day'));

    if (!isWithinWeek) {
      setSelectedDate(weekStart);
    }
  }, [selectedDate, weekEnd, weekStart]);

  const storesQuery = useQuery({ queryKey: ['stores'], queryFn: getStores });

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', weekStart.toISOString(), weekEnd.toISOString(), effectiveStoreId],
    queryFn: () =>
      getAppointments({
        startTime: weekStart.toISOString(),
        endTime: weekEnd.toISOString(),
        storeId: effectiveStoreId,
      }),
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'appointment-selector', customerKeyword, effectiveStoreId],
    queryFn: () =>
      getCustomers({
        q: customerKeyword.trim() || undefined,
        page: 1,
        page_size: 100,
        store_id: effectiveStoreId,
      }),
  });

  const storeOptions = useMemo(
    () => buildStoreOptions(storesQuery.data ?? [], isAdmin, copy.allStores),
    [copy.allStores, storesQuery.data, isAdmin],
  );

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.items ?? []).map((customer) => ({
        value: customer.id,
        label: `${customer.name} / ${customer.phone}`,
      })),
    [customersQuery.data],
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day')),
    [weekStart],
  );

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, IAppointment[]>();
    for (const appointment of appointmentsQuery.data ?? []) {
      const key = dayjs(appointment.appointment_time).format('YYYY-MM-DD');
      const current = grouped.get(key) ?? [];
      current.push(appointment);
      grouped.set(key, current);
    }
    return grouped;
  }, [appointmentsQuery.data]);

  const selectedDayAppointments = useMemo(
    () => appointmentsByDate.get(selectedDate.format('YYYY-MM-DD')) ?? [],
    [appointmentsByDate, selectedDate],
  );

  const pendingCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'pending').length;
  const completedCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'completed').length;
  const cancelledCount = (appointmentsQuery.data ?? []).filter((item) => item.status === 'cancelled').length;
  const todayCount = appointmentsByDate.get(dayjs().format('YYYY-MM-DD'))?.length ?? 0;

  const createMutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => createAppointment(payload),
    onSuccess: async () => {
      messageApi.success(copy.messages.created);
      setCreateOpen(false);
      createForm.resetFields();
      setCustomerKeyword('');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(id, status),
    onSuccess: async () => {
      messageApi.success(copy.messages.updated);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  function openCreateModal(): void {
    createForm.resetFields();
    createForm.setFieldsValue({
      store_id: effectiveStoreId,
      appointment_time: selectedDate.hour(10).minute(0).second(0),
      type: '初诊',
      notes: '',
    });
    setCustomerKeyword('');
    setCreateOpen(true);
  }

  async function handleCreate(): Promise<void> {
    const values = await createForm.validateFields();
    await createMutation.mutateAsync({
      store_id: values.store_id,
      customer_id: values.customer_id,
      appointment_time: values.appointment_time.toISOString(),
      type: values.type,
      notes: values.notes?.trim() || undefined,
    });
  }

  return (
    <>
      {contextHolder}

      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.55fr)',
          alignItems: 'start',
        }}
      >
        <Card bodyStyle={{ padding: 18 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'minmax(220px, 260px) auto auto minmax(180px, 220px)',
                alignItems: 'center',
              }}
            >
              <Select
                value={isAdmin ? selectedStore : employee?.store_id ?? undefined}
                options={storeOptions}
                loading={storesQuery.isLoading}
                disabled={!isAdmin}
                onChange={(value) => setSelectedStore(value)}
              />
              <Button icon={<LeftOutlined />} onClick={() => setWeekAnchor((current) => current.subtract(1, 'week'))}>
                {copy.prevWeek}
              </Button>
              <Button icon={<RightOutlined />} onClick={() => setWeekAnchor((current) => current.add(1, 'week'))}>
                {copy.nextWeek}
              </Button>
              <DatePicker
                value={selectedDate}
                className="w-full"
                onChange={(value) => {
                  if (!value) return;
                  setSelectedDate(value.startOf('day'));
                  setWeekAnchor(value.startOf('week'));
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Text type="secondary">
                {weekStart.format('YYYY-MM-DD')} {isZh ? '至' : 'to'} {weekEnd.format('YYYY-MM-DD')}
              </Text>
              <Text type="secondary">{copy.weekAppointments(appointmentsQuery.data?.length ?? 0)}</Text>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))',
                  minWidth: 1050,
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                }}
              >
                {weekDays.map((day, index) => {
                  const dayAppointments = appointmentsByDate.get(day.format('YYYY-MM-DD')) ?? [];
                  const isSelected = day.isSame(selectedDate, 'day');
                  const isToday = day.isSame(dayjs(), 'day');

                  return (
                    <button
                      key={day.format('YYYY-MM-DD')}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      style={{
                        border: 'none',
                        borderRight: index < weekDays.length - 1 ? '1px solid #e2e8f0' : 'none',
                        background: isSelected ? '#eef3ff' : '#ffffff',
                        padding: 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        minHeight: 158,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text type="secondary">{day.format('ddd')}</Text>
                        {isToday ? <Tag color="blue">{copy.today}</Tag> : null}
                      </div>

                      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 650, color: '#0f172a' }}>{day.format('DD')}</div>

                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Text style={{ color: '#0f172a', fontWeight: 600 }}>{copy.appointmentCount(dayAppointments.length)}</Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {dayAppointments.slice(0, 3).map((item) => {
                            const config = getTypeConfig(item.type, copy);
                            return (
                              <span
                                key={item.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  borderRadius: 999,
                                  background: '#f8faff',
                                  border: '1px solid #e2e8f0',
                                  padding: '4px 8px',
                                  fontSize: 12,
                                  color: '#475569',
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.color, display: 'inline-block' }} />
                                {config.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderRadius: 20, border: '1px solid #e2e8f0', background: '#ffffff', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{selectedDate.format('YYYY-MM-DD')} {copy.daySchedule}</Title>
                  <Text type="secondary">{copy.dayScheduleHint}</Text>
                </div>
                <Text type="secondary">{copy.appointmentCount(selectedDayAppointments.length)}</Text>
              </div>
              {selectedDayAppointments.length === 0 ? (
                <Empty description={copy.emptyDay} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedDayAppointments
                    .slice()
                    .sort((a, b) => dayjs(a.appointment_time).valueOf() - dayjs(b.appointment_time).valueOf())
                    .map((item) => {
                      const typeConfig = getTypeConfig(item.type, copy);
                      return (
                        <div key={item.id} style={{ borderRadius: 18, border: '1px solid #e2e8f0', background: '#ffffff', padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div>
                              <Space size={[8, 8]} wrap>
                                <Text strong style={{ color: '#0f172a', fontSize: 15 }}>{item.customer_name}</Text>
                                <Text type="secondary">{item.customer_phone}</Text>
                                {getStatusTag(item.status, copy)}
                                <Tag color="blue">{copy.types[item.type as AppointmentTypeValue] ?? item.type}</Tag>
                              </Space>
                              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                                <Text type="secondary">{copy.labels.time}: {formatDateTime(item.appointment_time)}</Text>
                                <Text type="secondary">{copy.labels.employee}: {item.employee_username}</Text>
                                <Text type="secondary">{copy.labels.store}: {item.store_name}</Text>
                              </div>
                              {item.notes ? <Paragraph style={{ marginTop: 12, marginBottom: 0, color: '#475569' }}>{item.notes}</Paragraph> : null}
                            </div>

                            <Space direction="vertical" align="end">
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, background: '#f8faff', border: '1px solid #e6ebf2', padding: '6px 10px', fontSize: 12, color: '#475569' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeConfig.color, display: 'inline-block' }} />
                                {typeConfig.label}
                              </div>

                              {item.status === 'pending' ? (
                                <Space>
                                  <Button icon={<CheckCircleOutlined />} loading={updateStatusMutation.isPending} onClick={() => void updateStatusMutation.mutateAsync({ id: item.id, status: 'completed' })}>{copy.actions.complete}</Button>
                                  <Button danger type="text" icon={<CloseOutlined />} loading={updateStatusMutation.isPending} onClick={() => void updateStatusMutation.mutateAsync({ id: item.id, status: 'cancelled' })}>{copy.actions.cancel}</Button>
                                </Space>
                              ) : null}
                            </Space>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </Space>
        </Card>

        <div style={{ position: 'sticky', top: 90 }}>
          <Card bodyStyle={{ padding: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ borderRadius: 16, border: '1px solid #e6ebf2', background: '#f8faff', padding: 16 }}>
                <Text type="secondary">{copy.labels.currentView}</Text>
                <div style={{ marginTop: 8 }}>
                  <Text strong style={{ fontSize: 17, color: '#0f172a' }}>{selectedDate.format(isZh ? 'YYYY年MM月DD日' : 'YYYY-MM-DD')}</Text>
                </div>
                <Paragraph style={{ marginTop: 8, marginBottom: 0, color: '#64748b' }}>
                  {effectiveStoreId ? copy.messages.currentViewStore : copy.messages.currentViewAll}
                </Paragraph>
              </div>

              <Button type="primary" block onClick={openCreateModal}>
                {copy.actions.create}
              </Button>

              <Button block icon={<UnorderedListOutlined />} onClick={() => setRecordsOpen(true)}>
                {copy.actions.fullRecords}
              </Button>

              <div style={{ borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', padding: 16 }}>
                <Text type="secondary">{copy.labels.todaySummary}</Text>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">{copy.labels.total}</Text><Text strong>{selectedDayAppointments.length}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">{copy.labels.pending}</Text><Text strong>{selectedDayAppointments.filter((item) => item.status === 'pending').length}</Text></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">{copy.labels.completed}</Text><Text strong>{selectedDayAppointments.filter((item) => item.status === 'completed').length}</Text></div>
                </div>
              </div>

              <div style={{ borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', padding: 16 }}>
                <Text type="secondary">{copy.labels.weekSummary}</Text>
                <div
                  style={{
                    marginTop: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  <div style={{ borderRadius: 14, background: '#f8faff', padding: 12 }}>
                    <Text type="secondary">{copy.labels.pending}</Text>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 650, color: '#0f172a' }}>{pendingCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, background: '#f8faff', padding: 12 }}>
                    <Text type="secondary">{copy.labels.completed}</Text>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 650, color: '#0f172a' }}>{completedCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, background: '#f8faff', padding: 12 }}>
                    <Text type="secondary">{copy.labels.cancelled}</Text>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 650, color: '#0f172a' }}>{cancelledCount}</div>
                  </div>
                  <div style={{ borderRadius: 14, background: '#f8faff', padding: 12 }}>
                    <Text type="secondary">{copy.labels.todayAppointments}</Text>
                    <div style={{ marginTop: 6, fontSize: 20, fontWeight: 650, color: '#3157d5' }}>{todayCount}</div>
                  </div>
                </div>
              </div>
            </Space>
          </Card>
        </div>
      </div>

      <Modal
        title={copy.modal.createTitle}
        open={createOpen}
        onCancel={() => {
          if (!createMutation.isPending) setCreateOpen(false);
        }}
        onOk={() => void handleCreate()}
        confirmLoading={createMutation.isPending}
        okText={copy.actions.save}
        cancelText={copy.modal.cancel}
        destroyOnHidden
      >
        <Form<AppointmentFormValues> form={createForm} layout="vertical" initialValues={{ store_id: effectiveStoreId, type: '初诊' }}>
          <Form.Item label={copy.labels.storeField} name="store_id" rules={[{ required: true, message: copy.validation.store }]}>
            <Select
              options={(storesQuery.data ?? []).map((store) => ({ label: store.name, value: store.id }))}
              placeholder={copy.placeholders.store}
              disabled={isStoreUser}
              loading={storesQuery.isLoading}
            />
          </Form.Item>

          <Form.Item label={copy.labels.customerField} name="customer_id" rules={[{ required: true, message: copy.validation.customer }]}>
            <Select
              showSearch
              filterOption={false}
              options={customerOptions}
              placeholder={copy.placeholders.customer}
              loading={customersQuery.isLoading}
              onSearch={(value) => setCustomerKeyword(value)}
              notFoundContent={customersQuery.isLoading ? copy.placeholders.customerLoading : copy.placeholders.customerEmpty}
            />
          </Form.Item>

          <Form.Item label={copy.labels.appointmentTime} name="appointment_time" rules={[{ required: true, message: copy.validation.time }]}>
            <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          <Form.Item label={copy.labels.appointmentType} name="type" rules={[{ required: true, message: copy.validation.type }]}>
            <Select
              options={(Object.keys(copy.types) as AppointmentTypeValue[]).map((value) => ({ label: copy.types[value], value }))}
              placeholder={copy.placeholders.type}
            />
          </Form.Item>

          <Form.Item label={copy.labels.notes} name="notes">
            <Input.TextArea rows={4} placeholder={copy.placeholders.notes} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={copy.modal.recordsTitle} open={recordsOpen} footer={null} onCancel={() => setRecordsOpen(false)} width={920} destroyOnHidden>
        {appointmentsQuery.data && appointmentsQuery.data.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {appointmentsQuery.data
              .slice()
              .sort((a, b) => dayjs(a.appointment_time).valueOf() - dayjs(b.appointment_time).valueOf())
              .map((item) => (
                <div key={item.id} style={{ borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', padding: 14 }}>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <Space size={[8, 8]} wrap>
                        <Text strong>{item.customer_name}</Text>
                        <Text type="secondary">{item.customer_phone}</Text>
                        {getStatusTag(item.status, copy)}
                        <Tag color="blue">{copy.types[item.type as AppointmentTypeValue] ?? item.type}</Tag>
                      </Space>
                      <Text type="secondary">{formatDateTime(item.appointment_time)}</Text>
                    </div>
                    <Text type="secondary">{item.store_name} · {item.employee_username}</Text>
                    {item.notes ? <Paragraph style={{ marginBottom: 0 }}>{item.notes}</Paragraph> : null}
                  </Space>
                </div>
              ))}
          </div>
        ) : (
          <Empty description={copy.messages.fullRangeEmpty} />
        )}
      </Modal>
    </>
  );
}
