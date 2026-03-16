import { App as AntdApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { themeConfig } from './themeConfig';

export function App(): JSX.Element {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('zh') ? zhCN : enUS;

  return (
    <ConfigProvider locale={locale} theme={themeConfig}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}
