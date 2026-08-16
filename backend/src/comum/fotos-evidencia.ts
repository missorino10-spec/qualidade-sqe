import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../anexos/storage.service';
import { MAX_FOTOS_EVIDENCIA } from './inspecao';

// Bloco EVIDENCIAS / EVIDENCE da inspecao visual (BDBR.QUA.FMR.06.07).
// As fotos ficam no Supabase Storage, entao o PDF precisa dos bytes: quem
// gera o documento carrega as imagens antes e passa o array pronto.

// pdfkit so entende JPEG e PNG. HEIC entra no anexo (o celular manda assim),
// mas nao vai para o PDF — no papel ele sairia como um retangulo vazio.
const MIMES_NO_PDF = ['image/jpeg', 'image/jpg', 'image/png'];

export async function carregarFotosEvidencia(
  prisma: PrismaService,
  storage: StorageService,
  entidadeTipo: string,
  entidadeId?: number | null,
): Promise<Buffer[]> {
  if (!entidadeId) return [];
  const anexos = await prisma.anexo.findMany({
    where: { entidadeTipo, entidadeId },
    orderBy: { createdAt: 'asc' },
  });
  const imagens = anexos
    .filter((a) => MIMES_NO_PDF.includes((a.mimeType ?? '').toLowerCase()))
    .slice(0, MAX_FOTOS_EVIDENCIA);
  const baixadas = await Promise.all(
    imagens.map((a) => storage.baixarOuNulo(a.caminho)),
  );
  return baixadas.filter((b): b is Buffer => b !== null);
}

// Desenha as fotos em duas colunas a partir de `y` e devolve o novo `y`.
// Quebra a pagina quando o quadro nao cabe no que sobrou da folha.
export function desenharFotosEvidencia(
  doc: PDFKit.PDFDocument,
  fotos: Buffer[],
  opts: { x0: number; largura: number; y: number; margem: number; rodape: number },
): number {
  const { x0, largura, margem, rodape } = opts;
  let y = opts.y;

  const linhas = fotos.length ? Math.ceil(fotos.length / 2) : 1;
  const alturaFoto = 110;
  const altura = linhas * (alturaFoto + 8) + 8;

  if (y + altura > doc.page.height - rodape) {
    doc.addPage();
    y = margem;
  }

  doc.lineWidth(0.8).strokeColor('#000000').rect(x0, y, largura, altura).stroke();

  if (!fotos.length) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#555555')
      .text('Sem registro fotográfico. / No photographic record.', x0 + 6, y + 8, {
        width: largura - 12,
      });
    return y + altura;
  }

  const padding = 8;
  const cols = fotos.length === 1 ? 1 : 2;
  const cellW = (largura - padding * (cols + 1)) / cols;
  fotos.forEach((foto, i) => {
    const col = i % cols;
    const lin = Math.floor(i / cols);
    const px = x0 + padding + col * (cellW + padding);
    const py = y + padding + lin * (alturaFoto + padding);
    try {
      doc.image(foto, px, py, {
        fit: [cellW, alturaFoto],
        align: 'center',
        valign: 'center',
      });
    } catch {
      /* imagem invalida: ignora, o relatorio nao pode cair por causa dela */
    }
  });

  return y + altura;
}
