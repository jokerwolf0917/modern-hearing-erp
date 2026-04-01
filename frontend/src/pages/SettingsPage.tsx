import { BellOutlined, GlobalOutlined, PrinterOutlined, ShopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Form, Select, Space, Switch, Typography, message } from 'antd';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AppLanguage,
  type AppSettings,
  type DefaultStoreId,
  type ReceiptLanguage,
  useAppSettings,
} from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getStores } from '../services/store';

const { Paragraph, Text, Title } = Typography;

interface SettingsFormValues {
  language: AppLanguage;
  defaultStoreId: DefaultStoreId;
  notifications: AppSettings['notifications'];
  print: AppSettings['print'];
}

export function SettingsPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<SettingsFormValues>();
  const { i18n } = useTranslation();
  const { settings, replaceSettings, resetSettings } = useAppSettings();
  const { employee } = useAuth();
  const isZh = i18n.language.startsWith('zh');
  const isAdmin = employee?.role === 'ADMIN';

  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  useEffect(() => {
    form.setFieldsValue({
      language: settings.language,
      defaultStoreId: settings.defaultStoreId,
      notifications: settings.notifications,
      print: settings.print,
    });
  }, [form, settings]);

  const assignedStoreName = storesQuery.data?.find((store) => store.id === employee?.store_id)?.name || '-';

  const copy = {
    title: isZh ? '设置中心' : 'Settings',
    subtitle: isZh
      ? '在这里统一维护个人偏好，让语言、默认门店、提醒和打印习惯保持一致。'
      : 'Manage personal preferences for language, default store, reminders and printing in one place.',
    languageTitle: isZh ? '语言与显示' : 'Language & display',
    languageDescription: isZh ? '切换界面语言，并控制系统默认显示语言。' : 'Switch interface language and control the default app language.',
    defaultStoreTitle: isZh ? '默认门店' : 'Default store',
    defaultStoreDescription: isZh ? '管理账号进入高频页面时的默认门店视图。' : 'Choose the initial store view for high-frequency pages.',
    notificationsTitle: isZh ? '通知偏好' : 'Notification preferences',
    notificationsDescription: isZh ? '控制哪些提醒在系统内优先呈现给你。' : 'Control which reminders are prioritized inside the app.',
    printTitle: isZh ? '打印偏好' : 'Print preferences',
    printDescription: isZh ? '设置销售凭证的语言与展示细节。' : 'Set receipt language and printed detail options.',
    save: isZh ? '保存设置' : 'Save settings',
    reset: isZh ? '恢复默认' : 'Reset to default',
    saveSuccess: isZh ? '设置已保存并立即生效' : 'Settings saved and applied.',
    resetSuccess: isZh ? '设置已恢复默认值' : 'Settings reset to default.',
    languageLabel: isZh ? '界面语言' : 'Interface language',
    defaultStoreLabel: isZh ? '页面默认门店' : 'Default store view',
    adminStoreHint: isZh
      ? '管理账号可设为“全部门店”或指定门店；支持门店切换的页面会优先使用这里的默认值。'
      : 'Admins can set this to all stores or a specific store. Store-aware pages will use this as the initial view.',
    lockedStoreHint: isZh
      ? '当前账号会自动锁定到所属门店，因此无需单独设置默认门店。'
      : 'This account is locked to its assigned store, so a separate default store is not needed.',
    zh: isZh ? '中文' : 'Chinese',
    en: isZh ? '英文' : 'English',
    allStores: isZh ? '全部门店' : 'All stores',
    receiptLanguageLabel: isZh ? '打印语言' : 'Receipt language',
    receiptLanguageFollow: isZh ? '跟随界面语言' : 'Follow interface language',
    receiptLanguageZh: isZh ? '始终中文' : 'Always Chinese',
    receiptLanguageEn: isZh ? '始终英文' : 'Always English',
    showWarranty: isZh ? '显示保修信息' : 'Show warranty details',
    showDisclaimer: isZh ? '显示底部提示' : 'Show disclaimer',
    appointmentReminder: isZh ? '显示今日预约提醒' : 'Show appointment reminders',
    repairDueReminder: isZh ? '显示维修到期提醒' : 'Show repair due reminders',
    lowStockReminder: isZh ? '显示低库存提醒' : 'Show low-stock reminders',
    orderSound: isZh ? '新订单操作成功后提示音' : 'Play sound on successful orders',
    currentSummary: isZh ? '当前摘要' : 'Current summary',
    noteTitle: isZh ? '说明' : 'Note',
    noteBody: isZh
      ? '语言会立即作用于导航、登录页、Ant Design 组件和打印凭证。默认门店会影响支持门店切换的高频业务页面。'
      : 'Language updates the shell, login page, Ant Design locale and printed receipts immediately. Default store affects store-aware business pages.',
    lockedStoreValue: isZh ? `当前门店：${assignedStoreName}` : `Assigned store: ${assignedStoreName}`,
  };

  const storeOptions = [
    ...(isAdmin ? [{ label: copy.allStores, value: 'ALL' as const }] : []),
    ...(storesQuery.data ?? []).map((store) => ({
      label: store.name,
      value: store.id,
    })),
  ];

  function handleReset(): void {
    resetSettings();
    messageApi.success(copy.resetSuccess);
  }

  function handleSave(values: SettingsFormValues): void {
    replaceSettings({
      language: values.language,
      defaultStoreId: isAdmin ? values.defaultStoreId ?? 'ALL' : null,
      notifications: values.notifications,
      print: values.print,
    });
    messageApi.success(copy.saveSuccess);
  }

  return (
    <>
      {contextHolder}

      <div className="settings-shell">
        <Card className="settings-hero-card" bodyStyle={{ padding: 20 }}>
          <div className="settings-hero-copy">
            <Title level={2} style={{ margin: 0 }}>
              {copy.title}
            </Title>
            <Paragraph className="!mb-0 !mt-2">{copy.subtitle}</Paragraph>
          </div>
        </Card>

        <Form<SettingsFormValues> form={form} layout="vertical" onFinish={handleSave}>
          <div className="settings-grid">
            <div className="settings-main">
              <Card bodyStyle={{ padding: 20 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <SectionHead icon={<GlobalOutlined />} title={copy.languageTitle} description={copy.languageDescription} />
                  <Form.Item label={copy.languageLabel} name="language">
                    <Select
                      options={[
                        { label: copy.zh, value: 'zh' satisfies AppLanguage },
                        { label: copy.en, value: 'en' satisfies AppLanguage },
                      ]}
                    />
                  </Form.Item>
                </Space>
              </Card>

              <Card bodyStyle={{ padding: 20 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <SectionHead icon={<ShopOutlined />} title={copy.defaultStoreTitle} description={copy.defaultStoreDescription} />

                  {isAdmin ? (
                    <Form.Item label={copy.defaultStoreLabel} name="defaultStoreId">
                      <Select loading={storesQuery.isLoading} options={storeOptions} placeholder={copy.allStores} />
                    </Form.Item>
                  ) : (
                    <div className="settings-note-card">
                      <Text strong>{copy.lockedStoreValue}</Text>
                    </div>
                  )}

                  <Paragraph className="settings-hint">{isAdmin ? copy.adminStoreHint : copy.lockedStoreHint}</Paragraph>
                </Space>
              </Card>

              <Card bodyStyle={{ padding: 20 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <SectionHead icon={<BellOutlined />} title={copy.notificationsTitle} description={copy.notificationsDescription} />

                  <div className="settings-switch-list">
                    <SwitchField name={['notifications', 'appointmentReminder']} label={copy.appointmentReminder} />
                    <SwitchField name={['notifications', 'repairDueReminder']} label={copy.repairDueReminder} />
                    <SwitchField name={['notifications', 'lowStockReminder']} label={copy.lowStockReminder} />
                    <SwitchField name={['notifications', 'orderSound']} label={copy.orderSound} />
                  </div>
                </Space>
              </Card>

              <Card bodyStyle={{ padding: 20 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <SectionHead icon={<PrinterOutlined />} title={copy.printTitle} description={copy.printDescription} />

                  <Form.Item label={copy.receiptLanguageLabel} name={['print', 'receiptLanguage']}>
                    <Select
                      options={[
                        { label: copy.receiptLanguageFollow, value: 'follow' satisfies ReceiptLanguage },
                        { label: copy.receiptLanguageZh, value: 'zh' satisfies ReceiptLanguage },
                        { label: copy.receiptLanguageEn, value: 'en' satisfies ReceiptLanguage },
                      ]}
                    />
                  </Form.Item>

                  <div className="settings-switch-list">
                    <SwitchField name={['print', 'showWarrantyInfo']} label={copy.showWarranty} />
                    <SwitchField name={['print', 'showDisclaimer']} label={copy.showDisclaimer} />
                  </div>
                </Space>
              </Card>
            </div>

            <div className="settings-side">
              <Card bodyStyle={{ padding: 20 }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Text strong>{copy.currentSummary}</Text>

                  <div className="settings-summary-list">
                    <div className="settings-summary-item">
                      <Text type="secondary">{copy.languageLabel}</Text>
                      <Text strong>{settings.language === 'zh' ? copy.zh : copy.en}</Text>
                    </div>
                    <div className="settings-summary-item">
                      <Text type="secondary">{copy.defaultStoreLabel}</Text>
                      <Text strong>
                        {isAdmin
                          ? settings.defaultStoreId === 'ALL'
                            ? copy.allStores
                            : storesQuery.data?.find((store) => store.id === settings.defaultStoreId)?.name || '-'
                          : assignedStoreName}
                      </Text>
                    </div>
                    <div className="settings-summary-item">
                      <Text type="secondary">{copy.receiptLanguageLabel}</Text>
                      <Text strong>
                        {settings.print.receiptLanguage === 'follow'
                          ? copy.receiptLanguageFollow
                          : settings.print.receiptLanguage === 'zh'
                            ? copy.receiptLanguageZh
                            : copy.receiptLanguageEn}
                      </Text>
                    </div>
                  </div>

                  <div className="settings-note-card">
                    <Text strong>{copy.noteTitle}</Text>
                    <Paragraph className="!mb-0 !mt-2">{copy.noteBody}</Paragraph>
                  </div>

                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button onClick={handleReset}>{copy.reset}</Button>
                    <Button type="primary" htmlType="submit">
                      {copy.save}
                    </Button>
                  </Space>
                </Space>
              </Card>
            </div>
          </div>
        </Form>
      </div>
    </>
  );
}

function SectionHead({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="settings-section-head">
      <Space size={10} align="start">
        <span className="settings-icon-chip">{icon}</span>
        <div>
          <Text strong>{title}</Text>
          <Paragraph className="!mb-0 !mt-1">{description}</Paragraph>
        </div>
      </Space>
    </div>
  );
}

function SwitchField({ name, label }: { name: (string | number)[]; label: string }): JSX.Element {
  return (
    <div className="settings-switch-row">
      <Text>{label}</Text>
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch />
      </Form.Item>
    </div>
  );
}
