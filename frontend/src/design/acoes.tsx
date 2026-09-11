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
import { useState, type ReactNode } from 'react';
import { Button, message, Modal, Space, Tooltip } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { abrirPdfEmNovaAba, baixarArquivo } from '../api';

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

export function BotaoExcel({
  onClick,
  texto = 'Exportar Excel',
  carregando,
}: {
  onClick: () => void;
  texto?: string;
  carregando?: boolean;
}) {
  return (
    <Button loading={carregando} icon={<FileExcelOutlined />} onClick={onClick}>
      {texto}
    </Button>
  );
}

// Par de botoes das telas de lista. Os dois batem no MESMO endpoint, com a
// mesma query do filtro da tela: o que muda e so "formato". O PDF abre em aba
// (e papel, para olhar e assinar); o Excel baixa (e para continuar a conta).
export function ExportarLista({
  url,
  nome,
  desabilitado,
}: {
  /** Rota do relatorio ja com a query do filtro, ex. "/rnc/relatorio?de=..." */
  url: string;
  /** Nome do arquivo, sem extensao, caso o servidor nao mande o dele. */
  nome: string;
  desabilitado?: boolean;
}) {
  const [baixando, setBaixando] = useState<'pdf' | 'excel' | null>(null);

  async function exportar(formato: 'pdf' | 'excel') {
    setBaixando(formato);
    try {
      const separador = url.includes('?') ? '&' : '?';
      const destino = `${url}${separador}formato=${formato}`;
      if (formato === 'pdf') await abrirPdfEmNovaAba(destino);
      else await baixarArquivo(destino, `${nome}.xlsx`);
    } catch {
      message.error('Não foi possível gerar o arquivo.');
    } finally {
      setBaixando(null);
    }
  }

  if (desabilitado) return null;
  return (
    <Space wrap>
      <BotaoPdf
        carregando={baixando === 'pdf'}
        onClick={() => exportar('pdf')}
      />
      <BotaoExcel
        carregando={baixando === 'excel'}
        onClick={() => exportar('excel')}
      />
    </Space>
  );
}
