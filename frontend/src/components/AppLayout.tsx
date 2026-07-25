import { ReactNode } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
  ShopOutlined,
  AuditOutlined,
  WarningOutlined,
  LogoutOutlined,
  UserOutlined,
  SlidersOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const { Header, Sider, Content } = Layout;

const emDesenvolvimento = [
  {
    key: 'em-desenvolvimento',
    label: 'EM DESENVOLVIMENTO',
    disabled: true,
  },
];

const itensMenu = [
  {
    key: 'sqe',
    icon: <ExperimentOutlined />,
    label: 'QUALIDADE - SQE',
    children: [
      { key: '/', icon: <DashboardOutlined />, label: 'Painel' },
      { key: '/inspecoes', icon: <AuditOutlined />, label: 'Inspeções' },
      { key: '/rnc', icon: <WarningOutlined />, label: 'RNC' },
      { key: '/fornecedores', icon: <ShopOutlined />, label: 'Fornecedores' },
      {
        key: '/periodicidade',
        icon: <SlidersOutlined />,
        label: 'Periodicidade',
      },
    ],
  },
  {
    key: 'manufatura',
    icon: <ToolOutlined />,
    label: 'QUALIDADE - MANUFATURA',
    children: emDesenvolvimento,
  },
  {
    key: 'sqd',
    icon: <SafetyCertificateOutlined />,
    label: 'QUALIDADE - SQD',
    children: emDesenvolvimento,
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();

  const selecionado =
    location.pathname === '/'
      ? '/'
      : '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0" width={230}>
        <div
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
          }}
        >
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 28, objectFit: 'contain' }}
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selecionado]}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
          items={itensMenu}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 15 }}>
            Big Dutchman Brasil — Sistema de Qualidade
          </Typography.Text>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Sair',
                  onClick: () => {
                    logout();
                    navigate('/login');
                  },
                },
              ],
            }}
          >
            <span style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              {usuario?.nome}{' '}
              <Typography.Text type="secondary">({usuario?.papel})</Typography.Text>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
