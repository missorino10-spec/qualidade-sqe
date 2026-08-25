import { Alert } from 'antd';
import { useAuth } from '../auth';

/**
 * "Elaborado por" e "Inspecionado por" deixaram de ser digitados: quem assina
 * o documento e quem esta logado, e o servidor grava isso sozinho.
 *
 * Antes o campo vinha em branco na maioria dos relatorios (ninguem preenchia)
 * ou trazia o nome de outra pessoa, o que tirava o valor da assinatura.
 *
 * O aviso fica na tela so para o inspetor saber com que nome o documento vai
 * sair impresso - nao ha nada para preencher aqui.
 */
export default function AssinaturaDoLogin({
  rotulo = 'Elaborado e inspecionado por',
}: {
  rotulo?: string;
}) {
  const { usuario } = useAuth();
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message={`${rotulo}: ${usuario?.nome ?? '-'}`}
      description="O documento é assinado automaticamente com o usuário conectado."
    />
  );
}
