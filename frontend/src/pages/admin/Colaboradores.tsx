import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api';
import Tabela from '../../components/Tabela';
import ImportarPlanilha from '../../components/ImportarPlanilha';
import {
  MODULOS,
  ROTULO_MODULO,
  ROTULO_MODULO_CURTO,
} from '../../permissoes';
import type { Acesso, Modulo, Nivel } from '../../permissoes';

/**
 * Colaboradores e Acessos — area do admin.
 *
 * O admin cadastra a pessoa da empresa (a ficha), o sistema devolve uma senha
 * provisoria para ele entregar e, no primeiro acesso, o proprio colaborador
 * define a senha dele. Na mesma tela ele marca o que a pessoa enxerga.
 *
 * SQE, MANUFATURA e SQD sao modulo inteiro; CADASTROS e liberado submenu a
 * submenu. Nao ter Cadastros nunca trava um lancamento: as listas continuam
 * alimentando os combos, o que muda e poder abrir a tela e alterar a base.
 */

type Escolha = 'NAO' | Nivel;

interface Colaborador {
  id: number;
  nome: string;
  email: string;
  papel: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
  ativo: boolean;
  matricula?: string | null;
  cargo?: string | null;
  setor?: string | null;
  telefone?: string | null;
  dataAdmissao?: string | null;
  precisaTrocarSenha?: boolean;
  acessos: Acesso[];
}

const vazio = (): Record<Modulo, Escolha> =>
  MODULOS.reduce(
    (acc, m) => ({ ...acc, [m]: 'NAO' as Escolha }),
    {} as Record<Modulo, Escolha>,
  );

const daLista = (acessos: Acesso[]) => {
  const mapa = vazio();
  acessos.forEach((a) => {
    mapa[a.modulo] = a.nivel;
  });
  return mapa;
};

const paraLista = (mapa: Record<Modulo, Escolha>): Acesso[] =>
  MODULOS.filter((m) => mapa[m] !== 'NAO').map((m) => ({
    modulo: m,
    nivel: mapa[m] as Nivel,
  }));

