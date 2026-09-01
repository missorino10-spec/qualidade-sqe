import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../anexos/storage.service';
import { MAX_FOTOS_EVIDENCIA } from './inspecao';

// Bloco EVIDENCIAS / EVIDENCE da inspecao visual (BDBR.QUA.FMR.06.07).
// As fotos ficam no Supabase Storage, entao o PDF precisa dos bytes: quem
// gera o documento carrega as imagens antes e passa o array pronto.

// pdfkit so entende JPEG e PNG. HEIC entra no anexo (o celular manda assim),
// mas nao vai para o PDF — no papel ele sairia como um retangulo vazio.
const MIMES_NO_PDF = ['image/jpeg', 'image/jpg', 'image/png'];

// A foto pode vir com legenda (o item do checklist que reprovou) ou sem
// (bloco de evidencia geral, que sempre foi so a imagem).
export type FotoEvidencia = { dados: Buffer; legenda?: string | null };

export async function carregarFotosEvidencia(
  prisma: PrismaService,
  storage: StorageService,
  entidadeTipo: string,
  entidadeId?: number | null,
  // O bloco de evidencia geral tem teto de 4 fotos, como no papel. O bloco de
  // desvios nao: ele tem uma foto por item reprovado, e cortar em 4 esconderia
  // justamente o desvio que o relatorio precisa mostrar.
  limite: number = MAX_FOTOS_EVIDENCIA,
): Promise<FotoEvidencia[]> {
  if (!entidadeId) return [];
  const anexos = await prisma.anexo.findMany({
    where: { entidadeTipo, entidadeId },
    orderBy: { createdAt: 'asc' },
  });
  const imagens = anexos
    .filter((a) => MIMES_NO_PDF.includes((a.mimeType ?? '').toLowerCase()))
    .slice(0, limite);
  const baixadas = await Promise.all(
    imagens.map(async (a): Promise<FotoEvidencia | null> => {
      const dados = await storage.baixarOuNulo(a.caminho);
      return dados ? { dados, legenda: a.legenda } : null;
    }),
  );
  return baixadas.filter((f): f is FotoEvidencia => f !== null);
}

// Os quadros de foto do alerta, do 8D, do 5G, do ICAQ e do R.O nao tem
// legenda: eles recebem so os bytes, como sempre receberam.
export function bytesDasFotos(fotos: FotoEvidencia[]): Buffer[] {
  return fotos.map((f) => f.dados);
}

const ALTURA_FOTO = 110;
const PADDING = 8;

// Altura da legenda dentro do quadro da foto. Sem legenda o bloco fica com o
// tamanho de antes, para o layout dos formularios que nao usam legenda nao
// mudar de lugar.
function alturaLegenda(doc: PDFKit.PDFDocument, texto: string, largura: number) {
  return doc.font('Helvetica').fontSize(6.5).heightOfString(texto, {
    width: largura,
  });
}

// Desenha as fotos em duas colunas a partir de `y` e devolve o novo `y`.
// Quebra a pagina quando o quadro nao cabe no que sobrou da folha.
export function desenharFotosEvidencia(
  doc: PDFKit.PDFDocument,
  fotos: FotoEvidencia[],
  opts: { x0: number; largura: number; y: number; margem: number; rodape: number },
): number {
  const { x0, largura, margem, rodape } = opts;
  let y = opts.y;

  if (!fotos.length) {
    const altura = ALTURA_FOTO + 2 * PADDING;
    if (y + altura > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
    }
    doc.lineWidth(0.8).strokeColor('#000000').rect(x0, y, largura, altura).stroke();
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#555555')
      .text('Sem registro fotográfico. / No photographic record.', x0 + 6, y + 8, {
        width: largura - 12,
      });
    return y + altura;
  }

  const cols = fotos.length === 1 ? 1 : 2;
  const cellW = (largura - PADDING * (cols + 1)) / cols;

  // A altura e por LINHA, nao fixa: uma legenda de duas linhas empurraria a
  // foto de baixo para cima da imagem se todas as linhas tivessem o mesmo
  // tamanho. Cada linha mede a maior legenda que ela contem.
  const linhas: FotoEvidencia[][] = [];
  for (let i = 0; i < fotos.length; i += cols) {
    linhas.push(fotos.slice(i, i + cols));
  }
  const alturas = linhas.map((linha) => {
    const legenda = Math.max(
      0,
      ...linha.map((f) =>
        f.legenda ? alturaLegenda(doc, f.legenda, cellW) + 3 : 0,
      ),
    );
    return ALTURA_FOTO + legenda + PADDING;
  });

  // O quadro nao pode ser desenhado antes das fotos: se a lista quebrar a
  // pagina no meio, a moldura ficaria numa folha e parte das imagens na outra.
  // Por isso cada pagina recebe a sua moldura quando fecha.
  let topo = y;
  const moldura = (ate: number) => {
    doc
      .lineWidth(0.8)
      .strokeColor('#000000')
      .rect(x0, topo, largura, ate - topo)
      .stroke();
  };

  y += PADDING;
  linhas.forEach((linha, li) => {
    if (y + alturas[li] > doc.page.height - rodape) {
      moldura(y);
      doc.addPage();
      topo = margem;
      y = margem + PADDING;
    }
    linha.forEach((foto, ci) => {
      const px = x0 + PADDING + ci * (cellW + PADDING);
      try {
        doc.image(foto.dados, px, y, {
          fit: [cellW, ALTURA_FOTO],
          align: 'center',
          valign: 'center',
        });
      } catch {
        /* imagem invalida: ignora, o relatorio nao pode cair por causa dela */
      }
      if (foto.legenda) {
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor('#555555')
          .text(foto.legenda, px, y + ALTURA_FOTO + 3, {
            width: cellW,
            align: 'center',
          });
      }
    });
    y += alturas[li];
  });

  moldura(y);
  return y;
}
