import { Button, Space, Typography, Upload, message } from 'antd';
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { abrirPdfEmNovaAba, api } from '../api';

// Arquivo do documento que motivou a abertura do 8D / 5G. O numero do documento
// e um campo do proprio formulario; aqui fica so o arquivo, que pode ser de
// qualquer formato (RNC em PDF, e-mail, foto do relatorio...).
export default function DocumentoReferenciado({
  entidadeTipo,
  entidadeId,
}: {
  entidadeTipo: string;
  entidadeId?: string;
}) {
  const qc = useQueryClient();
  const chave = ['anexos', entidadeTipo, entidadeId];

  const { data: anexos } = useQuery<any[]>({
    queryKey: chave,
    enabled: !!entidadeId,
    queryFn: async () =>
      (await api.get('/anexos', { params: { entidadeTipo, entidadeId } })).data,
  });

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Upload
        multiple
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          const fd = new FormData();
          fd.append('file', file as Blob);
          try {
            await api.post('/anexos', fd, {
              params: { entidadeTipo, entidadeId },
            });
            qc.invalidateQueries({ queryKey: chave });
            onSuccess?.({});
          } catch (e) {
            onError?.(e as any);
            message.error('Não foi possível enviar o documento.');
          }
        }}
      >
        <Button size="small" icon={<UploadOutlined />}>
          Anexar documento
        </Button>
      </Upload>
      {anexos?.length ? (
        anexos.map((a: any) => (
          <Button
            key={a.id}
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            style={{ padding: 0 }}
            onClick={() => abrirPdfEmNovaAba(`/anexos/${a.id}/download`)}
          >
            {a.nomeArquivo}
          </Button>
        ))
      ) : (
        <Typography.Text type="secondary" italic>
          Nenhum documento anexado.
        </Typography.Text>
      )}
    </Space>
  );
}
