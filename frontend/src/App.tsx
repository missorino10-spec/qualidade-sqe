import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Result } from 'antd';
import { useAuth } from './auth';
import type { Modulo } from './permissoes';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fornecedores from './pages/Fornecedores';
import Itens from './pages/Itens';
import RegistrosEntrada from './pages/RegistrosEntrada';
import Inspecoes from './pages/Inspecoes';
import InspecaoDetalhe from './pages/InspecaoDetalhe';
import RncLista from './pages/RncLista';
import RncDetalhe from './pages/RncDetalhe';
import Periodicidade from './pages/Periodicidade';
import PainelManufatura from './pages/manufatura/PainelManufatura';
import InspecoesManufatura from './pages/manufatura/InspecoesManufatura';
import InspecaoManufaturaDetalhe from './pages/manufatura/InspecaoManufaturaDetalhe';
import InspecaoVisualDetalhe from './pages/manufatura/InspecaoVisualDetalhe';
import Cnq from './pages/manufatura/Cnq';
import ControleAutonomo from './pages/manufatura/ControleAutonomo';
import ControleAutonomoDetalhe from './pages/manufatura/ControleAutonomoDetalhe';
import OitoD from './pages/manufatura/OitoD';
import OitoDDetalhe from './pages/manufatura/OitoDDetalhe';
import CincoGDetalhe from './pages/manufatura/CincoGDetalhe';
import Alertas from './pages/manufatura/Alertas';
import Maquinas from './pages/manufatura/Maquinas';
import ProducaoDiaria from './pages/manufatura/ProducaoDiaria';
import PainelSqd from './pages/sqd/PainelSqd';
import Homologacoes from './pages/sqd/Homologacoes';
import HomologacaoDetalhe from './pages/sqd/HomologacaoDetalhe';
import HomologacoesItens from './pages/sqd/HomologacoesItens';
import HomologacaoItemDetalhe from './pages/sqd/HomologacaoItemDetalhe';
import Auditorias from './pages/sqd/Auditorias';
import AuditoriaDetalhe from './pages/sqd/AuditoriaDetalhe';
import Reclamacoes from './pages/ro/Reclamacoes';
import ReclamacaoDetalhe from './pages/ro/ReclamacaoDetalhe';
import Instrumentos from './pages/Instrumentos';
import Colaboradores from './pages/admin/Colaboradores';
import Feriados from './pages/admin/Feriados';
import TrocarSenha from './pages/TrocarSenha';

function SemAcesso() {
  return (
    <Result
      status="403"
      title="Sem acesso"
      subTitle="Você não tem permissão para esta área. Fale com o administrador do sistema."
    />
  );
}

/**
 * Alem de exigir login, confere o acesso ao modulo da tela. Esconder o menu
 * nao basta: alguem pode digitar a URL. O bloqueio de verdade e no servidor,
 * isto aqui e para a pessoa nao cair numa tela quebrada.
 */
function Privado({
  children,
  modulo,
  admin,
}: {
  children: JSX.Element;
  modulo?: Modulo;
  admin?: boolean;
}) {
  const { usuario, podeVer, rotaInicial } = useAuth();
  const location = useLocation();

  if (!usuario) return <Navigate to="/login" replace />;
  // Senha provisoria: so sai daqui depois de definir a definitiva.
  if (usuario.precisaTrocarSenha) return <Navigate to="/trocar-senha" replace />;

  const negado = admin ? usuario.papel !== 'ADMIN' : modulo && !podeVer(modulo);
  if (negado) {
    const destino = rotaInicial();
    if (destino !== location.pathname) return <Navigate to={destino} replace />;
    return (
      <AppLayout>
        <SemAcesso />
      </AppLayout>
    );
  }
  return <AppLayout>{children}</AppLayout>;
}

