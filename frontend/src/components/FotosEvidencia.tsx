import { Button, Image, Space, Typography, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, baixarBlobUrl } from '../api';
import { MAX_FOTOS_EVIDENCIA } from '../inspecao';

// Bloco EVIDENCIAS / EVIDENCE do formulario de inspecao visual
// (BDBR.QUA.FMR.06.07). Ate 4 fotos, so imagem, sempre opcional.

export { MAX_FOTOS_EVIDENCIA };

export function UploadFotosEvidencia({
  fotos,
  setFotos,
}: {
  fotos: any[];
  setFotos: (f: any[]) => void;
}) {
  return (
    <Upload
      multiple
      accept="image/png,image/jpeg,image/heic,image/heif"
      listType="picture"
      fileList={fotos}
      beforeUpload={(arquivo) => {
        if (!/^image\//.test(arquivo.type)) {
          message.error('A evidência precisa ser uma foto (JPG, PNG ou HEIC).');
          return Upload.LIST_IGNORE;
        }
        return false;
      }}
      onChange={({ fileList }) =>
        setFotos(fileList.slice(0, MAX_FOTOS_EVIDENCIA))
      }
    >
      <Button
        icon={<UploadOutlined />}
        disabled={fotos.length >= MAX_FOTOS_EVIDENCIA}
      >
        Adicionar fotos (máx. {MAX_FOTOS_EVIDENCIA})
      </Button>
    </Upload>
  );
}

// Sobe as fotos depois que o registro ja existe (precisa do id da entidade).
// Uma foto que falha nao derruba o encerramento da inspecao.
export async function enviarFotosEvidencia(
  fotos: any[],
  entidadeTipo: string,
  entidadeId: number,
) {
  for (const f of fotos.slice(0, MAX_FOTOS_EVIDENCIA)) {
    const arquivo = f.originFileObj ?? f;
    const fd = new FormData();
    fd.append('file', arquivo as Blob);
    try {
      await api.post('/anexos', fd, { params: { entidadeTipo, entidadeId } });
    } catch {
      message.warning(`A evidência "${f.name}" não pôde ser enviada.`);
    }
  }
}

// Leitura das fotos ja gravadas. O download e protegido por JWT, entao cada
// foto vira uma object-URL antes de ir para o <img>.
export function FotosEvidenciaSalvas({
  entidadeTipo,
  entidadeId,
}: {
  entidadeTipo: string;
  entidadeId?: number;
}) {
  const { data: fotos } = useQuery<{ id: number; nome: string; url: string }[]>({
    queryKey: ['fotos-evidencia', entidadeTipo, entidadeId],
    enabled: !!entidadeId,
    queryFn: async () => {
      const lista = (
        await api.get('/anexos', { params: { entidadeTipo, entidadeId } })
      ).data as any[];
      return Promise.all(
        lista.map(async (a) => ({
          id: a.id,
          nome: a.nomeArquivo,
          url: await baixarBlobUrl(`/anexos/${a.id}/download`),
        })),
      );
    },
  });

  if (!fotos?.length) {
    return (
      <Typography.Text type="secondary">
        Nenhuma foto de evidência.
      </Typography.Text>
    );
  }

  return (
    <Image.PreviewGroup>
      <Space wrap>
        {fotos.map((f) => (
          <Image key={f.id} src={f.url} alt={f.nome} height={120} />
        ))}
      </Space>
    </Image.PreviewGroup>
  );
}
