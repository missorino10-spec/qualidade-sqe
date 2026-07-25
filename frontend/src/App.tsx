import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fornecedores from './pages/Fornecedores';
import Inspecoes from './pages/Inspecoes';
import RncLista from './pages/RncLista';
import RncDetalhe from './pages/RncDetalhe';
import Periodicidade from './pages/Periodicidade';

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
      <Route path="/rnc" element={<Privado><RncLista /></Privado>} />
      <Route path="/rnc/:id" element={<Privado><RncDetalhe /></Privado>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
