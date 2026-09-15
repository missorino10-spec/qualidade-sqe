import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  CloudUploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, baixarArquivo } from '../api';

// ---------------------------------------------------------------------------
// Importacao de cadastro por planilha, igual nas cinco telas.
//
// O caminho tem tres paradas e nenhuma delas grava sozinha:
//
//   1. BAIXAR  - a planilha ja vem preenchida com o cadastro de hoje;
//   2. CONFERIR- o sistema diz quantas entram, quantas mudam, quantas foram
//                recusadas e por que, ANTES de tocar no banco;
//   3. GRAVAR  - so depois da confirmacao.
//
// O arquivo e enviado de novo no passo 3 de proposito: assim nao existe
// "confirmei uma previa que ja nao valia mais".
// ---------------------------------------------------------------------------

type Linha = {
  linha: number;
  chave: string;
  resumo: string;
  motivo?: string;
  mudancas?: string[];
};

type Previa = {
  titulo: string;
  rotuloChave: string;
  podeInativar: boolean;
  colunasIgnoradas: string[];
  colunasAusentes: string[];
  novas: Linha[];
  atualizam: Linha[];
  iguais: number;
  recusadas: Linha[];
  inativar: { chave: string; resumo: string }[];
};

type Resultado = {
  criadas: number;
  atualizadas: number;
  inativadas: number;
  iguais: number;
  recusadas: Linha[];
  falhas: { linha: number; chave: string; motivo: string }[];
  senhas: { nome: string; email: string; senha: string }[];
};

type CadastroDisponivel = {
  chave: string;
  titulo: string;
  podeInativar: boolean;
};

