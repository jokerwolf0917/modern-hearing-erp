import { Typography } from 'antd';

const { Paragraph, Title } = Typography;

interface PagePlaceholderProps {
  title: string;
  description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps): JSX.Element {
  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <Title level={3} className="!mb-2">
        {title}
      </Title>
      <Paragraph type="secondary" className="!mb-0">
        {description}
      </Paragraph>
    </section>
  );
}
