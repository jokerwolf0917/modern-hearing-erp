import { useTranslation } from 'react-i18next';

import { PagePlaceholder } from '../components/PagePlaceholder';

export function AIAssistantPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <PagePlaceholder
      title={isZh ? 'AI 录入' : 'AI Intake'}
      description={
        isZh
          ? '这里用于上传听力图或纸质档案，触发 AI 视觉结构化录入。'
          : 'Upload audiograms or paper records here to trigger AI-powered structured intake.'
      }
    />
  );
}
