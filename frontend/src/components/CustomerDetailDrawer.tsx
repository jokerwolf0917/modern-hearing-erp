import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Skeleton,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { createCustomerAudiogram, getCustomerAudiograms, type IAudiogram } from '../services/audiogram';
import { uploadAudiogram } from '../services/ai';
import type { ICustomer } from '../services/customer';

const { Paragraph, Text } = Typography;
const CORE_FREQUENCIES = ['500', '1000', '2000', '4000'] as const;
const AUDIOGRAM_TICKS = [0, 20, 40, 60, 80, 100, 120];

interface CustomerDetailDrawerProps {
  customer: ICustomer | null;
  open: boolean;
  onClose: () => void;
}

interface AudiogramFormValues {
  test_date: Dayjs;
  left_ear_data: Record<string, number>;
  right_ear_data: Record<string, number>;
  notes?: string;
}

interface AudiogramChartPoint {
  frequency: string;
  left: number | null;
  right: number | null;
}

type InputMode = 'ai' | 'manual';

const DEFAULT_AUDIOGRAM_VALUES = {
  left_ear_data: { '500': 20, '1000': 25, '2000': 30, '4000': 35 },
  right_ear_data: { '500': 20, '1000': 25, '2000': 30, '4000': 35 },
} satisfies Pick<AudiogramFormValues, 'left_ear_data' | 'right_ear_data'>;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function buildChartData(record: IAudiogram): AudiogramChartPoint[] {
  return CORE_FREQUENCIES.map((frequency) => ({
    frequency: `${frequency}Hz`,
    left: record.left_ear_data[frequency] ?? null,
    right: record.right_ear_data[frequency] ?? null,
  }));
}

function formatEarData(data: Record<string, number>): string {
  return CORE_FREQUENCIES.map((frequency) => `${frequency}Hz: ${data[frequency] ?? '-'} dB`).join(' / ');
}

function LeftEarDot(props: { cx?: number; cy?: number; payload?: AudiogramChartPoint }): JSX.Element | null {
  if (typeof props.cx !== 'number' || typeof props.cy !== 'number' || props.payload?.left == null) {
    return null;
  }

  return (
    <g>
      <line x1={props.cx - 5} y1={props.cy - 5} x2={props.cx + 5} y2={props.cy + 5} stroke="#1890ff" strokeWidth={2} />
      <line x1={props.cx + 5} y1={props.cy - 5} x2={props.cx - 5} y2={props.cy + 5} stroke="#1890ff" strokeWidth={2} />
    </g>
  );
}

function RightEarDot(props: { cx?: number; cy?: number; payload?: AudiogramChartPoint }): JSX.Element | null {
  if (typeof props.cx !== 'number' || typeof props.cy !== 'number' || props.payload?.right == null) {
    return null;
  }

  return <circle cx={props.cx} cy={props.cy} r={5} fill="#ffffff" stroke="#f5222d" strokeWidth={2} />;
}

