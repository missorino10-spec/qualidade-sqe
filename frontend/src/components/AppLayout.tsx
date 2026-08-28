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
  SettingOutlined,
  DollarOutlined,
  FileProtectOutlined,
  ClusterOutlined,
  LineChartOutlined,
  NotificationOutlined,
  BarcodeOutlined,
  ColumnWidthOutlined,
  DatabaseOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Modulo } from '../permissoes';

const { Header, Sider, Content } = Layout;

type ItemMenu = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Submenu que depende de acesso proprio (so os Cadastros). */
  modulo?: Modulo;
};

// O menu e a lista completa; o que cada pessoa ve sai do filtro la embaixo.
// SQE, MANUFATURA e SQD sao modulo inteiro; CADASTROS aparece com os submenus
// que o admin liberou, e some se nao liberou nenhum.
const itensMenu: {
  key: string;
  icon: ReactNode;
  label: string;
  modulo?: Modulo;
  somenteAdmin?: boolean;
  children: ItemMenu[];
}[] = [
  {
    key: 'sqe',
    icon: <ExperimentOutlined />,
    label: 'QUALIDADE - SQE',
    modulo: 'SQE',
    children: [
      { key: '/', icon: <DashboardOutlined />, label: 'Painel' },
      {
        key: '/registros-entrada',
        icon: <InboxOutlined />,
        label: 'Registro de Entrada',
      },
      { key: '/inspecoes', icon: <AuditOutlined />, label: 'Inspeções' },
      { key: '/rnc', icon: <WarningOutlined />, label: 'RNC' },
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
    modulo: 'MANUFATURA',
    children: [
      { key: '/manufatura', icon: <DashboardOutlined />, label: 'Painel' },
      {
        key: '/manufatura/inspecoes/setup',
        icon: <SettingOutlined />,
        label: 'Inspeção de Setup',
      },
      {
        key: '/manufatura/inspecoes/producao',
        icon: <AuditOutlined />,
        label: 'Inspeção de Produção',
      },
      {
        key: '/manufatura/controle-autonomo',
        icon: <CheckSquareOutlined />,
        label: 'Controle Autônomo',
      },
      { key: '/manufatura/cnq', icon: <DollarOutlined />, label: 'CNQ' },
      { key: '/manufatura/8d', icon: <FileProtectOutlined />, label: '8D / 5G' },
      {
        key: '/manufatura/alertas',
        icon: <NotificationOutlined />,
        label: 'Alerta da Qualidade',
      },
      {
        key: '/manufatura/producao',
        icon: <LineChartOutlined />,
        label: 'Produção Diária / PPM',
      },
    ],
  },
  {
    key: 'sqd',
    icon: <SafetyCertificateOutlined />,
    label: 'QUALIDADE - SQD',
    modulo: 'SQD',
    children: [
      { key: '/sqd', icon: <DashboardOutlined />, label: 'Painel' },
      {
        key: '/sqd/homologacoes',
        icon: <SafetyCertificateOutlined />,
        label: 'Homologação de Fornecedores',
      },
      {
        key: '/sqd/homologacoes-itens',
        icon: <FileProtectOutlined />,
        label: 'Homologação de Itens',
      },
      {
        key: '/sqd/auditorias',
        icon: <AuditOutlined />,
        label: 'Auditoria de Fornecedores',
      },
    ],
  },
  {
    key: 'cadastros',
    icon: <DatabaseOutlined />,
    label: 'CADASTROS',
    children: [
      {
        key: '/fornecedores',
        icon: <ShopOutlined />,
        label: 'Fornecedores',
        modulo: 'CAD_FORNECEDORES',
      },
      {
        key: '/itens',
        icon: <BarcodeOutlined />,
        label: 'Itens',
        modulo: 'CAD_ITENS',
      },
      {
        key: '/manufatura/maquinas',
        icon: <ClusterOutlined />,
        label: 'Máquinas',
        modulo: 'CAD_MAQUINAS',
      },
      {
        key: '/instrumentos/inventario',
        icon: <ColumnWidthOutlined />,
        label: 'Instrumentos',
        modulo: 'CAD_INSTRUMENTOS',
      },
    ],
  },
  {
    key: 'administracao',
    icon: <TeamOutlined />,
    label: 'ADMINISTRAÇÃO',
    somenteAdmin: true,
    children: [
      {
        key: '/admin/colaboradores',
        icon: <UserOutlined />,
        label: 'Colaboradores e Acessos',
      },
    ],
  },
];

// Todas as rotas do menu, da mais especifica para a mais generica: o item
// selecionado e o primeiro prefixo que casa com a URL atual.
const rotasMenu = itensMenu
  .flatMap((g) => g.children ?? [])
  .map((c) => c.key)
  .filter((k) => k.startsWith('/'))
  .sort((a, b) => b.length - a.length);

// Telas que nao tem item proprio no menu e devem acender o item de outra rota.
// O 5G e um documento a parte, mas mora no mesmo submenu "8D / 5G".
const ALIAS_MENU: Record<string, string> = {
  '/manufatura/5g': '/manufatura/8d',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout, podeVer } = useAuth();

  // Cada um so ve o que o admin liberou. O grupo some quando fica sem filhos:
  // e o caso de CADASTROS para quem nao recebeu nenhum submenu.
  const menuVisivel = itensMenu
    .filter((g) => (g.somenteAdmin ? usuario?.papel === 'ADMIN' : true))
    .filter((g) => (g.modulo ? podeVer(g.modulo) : true))
    .map((g) => ({
      key: g.key,
      icon: g.icon,
      label: g.label,
      children: g.children
        .filter((c) => !c.modulo || podeVer(c.modulo))
        .map(({ modulo: _m, ...c }) => c),
    }))
    .filter((g) => g.children.length > 0);

  const alias = Object.keys(ALIAS_MENU).find(
    (r) => location.pathname === r || location.pathname.startsWith(`${r}/`),
  );

  const selecionado = alias
    ? ALIAS_MENU[alias]
    : location.pathname === '/'
      ? '/'
      : (rotasMenu.find(
          (r) =>
            r !== '/' &&
            (location.pathname === r || location.pathname.startsWith(`${r}/`)),
        ) ?? '/' + location.pathname.split('/')[1]);

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
          items={menuVisivel}
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