// Depois de entrar, cada um cai na primeira tela que tem direito de ver.
function Inicio() {
  const { usuario, rotaInicial } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={rotaInicial()} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privado modulo="SQE"><Dashboard /></Privado>} />
      <Route path="/periodicidade" element={<Privado modulo="SQE"><Periodicidade /></Privado>} />
      <Route path="/fornecedores" element={<Privado modulo="CAD_FORNECEDORES"><Fornecedores /></Privado>} />
      <Route path="/itens" element={<Privado modulo="CAD_ITENS"><Itens /></Privado>} />
      <Route path="/registros-entrada" element={<Privado modulo="SQE"><RegistrosEntrada /></Privado>} />
      <Route path="/inspecoes" element={<Privado modulo="SQE"><Inspecoes /></Privado>} />
      <Route path="/inspecoes/:id" element={<Privado modulo="SQE"><InspecaoDetalhe /></Privado>} />
      <Route path="/rnc" element={<Privado modulo="SQE"><RncLista /></Privado>} />
      <Route path="/rnc/:id" element={<Privado modulo="SQE"><RncDetalhe /></Privado>} />

      {/* Qualidade da Manufatura */}
      <Route path="/manufatura" element={<Privado modulo="MANUFATURA"><PainelManufatura /></Privado>} />
      <Route
        path="/manufatura/inspecoes/setup"
        element={<Privado modulo="MANUFATURA"><InspecoesManufatura tipo="SETUP" /></Privado>}
      />
      <Route
        path="/manufatura/inspecoes/producao"
        element={<Privado modulo="MANUFATURA"><InspecoesManufatura tipo="PRODUCAO" /></Privado>}
      />
      {/* Antes de ":id" porque "inspecoes-visuais" nao e um id. */}
      <Route
        path="/manufatura/inspecoes-visuais/:id"
        element={<Privado modulo="MANUFATURA"><InspecaoVisualDetalhe /></Privado>}
      />
      <Route
        path="/manufatura/inspecoes/:id"
        element={<Privado modulo="MANUFATURA"><InspecaoManufaturaDetalhe /></Privado>}
      />
      <Route
        path="/manufatura/controle-autonomo"
        element={<Privado modulo="MANUFATURA"><ControleAutonomo /></Privado>}
      />
      {/* ":id" tambem aceita "nova": e a mesma tela, em branco. */}
      <Route
        path="/manufatura/controle-autonomo/:id"
        element={<Privado modulo="MANUFATURA"><ControleAutonomoDetalhe /></Privado>}
      />
      <Route path="/manufatura/cnq" element={<Privado modulo="MANUFATURA"><Cnq /></Privado>} />
      <Route path="/manufatura/8d" element={<Privado modulo="MANUFATURA"><OitoD /></Privado>} />
      <Route path="/manufatura/8d/:id" element={<Privado modulo="MANUFATURA"><OitoDDetalhe /></Privado>} />
      <Route path="/manufatura/5g/:id" element={<Privado modulo="MANUFATURA"><CincoGDetalhe /></Privado>} />
      <Route path="/manufatura/alertas" element={<Privado modulo="MANUFATURA"><Alertas /></Privado>} />
      <Route path="/manufatura/maquinas" element={<Privado modulo="CAD_MAQUINAS"><Maquinas /></Privado>} />
      <Route path="/manufatura/producao" element={<Privado modulo="MANUFATURA"><ProducaoDiaria /></Privado>} />

      {/* SQD - Desenvolvimento de Fornecedores */}
      <Route path="/sqd" element={<Privado modulo="SQD"><PainelSqd /></Privado>} />
      <Route path="/sqd/homologacoes" element={<Privado modulo="SQD"><Homologacoes /></Privado>} />
      <Route
        path="/sqd/homologacoes/:id"
        element={<Privado modulo="SQD"><HomologacaoDetalhe /></Privado>}
      />
      <Route
        path="/sqd/homologacoes-itens"
        element={<Privado modulo="SQD"><HomologacoesItens /></Privado>}
      />
      <Route
        path="/sqd/homologacoes-itens/:id"
        element={<Privado modulo="SQD"><HomologacaoItemDetalhe /></Privado>}
      />
      <Route path="/sqd/auditorias" element={<Privado modulo="SQD"><Auditorias /></Privado>} />
      <Route
        path="/sqd/auditorias/:id"
        element={<Privado modulo="SQD"><AuditoriaDetalhe /></Privado>}
      />

      {/* R.O - Gestao de Reclamacoes da Qualidade */}
      <Route path="/ro" element={<Privado modulo="RO"><Reclamacoes /></Privado>} />
      {/* ":id" tambem aceita "novo": e a mesma tela, em branco. */}
      <Route path="/ro/:id" element={<Privado modulo="RO"><ReclamacaoDetalhe /></Privado>} />

      {/* Instrumentos - BDBR.QUA.FMR.004.01 */}
      <Route
        path="/instrumentos/inventario"
        element={<Privado modulo="CAD_INSTRUMENTOS"><Instrumentos /></Privado>}
      />

      {/* Administracao - so o admin */}
      <Route
        path="/admin/colaboradores"
        element={<Privado admin><Colaboradores /></Privado>}
      />
      {/* O calendario nao e de modulo nenhum: ele conta os prazos da casa
          inteira, entao fica com o admin, junto de Colaboradores. */}
      <Route
        path="/admin/feriados"
        element={<Privado admin><Feriados /></Privado>}
      />

      <Route path="/trocar-senha" element={<TrocarSenha />} />
      <Route
        path="/sem-acesso"
        element={<Privado><SemAcesso /></Privado>}
      />

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}
