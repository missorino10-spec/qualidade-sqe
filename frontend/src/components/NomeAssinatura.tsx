import { Tooltip } from 'antd';
import { nomeCurto } from '../formatos';

/**
 * Nome de quem assinou o documento, na tela.
 *
 * Sai curto (primeiro nome + sobrenome), igual ao que o PDF imprime - nome
 * completo estica a celula e desalinha a coluna do lado. O nome inteiro fica
 * no tooltip, porque quem confere o documento precisa poder identificar a
 * pessoa sem ambiguidade.
 */
export default function NomeAssinatura({
  nome,
  vazio = '-',
}: {
  nome?: string | null;
  vazio?: string;
}) {
  const curto = nomeCurto(nome);
  if (!curto) return <>{vazio}</>;
  if (curto === nome) return <>{curto}</>;
  // O Tooltip precisa de um elemento para se ancorar: com texto solto como
  // filho ele nao abre.
  return (
    <Tooltip title={nome}>
      <span>{curto}</span>
    </Tooltip>
  );
}
