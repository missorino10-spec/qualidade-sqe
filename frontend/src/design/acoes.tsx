// Acoes de registro — excluir, editar e exportar PDF.
//
// Estas tres acoes aparecem em quase toda tela do sistema e cada uma tinha
// nascido do seu jeito: excluir ora era Popconfirm ora Modal.confirm, ora dizia
// "Excluir" ora "Remover"; editar ora era icone ora texto; o PDF aparecia no
// canto do cartao numa tela e no meio do filtro na outra.
//
// Aqui elas viram UM componente. O ganho nao e visual: e que o usuario aprende
// o gesto uma vez. Vermelho com confirmacao sempre apaga; o lapis sempre
// corrige o que ja existe; o PDF fica sempre no mesmo canto.
import type { ReactNode } from 'react';
import { Button, Modal, Tooltip } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';

// Exclusao de registro inteiro: sempre Modal.confirm, sempre com o nome do que
// vai sumir no titulo, sempre com o botao vermelho escrito "Excluir".
//
// O Popconfirm fica reservado para tirar UMA LINHA de dentro de um formulario
// aberto - ali nada foi gravado ainda e a pergunta pode ser leve. Registro
// gravado exige a pausa do modal.
export function confirmarExclusao(opts: {
  titulo: string;
  descricao?: ReactNode;
  onOk: () => void | Promise<unknown>;
}) {
  Modal.confirm({
    title: opts.titulo,
    content: opts.descricao,
    okText: 'Excluir',
    okButtonProps: { danger: true },
    cancelText: 'Cancelar',
    onOk: opts.onOk,
  });
}

type BotaoBase = {
  /** Dentro de tabela o botao e so o icone: a coluna de acoes nao pode crescer. */
  emTabela?: boolean;
  disabled?: boolean;
  /** Quando desabilitado, explica no tooltip o porque em vez de so apagar. */
  motivo?: string;
};

export function BotaoExcluir({
  titulo,
  descricao,
  onConfirm,
  texto = 'Excluir',
  emTabela,
  disabled,
  motivo,
}: BotaoBase & {
  titulo: string;
  descricao?: ReactNode;
  onConfirm: () => void | Promise<unknown>;
  texto?: string;
}) {
  const botao = (
    <Button
      danger
      size={emTabela ? 'small' : undefined}
      type={emTabela ? 'text' : 'default'}
      disabled={disabled}
      icon={<DeleteOutlined />}
      onClick={() => confirmarExclusao({ titulo, descricao, onOk: onConfirm })}
    >
      {emTabela ? undefined : texto}
    </Button>
  );
  // Tooltip em botao desabilitado precisa de um wrapper: o antd nao dispara o
  // hover no proprio botao quando ele esta inerte.
  if (!emTabela && !disabled) return botao;
  return (
    <Tooltip title={motivo ?? texto}>
      {disabled ? <span style={{ cursor: 'not-allowed' }}>{botao}</span> : botao}
    </Tooltip>
  );
}

// Lapis = corrigir o que ja existe. Preencher formulario em branco continua
// sendo outro gesto (o FormOutlined do SQD), e nao se mistura com este.
export function BotaoEditar({
  onClick,
  texto = 'Editar',
  emTabela,
  disabled,
  motivo,
}: BotaoBase & { onClick: () => void; texto?: string }) {
  const botao = (
    <Button
      size={emTabela ? 'small' : undefined}
      type={emTabela ? 'text' : 'default'}
      disabled={disabled}
      icon={<EditOutlined />}
      onClick={onClick}
    >
      {emTabela ? undefined : texto}
    </Button>
  );
  if (!emTabela && !disabled) return botao;
  return (
    <Tooltip title={motivo ?? texto}>
      {disabled ? <span style={{ cursor: 'not-allowed' }}>{botao}</span> : botao}
    </Tooltip>
  );
}

// PDF de tela vai nas acoes do cabecalho, escrito "Exportar PDF". PDF de linha
// (um por registro da lista) fica na coluna de acoes, so com o icone e o
// tooltip dizendo qual documento sai.
export function BotaoPdf({
  onClick,
  texto = 'Exportar PDF',
  emTabela,
  carregando,
}: {
  onClick: () => void;
  texto?: string;
  emTabela?: boolean;
  carregando?: boolean;
}) {
  if (emTabela)
    return (
      <Tooltip title={texto}>
        <Button
          size="small"
          type="text"
          loading={carregando}
          icon={<FilePdfOutlined />}
          onClick={onClick}
        />
      </Tooltip>
    );
  return (
    <Button loading={carregando} icon={<FilePdfOutlined />} onClick={onClick}>
      {texto}
    </Button>
  );
}