export default function ImportarPlanilha({
  cadastro,
  aoConcluir,
}: {
  /** Chave do cadastro no backend: fornecedores, itens, maquinas... */
  cadastro: string;
  /** Chamado depois de gravar, para a tela recarregar a lista. */
  aoConcluir?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [listaCompleta, setListaCompleta] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Importar mexe no cadastro inteiro de uma vez: o backend so libera para o
  // ADMIN ou para quem edita todos os modulos. Quem nao pode nem ve o botao.
  const { data: permissao } = useQuery<{ cadastros: CadastroDisponivel[] }>({
    queryKey: ['importacao', 'disponiveis'],
    queryFn: async () => (await api.get('/importacao')).data,
    staleTime: 5 * 60 * 1000,
  });
  const meu = permissao?.cadastros?.find((c) => c.chave === cadastro);
  if (!meu) return null;
  const titulo = meu.titulo;

  function limpar() {
    setArquivo(null);
    setPrevia(null);
    setResultado(null);
    setListaCompleta(false);
  }

  function fechar() {
    setAberto(false);
    limpar();
  }

  async function baixarModelo() {
    setOcupado(true);
    try {
      await baixarArquivo(
        `/importacao/${cadastro}/modelo`,
        `cadastro-${cadastro}.xlsx`,
      );
    } catch {
      message.error('Não foi possível baixar a planilha.');
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(rota: 'previa' | 'aplicar') {
    if (!arquivo) return;
    const corpo = new FormData();
    corpo.append('arquivo', arquivo);
    corpo.append('listaCompleta', String(listaCompleta));
    setOcupado(true);
    try {
      const { data } = await api.post(
        `/importacao/${cadastro}/${rota}`,
        corpo,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (rota === 'previa') setPrevia(data);
      else {
        setResultado(data);
        setPrevia(null);
        aoConcluir?.();
      }
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível ler a planilha.',
      );
    } finally {
      setOcupado(false);
    }
  }

  const colunasLinha = [
    { title: 'Linha', dataIndex: 'linha', width: 70 },
    { title: previa?.rotuloChave ?? 'Código', dataIndex: 'chave', width: 180 },
    { title: 'Descrição', dataIndex: 'resumo' },
  ];

  return (
    <>
      <Button icon={<CloudUploadOutlined />} onClick={() => setAberto(true)}>
        Importar planilha
      </Button>

      <Modal
        open={aberto}
        title={`Importar ${titulo} por planilha`}
        width={900}
        onCancel={fechar}
        destroyOnHidden
        footer={
          resultado ? (
            <Button type="primary" onClick={fechar}>
              Fechar
            </Button>
          ) : (
            <Space>
              <Button onClick={fechar}>Cancelar</Button>
              {!previa && (
                <Button
                  type="primary"
                  disabled={!arquivo}
                  loading={ocupado}
                  onClick={() => enviar('previa')}
                >
                  Conferir
                </Button>
              )}
              {previa && (
                <>
                  <Button onClick={() => setPrevia(null)}>Voltar</Button>
                  <Button
                    type="primary"
                    loading={ocupado}
                    disabled={
                      !previa.novas.length &&
                      !previa.atualizam.length &&
                      !previa.inativar.length
                    }
                    onClick={() => enviar('aplicar')}
                  >
                    Confirmar e gravar
                  </Button>
                </>
              )}
            </Space>
          )
        }
      >
        {/* ---------- passo 3: o que foi gravado ---------- */}
        {resultado && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="success"
              showIcon
              message="Importação concluída"
              description={
                <Space wrap>
                  <Tag color="green">{resultado.criadas} cadastrada(s)</Tag>
                  <Tag color="blue">{resultado.atualizadas} atualizada(s)</Tag>
                  {resultado.inativadas > 0 && (
                    <Tag color="orange">
                      {resultado.inativadas} inativada(s)
                    </Tag>
                  )}
                  <Tag>{resultado.iguais} sem alteração</Tag>
                  {resultado.recusadas.length > 0 && (
                    <Tag color="red">
                      {resultado.recusadas.length} recusada(s)
                    </Tag>
                  )}
                </Space>
              }
            />
            {resultado.senhas.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="Senhas provisórias — anote agora"
                description={
                  <>
                    <Typography.Paragraph style={{ marginBottom: 8 }}>
                      Estas senhas aparecem uma única vez. Entregue a cada
                      pessoa; no primeiro acesso ela troca. Se perder, gere
                      outra pela ficha do colaborador.
                    </Typography.Paragraph>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="email"
                      dataSource={resultado.senhas}
                      columns={[
                        { title: 'Nome', dataIndex: 'nome' },
                        { title: 'E-mail (login)', dataIndex: 'email' },
                        {
                          title: 'Senha provisória',
                          dataIndex: 'senha',
                          width: 160,
                          render: (s: string) => (
                            <Typography.Text copyable strong>
                              {s}
                            </Typography.Text>
                          ),
                        },
                      ]}
                    />
                  </>
                }
              />
            )}
            {(resultado.recusadas.length > 0 || resultado.falhas.length > 0) && (
              <Table
                size="small"
                rowKey={(r: any) => `${r.linha}-${r.chave}`}
                pagination={{ pageSize: 8 }}
                dataSource={[...resultado.recusadas, ...resultado.falhas]}
                columns={[
                  { title: 'Linha', dataIndex: 'linha', width: 70 },
                  {
                    title: previa?.rotuloChave ?? 'Código',
                    dataIndex: 'chave',
                    width: 180,
                  },
                  { title: 'Motivo da recusa', dataIndex: 'motivo' },
                ]}
              />
            )}
          </Space>
        )}

        {/* ---------- passo 2: o que vai acontecer ---------- */}
        {!resultado && previa && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type={previa.recusadas.length ? 'warning' : 'info'}
              showIcon
              message="Nada foi gravado ainda"
              description={
                <Space wrap>
                  <Tag color="green">{previa.novas.length} nova(s)</Tag>
                  <Tag color="blue">{previa.atualizam.length} atualiza(m)</Tag>
                  {previa.inativar.length > 0 && (
                    <Tag color="orange">
                      {previa.inativar.length} inativada(s)
                    </Tag>
                  )}
                  <Tag>{previa.iguais} sem alteração</Tag>
                  {previa.recusadas.length > 0 && (
                    <Tag color="red">
                      {previa.recusadas.length} recusada(s)
                    </Tag>
                  )}
                </Space>
              }
            />
            {previa.colunasAusentes.length > 0 && (
              <Alert
                type="info"
                message={
                  'Colunas que não vieram na planilha e por isso não serão ' +
                  'alteradas: ' +
                  previa.colunasAusentes.join(', ')
                }
              />
            )}
            {previa.colunasIgnoradas.length > 0 && (
              <Alert
                type="info"
                message={
                  'Colunas a mais na planilha, que o sistema ignorou: ' +
                  previa.colunasIgnoradas.join(', ')
                }
              />
            )}
            <Collapse
              defaultActiveKey={previa.recusadas.length ? ['recusadas'] : []}
              items={[
                {
                  key: 'novas',
                  label: `Serão cadastradas (${previa.novas.length})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="linha"
                      pagination={{ pageSize: 8 }}
                      dataSource={previa.novas}
                      columns={colunasLinha}
                    />
                  ),
                },
                {
                  key: 'atualizam',
                  label: `Serão atualizadas (${previa.atualizam.length})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="linha"
                      pagination={{ pageSize: 8 }}
                      dataSource={previa.atualizam}
                      columns={[
                        ...colunasLinha,
                        {
                          title: 'O que muda',
                          dataIndex: 'mudancas',
                          render: (m: string[]) => (m ?? []).join(', '),
                        },
                      ]}
                    />
                  ),
                },
                ...(previa.inativar.length
                  ? [
                      {
                        key: 'inativar',
                        label: `Serão inativadas por não estarem na planilha (${previa.inativar.length})`,
                        children: (
                          <Table
                            size="small"
                            rowKey="chave"
                            pagination={{ pageSize: 8 }}
                            dataSource={previa.inativar}
                            columns={[
                              {
                                title: previa.rotuloChave,
                                dataIndex: 'chave',
                                width: 180,
                              },
                              { title: 'Descrição', dataIndex: 'resumo' },
                            ]}
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: 'recusadas',
                  label: `Recusadas (${previa.recusadas.length})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="linha"
                      pagination={{ pageSize: 8 }}
                      dataSource={previa.recusadas}
                      columns={[
                        ...colunasLinha,
                        { title: 'Motivo', dataIndex: 'motivo' },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Space>
        )}

        {/* ---------- passo 1: baixar e subir ---------- */}
        {!resultado && !previa && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Como funciona"
              description={
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    Baixe a planilha: ela já vem com o cadastro de hoje e com
                    uma aba explicando cada coluna.
                  </li>
                  <li>
                    Corrija em cima dela e acrescente as linhas novas no fim.
                  </li>
                  <li>
                    Envie o arquivo aqui. O sistema mostra o que vai acontecer e
                    só grava depois que você confirmar.
                  </li>
                </ol>
              }
            />
            <Button
              icon={<DownloadOutlined />}
              loading={ocupado}
              onClick={baixarModelo}
            >
              Baixar a planilha de {titulo} (.xlsx)
            </Button>

            <Upload.Dragger
              accept=".xlsx"
              maxCount={1}
              fileList={
                arquivo
                  ? [{ uid: '1', name: arquivo.name, status: 'done' } as any]
                  : []
              }
              beforeUpload={(f) => {
                setArquivo(f as any);
                setPrevia(null);
                return false; // quem envia e o botao "Conferir", nao o Upload
              }}
              onRemove={() => {
                setArquivo(null);
                setPrevia(null);
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Arraste a planilha preenchida ou clique para escolher
              </p>
              <p className="ant-upload-hint">Somente .xlsx, até 10 MB.</p>
            </Upload.Dragger>

            {meu.podeInativar ? (
              <>
                <Checkbox
                  checked={listaCompleta}
                  onChange={(e) => {
                    setListaCompleta(e.target.checked);
                    setPrevia(null);
                  }}
                >
                  Esta planilha é a lista completa de {titulo.toLowerCase()}
                </Checkbox>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Marcando esta opção, quem estiver cadastrado no sistema e não
                  aparecer na planilha é <strong>inativado</strong> — nunca
                  excluído, para não quebrar os documentos que apontam para ele.
                  Deixando desmarcada, a planilha só acrescenta e corrige.
                </Typography.Text>
              </>
            ) : (
              // Instrumentos: 36 das 53 linhas do inventario estao sem codigo e
              // tres codigos se repetem, entao nao ha chave que sustente a
              // frase "quem sumiu da planilha deve ser inativado".
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Neste cadastro, apagar uma linha da planilha não faz nada. Para
                tirar um instrumento de circulação, escreva{' '}
                <strong>Não</strong> na coluna <strong>Ativo</strong>.
              </Typography.Text>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
}
