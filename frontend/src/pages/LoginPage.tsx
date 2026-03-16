import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';

const { Paragraph, Title } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage(): JSX.Element {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<LoginFormValues>();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const copy = {
    success: isZh ? '登录成功' : 'Login successful.',
    description: isZh
      ? '员工登录后即可访问库存、客户、订单与收银等核心业务模块。'
      : 'Sign in to access inventory, customers, orders and checkout workflows.',
    username: isZh ? '用户名' : 'Username',
    usernamePlaceholder: isZh ? '请输入用户名' : 'Enter username',
    usernameRequired: isZh ? '请输入用户名' : 'Please enter username.',
    password: isZh ? '密码' : 'Password',
    passwordPlaceholder: isZh ? '请输入密码' : 'Enter password',
    passwordRequired: isZh ? '请输入密码' : 'Please enter password.',
    submit: isZh ? '登录系统' : 'Sign In',
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      await login(values.username, values.password);
      messageApi.success(copy.success);
      navigate('/', { replace: true });
    } catch {
      // handled by existing form and request layer
    }
  };

  return (
    <>
      {contextHolder}

      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe,transparent_42%),linear-gradient(135deg,#f8fafc,#e2e8f0)] px-6">
        <Card className="w-full max-w-md rounded-3xl border-0 shadow-2xl">
          <div className="mb-8">
            <Title level={2} className="!mb-2">
              Hearing ERP
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              {copy.description}
            </Paragraph>
          </div>

          <Form<LoginFormValues> form={form} layout="vertical" onFinish={() => void handleSubmit()}>
            <Form.Item label={copy.username} name="username" rules={[{ required: true, message: copy.usernameRequired }]}>
              <Input prefix={<UserOutlined />} placeholder={copy.usernamePlaceholder} autoComplete="username" size="large" />
            </Form.Item>

            <Form.Item label={copy.password} name="password" rules={[{ required: true, message: copy.passwordRequired }]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={copy.passwordPlaceholder}
                autoComplete="current-password"
                size="large"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" block>
              {copy.submit}
            </Button>
          </Form>
        </Card>
      </div>
    </>
  );
}
