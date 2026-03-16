import { InboxOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Table, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import type { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { uploadAudiogram, type IAudiogramResponse } from '../services/ai';
import { normalizeApiErrorMessage, type ApiErrorResponse } from '../utils/request';

const { Dragger } = Upload;
const { Paragraph, Text, Title } = Typography;

interface ThresholdRow {
  key: string;
  frequency: string;
  left: number | string;
  right: number | string;
}

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const FREQUENCY_KEYS = ['250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz'] as const;

function buildThresholdRows(data: IAudiogramResponse | null): ThresholdRow[] {
  if (!data) {
    return [];
  }

  return FREQUENCY_KEYS.filter(
    (frequency) => data.left_ear_thresholds[frequency] != null || data.right_ear_thresholds[frequency] != null,
  ).map((frequency) => ({
    key: frequency,
    frequency,
    left: data.left_ear_thresholds[frequency] ?? '-',
    right: data.right_ear_thresholds[frequency] ?? '-',
  }));
}

export function AIAssistant(): JSX.Element {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<IAudiogramResponse | null>(null);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    parseFailed: isZh ? 'AI 解析失败，请稍后重试。' : 'AI parsing failed. Please try again later.',
    parsed: isZh ? '听力图解析完成。' : 'Audiogram parsing completed.',
    typeError: isZh ? '仅支持 JPG、JPEG、PNG 图片格式。' : 'Only JPG, JPEG and PNG formats are supported.',
    sizeError: isZh ? `图片大小不能超过 ${MAX_FILE_SIZE_MB}MB。` : `Image size must not exceed ${MAX_FILE_SIZE_MB}MB.`,
    title: isZh ? 'AI 听力图录入' : 'AI Audiogram Intake',
    description: isZh
      ? '上传客户纸质听力图或档案照片，系统将调用后端 AI 服务提取结构化数据。'
      : 'Upload a paper audiogram or profile photo and let the backend AI extract structured hearing data.',
    parsing: isZh ? '正在解析图片，请稍候...' : 'Parsing image, please wait...',
    uploadText: isZh ? '点击或拖拽图片到这里' : 'Click or drag an image here',
    uploadHint: isZh ? '支持 JPG / JPEG / PNG，单张图片不超过 8MB。' : 'Supports JPG / JPEG / PNG up to 8MB per image.',
    currentFile: isZh ? '当前文件：' : 'Current file:',
    noFile: isZh ? '尚未选择文件' : 'No file selected yet',
    analyze: isZh ? '开始 AI 解析' : 'Start AI Parse',
    clear: isZh ? '清空' : 'Clear',
    empty: isZh ? '请上传听力图进行 AI 解析' : 'Upload an audiogram image to start AI parsing',
    resultTitle: isZh ? '解析结果' : 'Parsed Result',
    resultDescription: isZh
      ? '以下为后端 AI 接口返回的结构化数据，可直接用于人工复核或后续录入。'
      : 'This is the structured output returned by the backend AI endpoint and can be used for review or follow-up entry.',
    customerName: isZh ? '客户姓名' : 'Customer Name',
    modelMentioned: isZh ? '推荐型号 / 提及型号' : 'Mentioned Model',
    unknown: isZh ? '未识别' : 'Not detected',
    thresholdTable: isZh ? '听阈对照表' : 'Threshold Comparison',
    noThresholdData: isZh ? '未识别到可用阈值数据' : 'No threshold values were detected',
    rawSummary: isZh ? '原始总结' : 'Raw Summary',
    frequency: isZh ? '频点' : 'Frequency',
    leftEar: isZh ? '左耳 (dB HL)' : 'Left Ear (dB HL)',
    rightEar: isZh ? '右耳 (dB HL)' : 'Right Ear (dB HL)',
  };

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return normalizeApiErrorMessage(axiosError.response?.data, copy.parseFailed);
  };

  const mutation = useMutation({
    mutationFn: uploadAudiogram,
    onSuccess: (data) => {
      setResult(data);
      messageApi.success(copy.parsed);
    },
    onError: (error) => {
      messageApi.error(getErrorMessage(error));
    },
  });

  const thresholdRows = buildThresholdRows(result);

  const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (mutation.isPending) {
      return Upload.LIST_IGNORE;
    }

    if (!SUPPORTED_TYPES.has(file.type)) {
      messageApi.error(copy.typeError);
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      messageApi.error(copy.sizeError);
      return Upload.LIST_IGNORE;
    }

    setSelectedFile(file as File);
    setFileList([file]);
    return false;
  };

  const handleRemove = (): boolean => {
    if (mutation.isPending) {
      return false;
    }

    setSelectedFile(null);
    setFileList([]);
    return true;
  };

  const handleAnalyze = async (): Promise<void> => {
    if (!selectedFile || mutation.isPending) {
      return;
    }

    try {
      await mutation.mutateAsync(selectedFile);
    } catch {
      // handled by mutation
    }
  };

  const thresholdColumns = [
    {
      title: copy.frequency,
      dataIndex: 'frequency',
      key: 'frequency',
    },
    {
      title: copy.leftEar,
      dataIndex: 'left',
      key: 'left',
    },
    {
      title: copy.rightEar,
      dataIndex: 'right',
      key: 'right',
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      {messageContextHolder}

      <Card className="rounded-2xl shadow-sm" styles={{ body: { padding: 24 } }}>
        <Space direction="vertical" size="large" className="w-full">
          <div>
            <Title level={4} className="!mb-2">
              {copy.title}
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              {copy.description}
            </Paragraph>
          </div>

          <Spin spinning={mutation.isPending} tip={copy.parsing}>
            <Dragger
              multiple={false}
              maxCount={1}
              accept=".jpg,.jpeg,.png"
              disabled={mutation.isPending}
              fileList={fileList}
              beforeUpload={handleBeforeUpload}
              onRemove={handleRemove}
              showUploadList={{ showPreviewIcon: false }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{copy.uploadText}</p>
              <p className="ant-upload-hint">{copy.uploadHint}</p>
            </Dragger>
          </Spin>

          <Space direction="vertical" className="w-full" size="middle">
            <div className="rounded-xl bg-slate-50 p-4">
              <Text strong>{copy.currentFile}</Text>
              <div className="mt-2 text-slate-600">{selectedFile?.name ?? copy.noFile}</div>
            </div>

            <Space>
              <Button type="primary" size="large" onClick={() => void handleAnalyze()} loading={mutation.isPending} disabled={!selectedFile || mutation.isPending}>
                {copy.analyze}
              </Button>
              <Button
                size="large"
                onClick={() => {
                  if (mutation.isPending) {
                    return;
                  }
                  setSelectedFile(null);
                  setFileList([]);
                }}
                disabled={!selectedFile || mutation.isPending}
              >
                {copy.clear}
              </Button>
            </Space>
          </Space>
        </Space>
      </Card>

      <Card className="rounded-2xl shadow-sm" styles={{ body: { padding: 24 } }}>
        {!result ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Empty description={copy.empty} />
          </div>
        ) : (
          <Space direction="vertical" size="large" className="w-full">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Title level={4} className="!mb-2">
                  {copy.resultTitle}
                </Title>
                <Paragraph type="secondary" className="!mb-0">
                  {copy.resultDescription}
                </Paragraph>
              </div>
              <Tag color="cyan">AI Parsed</Tag>
            </div>

            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label={copy.customerName}>
                {result.customer_name ?? copy.unknown}
              </Descriptions.Item>
              <Descriptions.Item label={copy.modelMentioned}>
                {result.hearing_aid_model_mentioned ?? copy.unknown}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={copy.thresholdTable}>
              <Table<ThresholdRow>
                rowKey="key"
                columns={thresholdColumns}
                dataSource={thresholdRows}
                pagination={false}
                size="small"
                locale={{ emptyText: copy.noThresholdData }}
              />
            </Card>

            <Alert
              type="info"
              showIcon
              message={copy.rawSummary}
              description={<div className="whitespace-pre-wrap text-sm leading-6">{result.raw_text_summary}</div>}
            />
          </Space>
        )}
      </Card>
    </div>
  );
}