export default function Colaboradores() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [acessos, setAcessos] = useState<Record<Modulo, Escolha>>(vazio());
  const [senhaGerada, setSenhaGerada] = useState<{
    nome: string;
    senha: string;
  } | null>(null);

  const { data, isFetching } = useQuery<Colaborador[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
  });

  function abrir(registro?: Colaborador) {
    setEditando(registro ?? null);
    setAcessos(registro ? daLista(registro.acessos) : vazio());
    form.setFieldsValue({
      nome: registro?.nome,
      email: registro?.email,
      matricula: registro?.matricula,
      cargo: registro?.cargo,
      setor: registro?.setor,
      telefone: registro?.telefone,
      dataAdmissao: registro?.dataAdmissao
        ? dayjs(registro.dataAdmissao)
        : undefined,
      admin: registro ? registro.papel === 'ADMIN' : false,
      ativo: registro ? registro.ativo : true,
    });
    setOpen(true);
  }

  const salvar = useMutation({
    mutationFn: async (v: any) => {
      const ficha = {
        nome: v.nome,
        email: v.email,
        matricula: v.matricula || null,
        cargo: v.cargo || null,
        setor: v.setor || null,
        telefone: v.telefone || null,
        dataAdmissao: v.dataAdmissao
          ? dayjs(v.dataAdmissao).format('YYYY-MM-DD')
          : null,
        papel: v.admin ? 'ADMIN' : 'QUALIDADE',
      };
      const lista = paraLista(acessos);
      if (editando) {
        await api.patch(`/usuarios/${editando.id}`, {
          ...ficha,
          ativo: v.ativo,
        });
        await api.put(`/usuarios/${editando.id}/acessos`, { acessos: lista });
        return null;
      }
      const { data } = await api.post('/usuarios', {
        ...ficha,
        acessos: lista,
      });
      return data as { usuario: Colaborador; senhaProvisoria: string };
    },
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setOpen(false);
      if (novo) {
        setSenhaGerada({
          nome: novo.usuario.nome,
          senha: novo.senhaProvisoria,
        });
      } else {
        message.success('Ficha atualizada.');
      }
    },
    onError: (e: any) =>
      message.error(e?.response?.data?.message ?? 'Não foi possível salvar.'),
  });

  const resetar = useMutation({
    mutationFn: async (registro: Colaborador) => {
      const { data } = await api.post(`/usuarios/${registro.id}/resetar-senha`);
      return { nome: registro.nome, senha: data.senhaProvisoria as string };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setSenhaGerada(r);
    },
    onError: () => message.error('Não foi possível resetar a senha.'),
  });

  const colunas = [
    { title: 'Nome', dataIndex: 'nome', width: 200 },
    { title: 'E-mail (login)', dataIndex: 'email', width: 220 },
    { title: 'Matrícula', dataIndex: 'matricula', width: 110 },
    { title: 'Cargo', dataIndex: 'cargo', width: 150 },
    { title: 'Setor', dataIndex: 'setor', width: 140 },
    {
      title: 'Acessos',
      dataIndex: 'acessos',
      width: 260,
      /* Etiqueta curta na linha, rotulo por extenso no passar do mouse. Com o
         nome inteiro ("QUALIDADE - MANUFATURA", "Cadastros › Fornecedores")
         cada colaborador ocupava quatro linhas de altura na tabela. */
      render: (lista: Acesso[], r: Colaborador) =>
        r.papel === 'ADMIN' ? (
          <Tag color="gold">Administrador</Tag>
        ) : lista.length === 0 ? (
          <Typography.Text type="secondary">Nenhum</Typography.Text>
        ) : (
          <Space size={[4, 4]} wrap>
            {lista.map((a) => (
              <Tooltip
                key={a.modulo}
                title={`${ROTULO_MODULO[a.modulo]} — ${
                  a.nivel === 'EDITAR' ? 'pode lançar' : 'só visualiza'
                }`}
              >
                <Tag color={a.nivel === 'EDITAR' ? 'blue' : 'default'}>
                  {ROTULO_MODULO_CURTO[a.modulo]}
                  {a.nivel === 'VISUALIZAR' ? ' · ver' : ''}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        ),
    },
    {
      title: 'Situação',
      dataIndex: 'ativo',
      width: 130,
      render: (ativo: boolean, r: Colaborador) =>
        !ativo ? (
          <Tag>Inativo</Tag>
        ) : r.precisaTrocarSenha ? (
          <Tag color="orange">Senha provisória</Tag>
        ) : (
          <Tag color="green">Ativo</Tag>
        ),
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 190,
      render: (_: any, r: Colaborador) => (
        <Space>
          <Button size="small" onClick={() => abrir(r)}>
            Ficha
          </Button>
          <Button
            size="small"
            icon={<KeyOutlined />}
            loading={resetar.isPending}
            onClick={() =>
              Modal.confirm({
                title: `Resetar a senha de ${r.nome}?`,
                content:
                  'Uma nova senha provisória será gerada. A pessoa terá que criar a definitiva no próximo acesso.',
                okText: 'Resetar',
                cancelText: 'Cancelar',
                onOk: () => resetar.mutate(r),
              })
            }
          >
            Senha
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Colaboradores e Acessos"
      extra={
        <Space wrap>
          <ImportarPlanilha
            cadastro="colaboradores"
            aoConcluir={() => qc.invalidateQueries({ queryKey: ['usuarios'] })}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Novo colaborador
          </Button>
        </Space>
      }
    >
      <Tabela
        busca="Buscar por nome, e-mail, cargo ou setor"
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={data ?? []}
        columns={colunas as any}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1300 }}
      />

      <Modal
        open={open}
        title={editando ? `Ficha de ${editando.nome}` : 'Novo colaborador'}
        okText="Salvar"
        cancelText="Cancelar"
        width={760}
        confirmLoading={salvar.isPending}
        onCancel={() => setOpen(false)}
        onOk={async () => salvar.mutate(await form.validateFields())}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="nome"
                label="Nome"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="matricula" label="Matrícula">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={14}>
              <Form.Item
                name="email"
                label="E-mail (é o login)"
                rules={[
                  { required: true, message: 'Informe o e-mail.' },
                  { type: 'email', message: 'E-mail inválido.' },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="telefone" label="Telefone / ramal">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="cargo" label="Cargo">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="setor" label="Setor">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dataAdmissao" label="Data de admissão">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="admin" label="Administrador" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            {editando && (
              <Col xs={24} sm={6}>
                <Form.Item name="ativo" label="Ativo" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item shouldUpdate={(a, b) => a.admin !== b.admin} noStyle>
            {() =>
              form.getFieldValue('admin') ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Administrador enxerga e edita tudo, inclusive esta tela."
                />
              ) : (
                <>
                  <Typography.Text strong>Acessos</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    {MODULOS.map((m) => (
                      <Row
                        key={m}
                        align="middle"
                        style={{ marginBottom: 8 }}
                        gutter={12}
                      >
                        <Col xs={24} sm={11}>
                          {ROTULO_MODULO[m]}
                        </Col>
                        <Col xs={24} sm={13}>
                          <Segmented
                            size="small"
                            value={acessos[m]}
                            onChange={(v) =>
                              setAcessos({ ...acessos, [m]: v as Escolha })
                            }
                            options={[
                              { label: 'Sem acesso', value: 'NAO' },
                              { label: 'Visualizar', value: 'VISUALIZAR' },
                              { label: 'Visualizar e editar', value: 'EDITAR' },
                            ]}
                          />
                        </Col>
                      </Row>
                    ))}
                  </div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message="Não liberar Cadastros não impede lançamentos: as listas de fornecedores, itens, máquinas e instrumentos continuam disponíveis nos formulários."
                  />
                </>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* A senha aparece uma unica vez: e o admin quem entrega para a pessoa. */}
      <Modal
        open={!!senhaGerada}
        title="Senha provisória"
        footer={[
          <Button key="ok" type="primary" onClick={() => setSenhaGerada(null)}>
            Já anotei
          </Button>,
        ]}
        onCancel={() => setSenhaGerada(null)}
      >
        <p>
          Entregue esta senha a <strong>{senhaGerada?.nome}</strong>. No primeiro
          acesso o sistema pede a troca por uma senha definitiva.
        </p>
        <Typography.Title
          level={3}
          copyable
          style={{ textAlign: 'center', letterSpacing: 2 }}
        >
          {senhaGerada?.senha}
        </Typography.Title>
        <Alert
          type="warning"
          showIcon
          message="Esta senha não será mostrada de novo. Se perder, use o botão Senha na lista para gerar outra."
        />
      </Modal>
    </Card>
  );
}
