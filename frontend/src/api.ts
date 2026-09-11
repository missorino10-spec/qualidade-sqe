import axios from 'axios';
import { message } from 'antd';

// Sem VITE_API_URL, usa o caminho relativo /api: e o caso do nginx (producao
// on-premise) e do proxy do Vite (dev), onde front e back sao o mesmo host.
// Na nuvem o frontend e um site estatico em outro dominio, entao a URL
// completa do backend chega pela variavel no momento do build.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    // Quem tem acesso so de visualizacao ainda enxerga alguns botoes. O bloqueio
    // real e do servidor; aqui a pessoa fica sabendo por que nao salvou.
    if (err.response?.status === 403) {
      message.warning(
        err.response?.data?.message ??
          'Você não tem permissão para esta ação. Fale com o administrador.',
      );
    }
    return Promise.reject(err);
  },
);

// Baixa um arquivo protegido por JWT como blob e devolve uma object-URL.
// Necessario porque href/img src nativos do browser nao enviam o token,
// resultando em 401 nos endpoints /rnc/:id/pdf e /anexos/:id/download.
export async function baixarBlobUrl(url: string): Promise<string> {
  const resp = await api.get(url, { responseType: 'blob' });
  return URL.createObjectURL(resp.data);
}

// Abre o PDF (via blob) em nova aba, contornando o 401.
export async function abrirPdfEmNovaAba(url: string): Promise<void> {
  const objectUrl = await baixarBlobUrl(url);
  window.open(objectUrl, '_blank');
}

// Planilha nao abre em aba: tem que baixar. O nome do arquivo vem do servidor
// (Content-Disposition); sem ele o navegador salva com o nome da rota.
export async function baixarArquivo(url: string, nomePadrao: string) {
  const resp = await api.get(url, { responseType: 'blob' });
  const disposicao = String(resp.headers['content-disposition'] ?? '');
  const nome = /filename="?([^";]+)"?/.exec(disposicao)?.[1] ?? nomePadrao;
  const objectUrl = URL.createObjectURL(resp.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// Monta a query string ignorando filtro vazio: "?de=&ate=" faria o servidor
// receber string vazia em vez de "sem filtro".
export function queryDeFiltro(filtro: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(chave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}
