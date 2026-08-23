/**
 * Le a planilha "Base de Codigos e Custo.xlsx" e gera o SQL de carga do
 * cadastro de itens (prisma/seed-base-itens.sql).
 *
 * A planilha tem tres colunas: No. (codigo) | Descricao | C. Unit. (R$).
 * Quando a base for atualizada, e so rodar de novo apontando para o arquivo
 * novo e reaplicar o SQL: o INSERT usa ON CONFLICT, entao codigo que ja existe
 * tem descricao e custo atualizados e codigo novo entra.
 *
 * Uso:
 *   node prisma/importar-base-itens.js                      -> so gera o .sql
 *   node prisma/importar-base-itens.js --aplicar            -> gera e carrega
 *   node prisma/importar-base-itens.js "planilha.xlsx" --aplicar
 *
 * A carga vai em lotes pela conexao do Prisma, e nao pelo "prisma db execute":
 * o arquivo inteiro em uma transacao so passa de 4 minutos e o Supabase derruba
 * a conexao antes de terminar.
 *
 * Nao usa biblioteca de xlsx: um .xlsx e um ZIP com XML dentro, e o Node ja
 * traz o inflate. Assim o script roda em qualquer maquina, sem instalar nada.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------- ZIP

// Le o diretorio central do ZIP (do fim do arquivo para o comeco) e devolve
// um mapa nomeDoArquivo -> conteudo. So trata os dois modos que o Excel usa:
// 0 = sem compressao e 8 = deflate.
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

    // O cabecalho local repete nome e extra, com tamanhos proprios.
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

// Devolve as linhas da aba como { A: valor, B: valor, C: valor }.
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

// ---------------------------------------------------------------- carga

function aspas(texto) {
  return `'${String(texto).replace(/'/g, "''")}'`;
}

// Le o .env do backend so para pegar o DIRECT_URL (porta 5432). O DATABASE_URL
// aponta para o pooler, que nao aguenta carga longa.
function urlDireta() {
  const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const linha = env
    .split('\n')
    .find((l) => l.trim().startsWith('DIRECT_URL='));
  if (!linha) throw new Error('DIRECT_URL nao encontrado no backend/.env');
  const url = linha
    .slice(linha.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
  // Uma conexao so e paciencia para esperar por ela: sao ~70 lotes seguidos
  // contra o Supabase, e o padrao do Prisma (5 conexoes, 10s de espera)
  // estoura no meio da carga.
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=1&pool_timeout=120&connect_timeout=60`;
}

async function aplicar(comandos) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: urlDireta() } },
  });
  try {
    for (let i = 0; i < comandos.length; i++) {
      await prisma.$executeRawUnsafe(comandos[i]);
      process.stdout.write(`\r  lote ${i + 1}/${comandos.length}`);
    }
    process.stdout.write('\n');
    const total = await prisma.item.count();
    console.log(`Itens no banco depois da carga: ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const deveAplicar = args.includes('--aplicar');
  const arquivo =
    args.find((a) => a !== '--aplicar') ??
    path.join(
      __dirname,
      '../../../Arquivos/01 - Arquivos Sistema Qualidade/Base de Códigos e Custo.xlsx',
    );

  if (!fs.existsSync(arquivo)) {
    console.error(`Planilha nao encontrada: ${arquivo}`);
    process.exit(1);
  }

  const zip = lerZip(fs.readFileSync(arquivo));
  const textos = lerTextosCompartilhados(
    zip['xl/sharedStrings.xml']?.toString('utf8'),
  );
  const aba = zip['xl/worksheets/sheet1.xml'].toString('utf8');
  const linhas = lerLinhas(aba, textos);

  // Ultimo codigo vence: se a planilha repetir um codigo, fica a linha de baixo.
  const porCodigo = new Map();
  let semCodigo = 0;
  let semDescricao = 0;

  for (const linha of linhas.slice(1)) {
    const codigo = (linha.A ?? '').trim();
    const descricao = (linha.B ?? '').trim();
    if (!codigo) {
      semCodigo++;
      continue;
    }
    if (!descricao) {
      semDescricao++;
      continue;
    }
    const bruto = Number(linha.C);
    // A planilha guarda o custo em ponto flutuante binario (2,32 vira
    // 2.3199999999999998). Arredonda para centavos, que e como o sistema
    // exibe e calcula em R$.
    const custo = Number.isFinite(bruto) ? Math.round(bruto * 100) / 100 : null;
    porCodigo.set(codigo, { codigo, descricao, custo });
  }

  const itens = [...porCodigo.values()];
  const partes = [];

  partes.push(`-- Carga da base de codigos e custo (cadastro de Itens).
--
-- GERADO AUTOMATICAMENTE por prisma/importar-base-itens.js a partir de:
--   ${path.basename(arquivo)}
-- Nao editar na mao: rodar o script de novo quando a base mudar.
--
-- ${itens.length} codigos. Linhas ignoradas: ${semCodigo} sem codigo, ${semDescricao} sem descricao.
--
-- ON CONFLICT: codigo que ja existe tem descricao e custo atualizados; codigo
-- novo entra. Nunca apaga item que saiu da planilha, porque pode haver RNC ou
-- inspecao antiga apontando para ele.
--
-- O arquivo fica aqui como registro do que foi carregado. Para aplicar, use
-- o proprio script (ele carrega em lotes, pela conexao do Prisma):
--   node prisma/importar-base-itens.js --aplicar
`);

  // Lotes: um INSERT unico com 14 mil linhas estoura o tempo da conexao.
  const TAMANHO_LOTE = 200;
  const comandos = [];
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
    const lote = itens.slice(i, i + TAMANHO_LOTE);
    const valores = lote
      .map(
        (it) =>
          `  (${aspas(it.codigo)}, ${aspas(it.descricao)}, ${it.custo == null ? 'NULL' : it.custo})`,
      )
      .join(',\n');
    comandos.push(
      `INSERT INTO "Item" ("codigo", "descricao", "custoUnitario") VALUES\n${valores}\n` +
        `ON CONFLICT ("codigo") DO UPDATE SET\n` +
        `  "descricao" = EXCLUDED."descricao",\n` +
        `  "custoUnitario" = EXCLUDED."custoUnitario"`,
    );
  }
  partes.push(...comandos.map((c) => `${c};\n`));

  const destino = path.join(__dirname, 'seed-base-itens.sql');
  fs.writeFileSync(destino, partes.join('\n'), 'utf8');

  console.log(`Planilha: ${arquivo}`);
  console.log(`Linhas lidas: ${linhas.length}`);
  console.log(`Codigos gravados: ${itens.length}`);
  console.log(`Ignorados: ${semCodigo} sem codigo, ${semDescricao} sem descricao`);
  console.log(`SQL gerado em: ${destino}`);

  if (deveAplicar) {
    console.log(`Carregando ${comandos.length} lotes no banco...`);
    await aplicar(comandos);
  } else {
    console.log('Nada foi gravado. Use --aplicar para carregar no banco.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
