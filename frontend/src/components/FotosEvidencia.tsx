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
  // Legenda opcional, usada pela foto do desvio visual: e o texto do item do
  // checklist que reprovou, e sai embaixo da imagem no PDF.
  legenda?: string,
) {
  for (const f of fotos.slice(0, MAX_FOTOS_EVIDENCIA)) {
    const arquivo = f.originFileObj ?? f;
    const fd = new FormData();
    fd.append('file', arquivo as Blob);
    try {
      await api.post('/anexos', fd, {
        params: { entidadeTipo, entidadeId, legenda },
      });
    } catch (e: any) {
      message.warning(
        e?.response?.data?.message ??
          `A evidência "${f.name}" não pôde ser enviada.`,
      );
    }
  }
}

// Fotos do desvio visual: o inspetor marca um item do checklist como REPROVADO
// e a foto entra ali mesmo, na linha do item. O estado e um mapa
// "chave do item" -> lista de arquivos, porque a legenda de cada foto e o
// proprio texto do item.
export type FotosDesvio = Record<string, any[]>;

export function chaveDesvio(gi: number, ii: number): string {
  return `${gi}-${ii}`;
}

export function UploadFotoDesvio({
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
      <Button size="small" icon={<UploadOutlined />} disabled={fotos.length >= MAX_FOTOS_EVIDENCIA}>
        Foto do desvio
      </Button>
    </Upload>
  );
}

// Sobe as fotos de todos os itens reprovados de uma vez, cada uma com a
// legenda do seu item. Fotos de item que deixou de estar reprovado ficam de
// fora: o inspetor pode ter marcado, tirado a foto e voltado atras.
export async function enviarFotosDesvio(
  fotosPorItem: FotosDesvio,
  legendaDe: (chave: string) => string | null,
  entidadeTipo: string,
  entidadeId: number,
) {
  for (const [chave, fotos] of Object.entries(fotosPorItem)) {
    if (!fotos?.length) continue;
    const legenda = legendaDe(chave);
    if (!legenda) continue;
    await enviarFotosEvidencia(fotos, entidadeTipo, entidadeId, legenda);
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
