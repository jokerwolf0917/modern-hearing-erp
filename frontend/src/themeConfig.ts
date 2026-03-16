import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    borderRadius: 12,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f7fa',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    fontSize: 14,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.72,
    boxShadowSecondary: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.05)',
  },
  components: {
    Card: {
      colorBorderSecondary: 'transparent',
      bodyPadding: 28,
      headerPadding: 28,
      boxShadowTertiary: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.05)',
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#0f172a',
      borderColor: '#edf2f7',
      cellPaddingBlock: 18,
      cellPaddingInline: 16,
      rowHoverBg: '#f8fafc',
      headerSplitColor: 'transparent',
    },
    Menu: {
      colorSplit: 'transparent',
      itemBorderRadius: 12,
      itemMarginInline: 8,
      itemMarginBlock: 6,
      itemSelectedBg: '#eef4ff',
      itemSelectedColor: '#1d4ed8',
      itemHoverColor: '#0f172a',
      itemHoverBg: '#f8fafc',
      subMenuItemBg: 'transparent',
      groupTitleColor: '#94a3b8',
    },
    Layout: {
      bodyBg: '#f5f7fa',
      siderBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Button: {
      fontWeight: 600,
      controlHeight: 42,
      primaryShadow: '0 10px 24px rgba(37, 99, 235, 0.18)',
    },
    Form: {
      itemMarginBottom: 22,
    },
    Tag: {
      defaultBg: '#f8fafc',
      defaultColor: '#475569',
    },
  },
};
