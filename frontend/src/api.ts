import axios from 'axios';

// O nginx (producao) e o proxy do Vite (dev) encaminham /api para o backend
export const api = axios.create({
  baseURL: '/api',
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
