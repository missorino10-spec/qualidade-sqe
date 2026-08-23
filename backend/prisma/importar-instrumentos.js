/**
 * Le a planilha "BDBR.QUA.FMR.004.01_InventarioInstrumentos" e carrega o
 * inventario de instrumentos.
 *
 * As nove colunas da planilha (linha 5 e o cabecalho):
 *   B CODIGO | C EQUIPAMENTO | D FABRICANTE | E No SERIE |
 *   F DATA DE CALIBRACAO | G PROXIMA CALIBRACAO | H N Certificado |
 *   I PERIODO (ANOS) | J Localizacao
 *
 * A PROXIMA CALIBRACAO (coluna G) e copiada como esta na planilha, nao
 * recalculada. Motivo: nas 52 linhas do arquivo a proxima e sempre a data de
 * calibracao + 730 dias, enquanto o PERIODO (ANOS) esta preenchido com 1. A
 * data que vale e a do certificado, entao o sistema nao pode "corrigir" isso
 * sozinho - a carga preserva o que esta no papel e a tela permite ajustar.
 *
 * O codigo NAO e chave: 35 linhas vem com "-" e varios codigos se repetem (a
 * barra padrao carrega o codigo do micrometro a que pertence). Por isso a
 * carga so roda com o inventario VAZIO - assim nao ha como duplicar registro
 * rodando o script duas vezes.
 *
 * Uso:
 *   node prisma/importar-instrumentos.js            -> so mostra o que leu
 *   node prisma/importar-instrumentos.js --aplicar  -> grava no banco
 *
 * Nao usa biblioteca de xlsx: um .xlsx e um ZIP com XML dentro, e o Node ja
 * traz o inflate (mesma leitura de prisma/importar-base-itens.js).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------- ZIP

function lerZip(buffer) {
  const fimCD = (() => {
    for (let i = buffer.length - 22; i >= 0; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) return i;
    }
    throw new Error('Arquivo nao parece um .xlsx (fim do ZIP nao encontrado).');
  })();

  const totalArquivos = buffer.readUInt16LE(fimCD + 10);
  let p = buffer.readUInt32LE(fimCD + 16);
  const arquivos = {};

  for (let n = 0; n < totalArquivos; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buffer.readUInt16LE(p + 10);
    const tamComprimido = buffer.readUInt32LE(p + 20);
    const tamNome = buffer.readUInt16LE(p + 28);
    const tamExtra = buffer.readUInt16LE(p + 30);
    const tamComentario = buffer.readUInt16LE(p + 32);
    const inicioLocal = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString('utf8', p + 46, p + 46 + tamNome);

    const tamNomeLocal = buffer.readUInt16LE(inicioLocal + 26);
    const tamExtraLocal = buffer.readUInt16LE(inicioLocal + 28);
    const inicioDados = inicioLocal + 30 + tamNomeLocal + tamExtraLocal;
    const bruto = buffer.subarray(inicioDados, inicioDados + tamComprimido);

    arquivos[nome] = metodo === 0 ? bruto : zlib.inflateRawSync(bruto);
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return arquivos;
}

// ---------------------------------------------------------------- XML

function desescapar(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

function lerTextosCompartilhados(xml) {
  if (!xml) return [];
  const itens = xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? [];
  return itens.map((si) => {
    const partes = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    return partes
      .map((t) => desescapar(t.replace(/<t[^>]*>|<\/t>/g, '')))
      .join('');
  });
}

function lerLinhas(xmlAba, textos) {
  const linhas = xmlAba.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? [];
  return linhas.map((linha) => {
    const celulas = linha.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? [];
    const saida = {};
    for (const c of celulas) {
      const coluna = (c.match(/\sr="([A-Z]+)\d+"/) ?? [])[1];
      if (!coluna) continue;
      const tipo = (c.match(/\st="([^"]+)"/) ?? [])[1];
      let valor = (c.match(/<v>([\s\S]*?)<\/v>/) ?? [])[1];
      if (tipo === 'inlineStr') {
        const partes = c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
        valor = partes
          .map((t) => desescapar(t.replace(/<t[^>]*>|<\/t>/g, '')))
          .join('');
      } else if (tipo === 's' && valor != null) {
        valor = textos[Number(valor)];
      } else if (valor != null) {
        valor = desescapar(valor);
      }
      if (valor != null) saida[coluna] = String(valor);
    }
    return saida;
  });
}

// ---------------------------------------------------------------- datas

// O Excel guarda data como numero de dias desde 30/12/1899. Guardamos como
// meia-noite UTC, que e o formato de data pura do resto do sistema.
function dataDoExcel(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
}

function urlDireta() {
  const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const linha = env.split('\n').find((l) => l.trim().startsWith('DIRECT_URL='));
  if (!linha) throw new Error('DIRECT_URL nao encontrado no backend/.env');
  return linha
    .slice(linha.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  const deveAplicar = args.includes('--aplicar');
  const arquivo =
    args.find((a) => a !== '--aplicar') ??
    path.join(
      __dirname,
      '../../../Arquivos/01 - Arquivos Sistema Qualidade/BDBR.QUA.FMR.004.01_InventárioInstrumentos - Copia.xlsx',
    );

  if (!fs.existsSync(arquivo)) {
    console.error(`Planilha nao encontrada: ${arquivo}`);
    process.exit(1);
  }

  const zip = lerZip(fs.readFileSync(arquivo));
  const textos = lerTextosCompartilhados(
    zip['xl/sharedStrings.xml']?.toString('utf8'),
  );
  const linhas = lerLinhas(zip['xl/worksheets/sheet1.xml'].toString('utf8'), textos);

  // As quatro primeiras linhas sao o cabecalho do formulario e a quinta e o
  // cabecalho da tabela; o inventario comeca na sexta.
  const instrumentos = [];
  let ignoradas = 0;
  for (const linha of linhas.slice(5)) {
    const equipamento = (linha.C ?? '').trim();
    if (!equipamento) {
      ignoradas++;
      continue;
    }
    const codigoBruto = (linha.B ?? '').trim();
    const dataCalibracao = dataDoExcel(linha.F);
    const periodoAnos = Number.isFinite(Number(linha.I))
      ? Number(linha.I)
      : null;

    instrumentos.push({
      // "-" na planilha significa sem codigo.
      codigo: codigoBruto && codigoBruto !== '-' ? codigoBruto : null,
      equipamento,
      fabricante: (linha.D ?? '').trim() || null,
      numeroSerie: (linha.E ?? '').trim() || null,
      dataCalibracao,
      periodoAnos,
      // Copiada da planilha, sem recalcular (ver o comentario do topo).
      proximaCalibracao: dataDoExcel(linha.G),
      numeroCertificado: (linha.H ?? '').trim() || null,
      localizacao: (linha.J ?? '').trim() || null,
    });
  }

  console.log(`Planilha: ${arquivo}`);
  console.log(`Instrumentos lidos: ${instrumentos.length}`);
  console.log(`Linhas ignoradas (sem equipamento): ${ignoradas}`);
  console.log(
    `Sem codigo: ${instrumentos.filter((i) => !i.codigo).length} | sem data de calibracao: ${instrumentos.filter((i) => !i.dataCalibracao).length}`,
  );

  // Aviso, nao correcao: mostra quantas linhas tem a proxima calibracao
  // diferente do que o periodo declarado sugere. No arquivo original sao todas.
  const divergentes = instrumentos.filter((i) => {
    if (!i.dataCalibracao || !i.periodoAnos || !i.proximaCalibracao) return false;
    const esperada = new Date(i.dataCalibracao);
    esperada.setUTCFullYear(esperada.getUTCFullYear() + i.periodoAnos);
    return esperada.getTime() !== i.proximaCalibracao.getTime();
  }).length;
  if (divergentes)
    console.log(
      `Aviso: ${divergentes} linha(s) com proxima calibracao diferente de "data + periodo". A data da planilha foi mantida.`,
    );

  if (!deveAplicar) {
    console.log('\nNada foi gravado. Use --aplicar para carregar no banco.');
    console.log('Primeiras linhas lidas:');
    console.table(
      instrumentos.slice(0, 5).map((i) => ({
        codigo: i.codigo,
        equipamento: i.equipamento.slice(0, 40),
        calibracao: i.dataCalibracao?.toISOString().slice(0, 10),
        anos: i.periodoAnos,
        proxima: i.proximaCalibracao?.toISOString().slice(0, 10),
      })),
    );
    return;
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: urlDireta() } },
  });
  try {
    // Sem chave natural para casar, a carga so roda com o inventario vazio.
    // Assim rodar o script duas vezes nao duplica o inventario inteiro.
    const jaExiste = await prisma.instrumento.count();
    if (jaExiste > 0) {
      console.error(
        `\nO inventario ja tem ${jaExiste} registro(s). A carga inicial so roda com a tabela vazia — o codigo nao e unico e nao ha como casar as linhas sem duplicar. Ajuste pela tela.`,
      );
      process.exit(1);
    }
    await prisma.instrumento.createMany({ data: instrumentos });
    console.log(
      `\nCarregado. Instrumentos no banco: ${await prisma.instrumento.count()}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