export function CustomerDetailDrawer({ customer, open, onClose }: CustomerDetailDrawerProps): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<AudiogramFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('ai');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const queryClient = useQueryClient();

  const audiogramQuery = useQuery({
    queryKey: ['customer-audiograms', customer?.id],
    queryFn: () => getCustomerAudiograms(customer!.id),
    enabled: open && Boolean(customer?.id),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { customerId: string; values: AudiogramFormValues }) =>
      createCustomerAudiogram(payload.customerId, {
        test_date: payload.values.test_date.format('YYYY-MM-DD'),
        left_ear_data: payload.values.left_ear_data,
        right_ear_data: payload.values.right_ear_data,
        notes: payload.values.notes,
      }),
    onSuccess: async () => {
      messageApi.success('Audiogram saved');
      setIsModalOpen(false);
      resetModalState();
      await queryClient.invalidateQueries({ queryKey: ['customer-audiograms', customer?.id] });
    },
  });

  const aiParseMutation = useMutation({
    mutationFn: (file: File) => uploadAudiogram(file),
    onSuccess: (result) => {
      form.setFieldsValue({
        left_ear_data: {
          '500': result.left_ear_thresholds['500Hz'] ?? undefined,
          '1000': result.left_ear_thresholds['1kHz'] ?? undefined,
          '2000': result.left_ear_thresholds['2kHz'] ?? undefined,
          '4000': result.left_ear_thresholds['4kHz'] ?? undefined,
        },
        right_ear_data: {
          '500': result.right_ear_thresholds['500Hz'] ?? undefined,
          '1000': result.right_ear_thresholds['1kHz'] ?? undefined,
          '2000': result.right_ear_thresholds['2kHz'] ?? undefined,
          '4000': result.right_ear_thresholds['4kHz'] ?? undefined,
        },
        notes: result.raw_text_summary || form.getFieldValue('notes'),
      });
      messageApi.success('AI parse completed. Please review the values before saving.');
    },
  });

  function resetModalState(): void {
    setInputMode('ai');
    setFileList([]);
    form.resetFields();
  }

  function openCreateModal(): void {
    resetModalState();
    form.setFieldsValue(DEFAULT_AUDIOGRAM_VALUES);
    setIsModalOpen(true);
  }

  function closeCreateModal(): void {
    if (createMutation.isPending || aiParseMutation.isPending) {
      return;
    }

    setIsModalOpen(false);
    resetModalState();
  }

  async function handleCreateAudiogram(): Promise<void> {
    if (!customer?.id) {
      return;
    }

    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({ customerId: customer.id, values });
    } catch {
      // Ant Design form validation and React Query error handlers cover the UX.
    }
  }

  const handleAiFileSelected: UploadProps['beforeUpload'] = (file) => {
    if (aiParseMutation.isPending) {
      return Upload.LIST_IGNORE;
    }

    setFileList([
      {
        uid: file.uid,
        name: file.name,
        status: 'done',
        size: file.size,
        type: file.type,
      },
    ]);
    void aiParseMutation.mutateAsync(file);
    return false;
  };

  const handleAiFileRemove = (): boolean => {
    if (aiParseMutation.isPending) {
      return false;
    }

    setFileList([]);
    return true;
  };

  return (
    <>
      {contextHolder}

      <Spin
        fullscreen
        spinning={aiParseMutation.isPending}
        tip="AI is analyzing the audiogram image. This may take 20-30 seconds..."
      />

      <Drawer
        title="Customer Detail"
        width={980}
        open={open}
        onClose={() => {
          if (createMutation.isPending || aiParseMutation.isPending) {
            return;
          }
          onClose();
        }}
        destroyOnHidden
      >
        {!customer ? (
          <Empty description="Please select a customer" />
        ) : (
          <Space direction="vertical" size="large" className="w-full">
            <Card className="rounded-2xl shadow-sm">
              <Descriptions title="Customer Info" bordered column={2}>
                <Descriptions.Item label="Name">{customer.name}</Descriptions.Item>
                <Descriptions.Item label="Phone">{customer.phone}</Descriptions.Item>
                <Descriptions.Item label="Age">{customer.age ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Gender">{customer.gender ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Hearing Loss">{customer.hearing_loss_type ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Created At">{formatDateTime(customer.created_at)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              className="rounded-2xl shadow-sm"
              title="Audiogram Records"
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                  Add Audiogram
                </Button>
              }
            >
              <Paragraph type="secondary">
                Each record is rendered as a clinical-style audiogram. The Y axis is inverted: 0 dB at the top and 120 dB at the bottom.
              </Paragraph>

              {audiogramQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : audiogramQuery.data && audiogramQuery.data.length > 0 ? (
                <Space direction="vertical" size="large" className="w-full">
                  {audiogramQuery.data.map((record) => (
                    <Card
                      key={record.id}
                      className="rounded-2xl border border-slate-200"
                      title={`Audiogram · ${record.test_date}`}
                      extra={<Text type="secondary">Recorded at: {formatDateTime(record.created_at)}</Text>}
                    >
                      <Space direction="vertical" size="middle" className="w-full">
                        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                          <div>
                            <Text strong>Left ear</Text>
                            <div className="mt-1 text-slate-600">{formatEarData(record.left_ear_data)}</div>
                          </div>
                          <div>
                            <Text strong>Right ear</Text>
                            <div className="mt-1 text-slate-600">{formatEarData(record.right_ear_data)}</div>
                          </div>
                        </div>

                        <div className="h-[320px] rounded-xl border border-slate-200 bg-white p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={buildChartData(record)} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
                              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                              <XAxis dataKey="frequency" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                              <YAxis
                                type="number"
                                domain={[0, 120]}
                                reversed
                                ticks={AUDIOGRAM_TICKS}
                                tickLine={false}
                                axisLine={{ stroke: '#cbd5e1' }}
                                label={{ value: 'dB HL', angle: -90, position: 'insideLeft' }}
                              />
                              <Tooltip
                                formatter={(value, name) => [
                                  value == null ? '-' : `${String(value)} dB`,
                                  String(name) === 'left' ? 'Left ear' : 'Right ear',
                                ]}
                              />
                              <Legend formatter={(value: string) => (value === 'left' ? 'Left ear (X)' : 'Right ear (O)')} />
                              <Line
                                type="monotone"
                                dataKey="left"
                                name="left"
                                stroke="#1890ff"
                                strokeWidth={2}
                                dot={<LeftEarDot />}
                                connectNulls={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="right"
                                name="right"
                                stroke="#f5222d"
                                strokeWidth={2}
                                dot={<RightEarDot />}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {record.notes ? (
                          <div className="rounded-xl bg-slate-50 p-4 text-slate-600">
                            <Text strong>Notes:</Text>
                            <div className="mt-1 whitespace-pre-wrap">{record.notes}</div>
                          </div>
                        ) : null}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Empty description="No audiogram records yet" />
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="Add Audiogram"
        open={isModalOpen}
        onCancel={closeCreateModal}
        onOk={() => void handleCreateAudiogram()}
        confirmLoading={createMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<AudiogramFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            ...DEFAULT_AUDIOGRAM_VALUES,
          }}
        >
          <Form.Item label="Input mode" className="mb-4">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={inputMode}
              onChange={(event) => setInputMode(event.target.value as InputMode)}
              options={[
                { label: 'AI Parse', value: 'ai' },
                { label: 'Manual', value: 'manual' },
              ]}
            />
          </Form.Item>

          {inputMode === 'ai' ? (
            <div className="mb-6">
              <Alert
                showIcon
                type="info"
                className="mb-4"
                message="Upload a paper audiogram image and the system will auto-fill 500Hz / 1000Hz / 2000Hz / 4000Hz thresholds."
              />

              <Upload.Dragger
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                beforeUpload={handleAiFileSelected}
                fileList={fileList}
                maxCount={1}
                multiple={false}
                disabled={aiParseMutation.isPending}
                onRemove={handleAiFileRemove}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click or drag an audiogram image here</p>
                <p className="ant-upload-hint">Supported: JPG / JPEG / PNG. AI parsing starts immediately after selection.</p>
              </Upload.Dragger>
            </div>
          ) : null}

          <Form.Item label="Test date" name="test_date" rules={[{ required: true, message: 'Please choose a test date' }]}>
            <DatePicker className="w-full" />
          </Form.Item>

          <Card size="small" title="Left ear threshold (dB)">
            <Space direction="vertical" size="middle" className="w-full">
              {CORE_FREQUENCIES.map((frequency) => (
                <Form.Item
                  key={`left-${frequency}`}
                  label={`${frequency}Hz`}
                  name={['left_ear_data', frequency]}
                  rules={[{ required: true, message: `Please enter the left ear ${frequency}Hz threshold` }]}
                >
                  <InputNumber className="w-full" min={0} max={140} precision={0} />
                </Form.Item>
              ))}
            </Space>
          </Card>

          <Card size="small" title="Right ear threshold (dB)" className="mt-4">
            <Space direction="vertical" size="middle" className="w-full">
              {CORE_FREQUENCIES.map((frequency) => (
                <Form.Item
                  key={`right-${frequency}`}
                  label={`${frequency}Hz`}
                  name={['right_ear_data', frequency]}
                  rules={[{ required: true, message: `Please enter the right ear ${frequency}Hz threshold` }]}
                >
                  <InputNumber className="w-full" min={0} max={140} precision={0} />
                </Form.Item>
              ))}
            </Space>
          </Card>

          <Form.Item label="Notes" name="notes" className="mt-4">
            <Input.TextArea rows={3} placeholder="Optional notes" maxLength={500} />
          </Form.Item>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <Text strong>JSON example:</Text>
            <pre className="mb-0 mt-2 whitespace-pre-wrap">
{`{
  "left_ear_data": { "500": 25, "1000": 30, "2000": 40, "4000": 55 },
  "right_ear_data": { "500": 20, "1000": 25, "2000": 35, "4000": 50 }
}`}
            </pre>
          </div>
        </Form>
      </Modal>
    </>
  );
}
