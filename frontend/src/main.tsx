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

dayjs.locale('pt-br');

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: {
          colorPrimary: '#D37119',
          colorInfo: '#D37119',
          colorLink: '#B85F12',
          borderRadius: 6,
          fontFamily:
            "'Inter', 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Layout: {
            siderBg: '#2B2622',
            triggerBg: '#1F1B18',
            headerBg: '#ffffff',
          },
          Menu: {
            darkItemBg: '#2B2622',
            darkSubMenuItemBg: '#221E1B',
            darkItemSelectedBg: '#D37119',
            darkItemHoverBg: '#3A332D',
          },
        },
      }}
    >
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
