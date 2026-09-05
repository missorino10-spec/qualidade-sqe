import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import 'antd/dist/reset.css';
import './estilos.css';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { AuthProvider } from './auth';
import App from './App';
import {
  BORDA,
  COR,
  ESPACO,
  MARCA,
  RAIO,
  SOMBRA,
  SUPERFICIE,
  TEXTO,
} from './design/tokens';

dayjs.locale('pt-br');

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// O tema e o Design System aplicado de uma vez so: em vez de estilizar cada
// uma das ~60 telas na mao, os tokens descem por aqui para todo componente do
// Ant Design. Mexer aqui muda o sistema inteiro de forma consistente.
const tema = {
  token: {
    colorPrimary: MARCA.laranja,
    colorInfo: MARCA.laranja,
    colorLink: MARCA.laranjaEscuro,
    colorLinkHover: MARCA.laranja,
    colorSuccess: COR.sucesso,
    colorWarning: COR.atencao,
    colorError: COR.critico,
    colorText: TEXTO.padrao,
    colorTextHeading: TEXTO.forte,
    colorTextSecondary: TEXTO.suave,
    colorTextDescription: TEXTO.suave,
    colorBorder: BORDA.padrao,
    colorBorderSecondary: BORDA.suave,
    colorBgLayout: SUPERFICIE.pagina,
    borderRadius: RAIO.md,
    borderRadiusLG: RAIO.lg,
    borderRadiusSM: RAIO.sm,
    // 13px de base: sistema corporativo precisa caber informacao na tela sem
    // virar letra miuda. Os titulos abaixo e que fazem a hierarquia.
    fontSize: 13,
    fontSizeHeading4: 18,
    fontSizeHeading5: 15,
    controlHeight: 32,
    lineHeight: 1.5715,
    boxShadow: SOMBRA.cartao,
    boxShadowSecondary: SOMBRA.elevada,
    fontFamily:
      "'Inter', 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Layout: {
      siderBg: MARCA.grafite,
      triggerBg: MARCA.grafiteFundo,
      headerBg: SUPERFICIE.cartao,
      headerHeight: 56,
      headerPadding: `0 ${ESPACO.xl}px`,
      bodyBg: SUPERFICIE.pagina,
    },
    Menu: {
      darkItemBg: MARCA.grafite,
      darkSubMenuItemBg: MARCA.grafiteFundo,
      darkItemSelectedBg: MARCA.laranja,
      darkItemHoverBg: MARCA.grafiteHover,
      // O grupo e um rotulo de secao, nao um item clicavel: fica menor e mais
      // apagado para o item de tela ganhar o primeiro plano.
      darkItemColor: 'rgba(255, 255, 255, 0.72)',
      darkItemSelectedColor: '#FFFFFF',
      itemHeight: 36,
      itemMarginInline: 8,
      itemBorderRadius: RAIO.md,
      subMenuItemBg: 'transparent',
    },
    Card: {
      headerBg: 'transparent',
      headerFontSize: 15,
      headerFontSizeSM: 14,
      // Respiro maior no cartao de conteudo e apertado no cartao pequeno, que
      // e o que empilha nos paineis.
      bodyPadding: ESPACO.xl - 4,
      bodyPaddingSM: ESPACO.md,
      headerHeight: 48,
      headerHeightSM: 38,
      paddingLG: ESPACO.xl - 4,
      boxShadowTertiary: SOMBRA.cartao,
    },
    Table: {
      headerBg: SUPERFICIE.sutil,
      headerColor: TEXTO.forte,
      headerSplitColor: BORDA.suave,
      borderColor: BORDA.suave,
      rowHoverBg: SUPERFICIE.realce,
      // Densidade: linha compacta o suficiente para caber muita informacao,
      // alta o bastante para o dedo acertar no tablet do chao de fabrica.
      cellPaddingBlockSM: 8,
      cellPaddingInlineSM: 10,
      headerBorderRadius: RAIO.md,
      footerBg: SUPERFICIE.sutil,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Input: { paddingBlockSM: 2 },
    Statistic: {
      // O valor do indicador e a informacao principal da tela: peso e tamanho
      // vem daqui para nao depender de style inline em cada cartao.
      contentFontSize: 26,
      titleFontSize: 13,
    },
    Descriptions: {
      labelBg: SUPERFICIE.sutil,
      titleMarginBottom: ESPACO.md,
      itemPaddingBottom: ESPACO.sm,
    },
    Tag: { defaultBg: SUPERFICIE.sutil, borderRadiusSM: RAIO.sm },
    Modal: { titleFontSize: 16, headerBg: SUPERFICIE.cartao },
    Form: { labelColor: TEXTO.padrao, itemMarginBottom: ESPACO.lg },
    Divider: { colorSplit: BORDA.padrao, textPaddingInline: ESPACO.md },
    Tabs: { horizontalItemPadding: `${ESPACO.md}px 0`, cardPadding: '8px 16px' },
    Tooltip: { borderRadius: RAIO.md },
    Segmented: { itemSelectedBg: MARCA.laranja, itemSelectedColor: '#FFFFFF' },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={ptBR} theme={tema}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
