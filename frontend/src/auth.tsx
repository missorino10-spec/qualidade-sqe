import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import type { Acesso, Modulo } from './permissoes';
import { MODULOS, ROTA_INICIAL } from './permissoes';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
  precisaTrocarSenha?: boolean;
  acessos?: Acesso[];
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  /** Recarrega os dados do servidor (acessos mudam sem novo login). */
  recarregar: () => Promise<void>;
  podeVer: (modulo: Modulo) => boolean;
  podeEditar: (modulo: Modulo) => boolean;
  /** Primeira tela que a pessoa tem direito de ver. */
  rotaInicial: () => string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  });

  function guardar(u: Usuario) {
    localStorage.setItem('usuario', JSON.stringify(u));
    setUsuario(u);
  }

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.access_token);
    guardar(data.usuario);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  async function recarregar() {
    if (!localStorage.getItem('token')) return;
    try {
      const { data } = await api.get('/auth/me');
      guardar(data);
    } catch {
      // Token vencido ou colaborador inativado: cai para o login.
      logout();
    }
  }

  // Ao abrir o sistema, confere no servidor: o admin pode ter mudado o acesso
  // desde o ultimo login e o menu precisa refletir isso.
  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O admin enxerga tudo, sem precisar de linha de acesso.
  const nivel = (modulo: Modulo) =>
    usuario?.acessos?.find((a) => a.modulo === modulo)?.nivel;

  const podeVer = (modulo: Modulo) =>
    usuario?.papel === 'ADMIN' || !!nivel(modulo);

  const podeEditar = (modulo: Modulo) =>
    usuario?.papel === 'ADMIN' || nivel(modulo) === 'EDITAR';

  const rotaInicial = () => {
    if (usuario?.papel === 'ADMIN') return '/';
    const primeiro = MODULOS.find((m) => podeVer(m));
    // Sem nenhum acesso a pessoa ainda entra, e a tela avisa o que fazer.
    return primeiro ? ROTA_INICIAL[primeiro] : '/sem-acesso';
  };

  return (
    <AuthContext.Provider
      value={{ usuario, login, logout, recarregar, podeVer, podeEditar, rotaInicial }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
