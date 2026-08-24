import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; senha: string }) {
    setLoading(true);
    try {
      // Quem entrou com senha provisoria vai direto para a troca; os demais
      // caem na primeira tela que tem direito de ver (o "*" resolve isso).
      await login(values.email, values.senha);
      navigate('/');
    } catch {
      message.error('Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2B2622 0%, #B85F12 100%)',
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 40, objectFit: 'contain', marginBottom: 12 }}
          />
          <Typography.Title level={3} style={{ marginBottom: 0, color: '#D37119' }}>
            Sistema de Qualidade
          </Typography.Title>
          <Typography.Text type="secondary">Big Dutchman Brasil</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="email"
            label="E-mail"
            rules={[{ required: true, message: 'Informe o e-mail.' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="seu@email.com" size="large" />
          </Form.Item>
          <Form.Item
            name="senha"
            label="Senha"
            rules={[{ required: true, message: 'Informe a senha.' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Entrar
          </Button>
        </Form>
      </Card>
    </div>
  );
}
