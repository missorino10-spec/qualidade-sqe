import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fornecedores from './pages/Fornecedores';
import Inspecoes from './pages/Inspecoes';
import InspecaoDetalhe from './pages/InspecaoDetalhe';
import RncLista from './pages/RncLista';
import RncDetalhe from './pages/RncDetalhe';
import Periodicidade from './pages/Periodicidade';
import PainelManufatura from './pages/manufatura/PainelManufatura';
import InspecoesManufatura from './pages/manufatura/InspecoesManufatura';
import InspecaoManufaturaDetalhe from './pages/manufatura/InspecaoManufaturaDetalhe';
import Cnq from './pages/manufatura/Cnq';
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

function Privado({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privado><Dashboard /></Privado>} />
      <Route path="/periodicidade" element={<Privado><Periodicidade /></Privado>} />
      <Route path="/fornecedores" element={<Privado><Fornecedores /></Privado>} />
      <Route path="/inspecoes" element={<Privado><Inspecoes /></Privado>} />
      <Route path="/inspecoes/:id" element={<Privado><InspecaoDetalhe /></Privado>} />
      <Route path="/rnc" element={<Privado><RncLista /></Privado>} />
      <Route path="/rnc/:id" element={<Privado><RncDetalhe /></Privado>} />

      {/* Qualidade da Manufatura */}
      <Route path="/manufatura" element={<Privado><PainelManufatura /></Privado>} />
      <Route
        path="/manufatura/inspecoes/setup"
        element={<Privado><InspecoesManufatura tipo="SETUP" /></Privado>}
      />
      <Route
        path="/manufatura/inspecoes/producao"
        element={<Privado><InspecoesManufatura tipo="PRODUCAO" /></Privado>}
      />
      <Route
        path="/manufatura/inspecoes/:id"
        element={<Privado><InspecaoManufaturaDetalhe /></Privado>}
      />
      <Route path="/manufatura/cnq" element={<Privado><Cnq /></Privado>} />
      <Route path="/manufatura/8d" element={<Privado><OitoD /></Privado>} />
      <Route path="/manufatura/8d/:id" element={<Privado><OitoDDetalhe /></Privado>} />
      <Route path="/manufatura/5g/:id" element={<Privado><CincoGDetalhe /></Privado>} />
      <Route path="/manufatura/alertas" element={<Privado><Alertas /></Privado>} />
      <Route path="/manufatura/maquinas" element={<Privado><Maquinas /></Privado>} />
      <Route path="/manufatura/producao" element={<Privado><ProducaoDiaria /></Privado>} />

      {/* SQD - Desenvolvimento de Fornecedores */}
      <Route path="/sqd" element={<Privado><PainelSqd /></Privado>} />
      <Route path="/sqd/homologacoes" element={<Privado><Homologacoes /></Privado>} />
      <Route
        path="/sqd/homologacoes/:id"
        element={<Privado><HomologacaoDetalhe /></Privado>}
      />
      <Route
        path="/sqd/homologacoes-itens"
        element={<Privado><HomologacoesItens /></Privado>}
      />
      <Route
        path="/sqd/homologacoes-itens/:id"
        element={<Privado><HomologacaoItemDetalhe /></Privado>}
      />
      <Route path="/sqd/auditorias" element={<Privado><Auditorias /></Privado>} />
      <Route
        path="/sqd/auditorias/:id"
        element={<Privado><AuditoriaDetalhe /></Privado>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
