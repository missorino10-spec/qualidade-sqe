import { ReactNode } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
  ShopOutlined,
  AuditOutlined,
  WarningOutlined,
  LogoutOutlined,
  LockOutlined,
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
  SolutionOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Modulo } from '../permissoes';
import {
  BORDA,
  ESPACO,
  MARCA,
  RAIO,
  SOMBRA,
  SUPERFICIE,
  TEXTO,
} from '../design/tokens';

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
// SQE, MANUFATURA, SQD e R.O sao modulo inteiro; CADASTROS aparece com os
// submenus que o admin liberou, e some se nao liberou nenhum.
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
    label: 'Qualidade — SQE',
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
        key: '/avaliacao-fornecedores',
        icon: <LineChartOutlined />,
        label: 'Avaliação de Fornecedores',
      },
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
    label: 'Qualidade — Manufatura',
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
    label: 'Qualidade — SQD',
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
    key: 'ro',
    icon: <SolutionOutlined />,
    label: 'Qualidade — R.O',
    modulo: 'RO',
    children: [
      {
        key: '/ro',
        icon: <SolutionOutlined />,
        label: 'Reclamações (R.O)',
      },
    ],
  },
  {
    key: 'cadastros',
    icon: <DatabaseOutlined />,
    label: 'Cadastros',
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
    label: 'Administração',
    somenteAdmin: true,
    children: [
      {
        key: '/admin/colaboradores',
        icon: <UserOutlined />,
        label: 'Colaboradores e Acessos',
      },
      {
        key: '/admin/feriados',
        icon: <CalendarOutlined />,
        label: 'Calendário de Feriados',
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

  // Onde o usuario esta, em texto: modulo + tela. Sai da MESMA lista que monta
  // o menu, entao nunca diverge dele. E so leitura da rota atual - nao cria
  // rota nem navegacao nova.
  const grupoAtual = itensMenu.find((g) =>
    g.children.some((c) => c.key === selecionado),
  );
  const telaAtual = grupoAtual?.children.find((c) => c.key === selecionado);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        breakpoint="lg"
        collapsedWidth="0"
        width={240}
        style={{ borderRight: `1px solid ${MARCA.grafiteFundo}` }}
      >
        {/* A marca fica numa faixa propria, separada do menu por uma linha:
            sem isso o logo parecia mais um item da lista. */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${ESPACO.lg}px`,
            borderBottom: `1px solid ${MARCA.grafiteHover}`,
            marginBottom: ESPACO.sm,
          }}
        >
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 26, objectFit: 'contain' }}
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
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: SUPERFICIE.cartao,
            padding: `0 ${ESPACO.xl}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: ESPACO.lg,
            borderBottom: `1px solid ${BORDA.padrao}`,
            boxShadow: SOMBRA.cabecalho,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Modulo em cima, tela embaixo: dois niveis de peso resolvem o
              "onde estou" sem gastar uma faixa inteira de breadcrumb. */}
          <div style={{ minWidth: 0, lineHeight: 1.25 }}>
            <Typography.Text
              type="secondary"
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {grupoAtual?.label ?? 'Big Dutchman Brasil'}
            </Typography.Text>
            <Typography.Text
              strong
              style={{
                fontSize: 15,
                color: TEXTO.forte,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {telaAtual?.label ?? 'Sistema de Qualidade'}
            </Typography.Text>
          </div>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                // A tela de trocar senha ja existia, mas so aparecia sozinha
                // para quem estava com senha provisoria. Quem quisesse trocar
                // a sua depois nao tinha por onde: dependia de pedir um reset
                // ao administrador. E o administrador, que nao tem a quem
                // pedir, ficava sem saida - justamente ele, que no servidor da
                // fabrica recebe uma senha sorteada na instalacao e precisa
                // troca-la por uma dele no primeiro dia.
                {
                  key: 'senha',
                  icon: <LockOutlined />,
                  label: 'Trocar minha senha',
                  onClick: () => navigate('/trocar-senha'),
                },
                { type: 'divider' },
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
            <span
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: ESPACO.sm,
                padding: `${ESPACO.xs}px ${ESPACO.sm}px`,
                borderRadius: RAIO.md,
                whiteSpace: 'nowrap',
              }}
            >
              <Avatar
                size={28}
                icon={<UserOutlined />}
                style={{ background: MARCA.laranja, flex: 'none' }}
              />
              <span style={{ lineHeight: 1.25, textAlign: 'right' }}>
                <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>
                  {usuario?.nome}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {usuario?.papel}
                </Typography.Text>
              </span>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: ESPACO.xl, marginBottom: ESPACO.xxl }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
