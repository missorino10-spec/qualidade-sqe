import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

/**
 * Primeiro acesso: o admin entrega uma senha provisoria e a pessoa define a
 * dela aqui antes de usar o sistema. A mesma tela serve para quem so quer
 * trocar a senha depois de um reset.
 */
export default function TrocarSenha() {
  const { usuario, recarregar, logout } = useAuth();
  const navigate = useNavigate();
  const [salvando, setSalvando] = useState(false);

  if (!usuario) return <Navigate to="/login" replace />;

  async function onFinish(v: { senhaAtual: string; novaSenha: string }) {
    setSalvando(true);
    try {
      await api.post('/auth/trocar-senha', {
        senhaAtual: v.senhaAtual,
        novaSenha: v.novaSenha,
      });
      await recarregar();
      message.success('Senha alterada. Bem-vindo!');
      navigate('/');
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível alterar a senha.',
      );
    } finally {
      setSalvando(false);
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
      <Card style={{ width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 36, objectFit: 'contain', marginBottom: 12 }}
          />
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Defina sua senha
          </Typography.Title>
          <Typography.Text type="secondary">{usuario.email}</Typography.Text>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Você entrou com uma senha provisória. Escolha uma senha só sua para continuar."
        />

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="senhaAtual"
            label="Senha provisória"
            rules={[{ required: true, message: 'Informe a senha provisória.' }]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Form.Item
            name="novaSenha"
            label="Nova senha"
            rules={[
              { required: true, message: 'Informe a nova senha.' },
              { min: 6, message: 'Use 6 caracteres ou mais.' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Form.Item
            name="confirmacao"
            label="Repita a nova senha"
            dependencies={['novaSenha']}
            rules={[
              { required: true, message: 'Repita a nova senha.' },
              ({ getFieldValue }) => ({
                validator: (_, valor) =>
                  !valor || valor === getFieldValue('novaSenha')
                    ? Promise.resolve()
                    : Promise.reject(new Error('As senhas não são iguais.')),
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={salvando}>
            Salvar e entrar
          </Button>
          <Button
            type="link"
            block
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </Form>
      </Card>
    </div>
  );
}
