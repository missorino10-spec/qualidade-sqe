#!/usr/bin/env node
/*
 * FOTOGRAFIA — rede de seguranca do sistema.
 *
 * Grava o que cada tela do sistema devolve HOJE, com os dados que estao no
 * banco hoje, e depois confere se continua devolvendo a mesma coisa. E o que
 * permite mexer no codigo e provar que nenhum numero mudou, em vez de so
 * afirmar isso.
 *
 *   node scripts/fotografia.js gravar     -> grava a referencia
 *   node scripts/fotografia.js conferir   -> roda de novo e aponta o que mudou
 *
 * SO FAZ LEITURA. Nenhuma rota de POST/PATCH/PUT/DELETE e chamada: o backend
 * local aponta para o banco de producao e nao existe margem para escrever nada.
 *
 * Variaveis de ambiente (todas opcionais):
 *   API    endereco da API      (padrao http://localhost:3000/api)
 *   EMAIL  usuario do login     (padrao admin@qualidade-sqe.com)
 *   SENHA  senha do login
 */

const fs = require('fs');
const path = require('path');

const API = process.env.API || 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL || 'admin@qualidade-sqe.com';
const SENHA = process.env.SENHA || 'SENHA-REMOVIDA-DO-HISTORICO';
const PASTA = path.join(__dirname, 'fotografia');

// Quantos registros de detalhe conferir por lista. O detalhe e onde moram os
// calculos pesados (cotas, notas, 8D), entao vale a pena varrer varios; mas
// varrer a lista inteira tornaria a conferencia lenta demais para ser rodada
// a cada mudanca.
const AMOSTRA = 5;

// ---------------------------------------------------------------------------
// Rotas de leitura sem parametro de rota. Uma linha por tela do sistema.
// ---------------------------------------------------------------------------
const ROTAS = [
  '/auth/me',
  '/usuarios',
  '/fornecedores',
  '/periodicidade',
  '/itens',
  '/instrumentos',
  '/feriados',
  '/tipos-defeito',
  '/maquinas',
  '/maquinas/producao/resumo',

  // SQE
  '/inspecoes/template-visual',
  '/inspecoes',
  '/registros-entrada',
  '/rnc',
  '/rnc/reincidencia',
  '/avaliacao-fornecedores',
  '/avaliacao-fornecedores/consolidado',
  '/dashboard/kpis-sqe',
  '/dashboard/evolucao-fornecedores',
  '/dashboard/historico-classificacao',

  // MANUFATURA
  '/manufatura/inspecoes',
  '/manufatura/inspecoes-visuais',
  '/manufatura/cnq',
  '/manufatura/8d',
  '/manufatura/5g',
  '/manufatura/alertas',
  '/manufatura/controle-autonomo',
  '/manufatura/controle-autonomo/modelo',
  '/manufatura/painel/kpis',
  '/manufatura/painel/evolucao-maquinas',

  // SQD
  '/sqd/homologacoes',
  '/sqd/homologacoes-itens',
  '/sqd/auditorias',
  '/sqd/painel/kpis',
  '/sqd/painel/ultimas',
  '/sqd/painel/itens/kpis',
  '/sqd/painel/itens/ultimas',
  '/sqd/painel/auditorias/kpis',
  '/sqd/painel/auditorias/ultimas',

  // R.O
  '/ro/reclamacoes/responsaveis',
  '/ro/reclamacoes/listas',
  '/ro/reclamacoes',
];

// Detalhe: `lista` diz de onde tirar os ids e `detalhe` monta a URL de cada um.
// `de` existe para as listas que nao devolvem `id` direto na raiz.
const DETALHES = [
  { lista: '/fornecedores', detalhe: (id) => `/fornecedores/${id}` },
  { lista: '/fornecedores', detalhe: (id) => `/avaliacao-fornecedores/fornecedor/${id}` },
  { lista: '/fornecedores', detalhe: (id) => `/inspecoes/avaliar?fornecedorId=${id}` },
  { lista: '/usuarios', detalhe: (id) => `/usuarios/${id}` },
  { lista: '/instrumentos', detalhe: (id) => `/instrumentos/${id}` },
  { lista: '/maquinas', detalhe: (id) => `/maquinas/${id}` },
  { lista: '/maquinas', detalhe: (id) => `/maquinas/${id}/producao` },
  { lista: '/maquinas', detalhe: (id) => `/manufatura/inspecoes/setups?maquinaId=${id}` },
  { lista: '/registros-entrada', detalhe: (id) => `/registros-entrada/${id}` },
  { lista: '/rnc', detalhe: (id) => `/rnc/${id}` },
  { lista: '/rnc', detalhe: (id) => `/rnc/${id}/reincidencia` },
  { lista: '/manufatura/inspecoes', detalhe: (id) => `/manufatura/inspecoes/${id}` },
  { lista: '/manufatura/inspecoes-visuais', detalhe: (id) => `/manufatura/inspecoes-visuais/${id}` },
  { lista: '/manufatura/cnq', detalhe: (id) => `/manufatura/cnq/${id}` },
  { lista: '/manufatura/8d', detalhe: (id) => `/manufatura/8d/${id}` },
  { lista: '/manufatura/5g', detalhe: (id) => `/manufatura/5g/${id}` },
  { lista: '/manufatura/alertas', detalhe: (id) => `/manufatura/alertas/${id}` },
  { lista: '/manufatura/controle-autonomo', detalhe: (id) => `/manufatura/controle-autonomo/${id}` },
  { lista: '/sqd/homologacoes', detalhe: (id) => `/sqd/homologacoes/${id}` },
  { lista: '/sqd/homologacoes-itens', detalhe: (id) => `/sqd/homologacoes-itens/${id}` },
  { lista: '/sqd/auditorias', detalhe: (id) => `/sqd/auditorias/${id}` },
  { lista: '/ro/reclamacoes', detalhe: (id) => `/ro/reclamacoes/${id}` },
  // A inspecao de recebimento tem duas tabelas por baixo (visual e lote), mas o
  // id da lista e o do REGISTRO, nao o da tabela do formulario: quem junta as
  // duas e o /inspecoes/:id, a mesma rota que a tela de detalhe abre.
  { lista: '/inspecoes', detalhe: (id) => `/inspecoes/${id}` },
];

// Exportacoes: PDF e Excel sao binarios gerados na hora. O que da para conferir
// e que a rota responde e devolve o tipo certo — o conteudo ja esta coberto
// pela lista que alimenta o relatorio.
const EXPORTACOES = [
  '/instrumentos/relatorio',
  '/inspecoes/relatorio',
  '/registros-entrada/relatorio',
  '/rnc/relatorio',
  '/avaliacao-fornecedores/relatorio',
  '/maquinas/producao/relatorio',
  '/manufatura/inspecoes/relatorio',
  '/manufatura/inspecoes-visuais/relatorio',
  '/manufatura/cnq/relatorio',
  '/manufatura/8d/relatorio',
  '/manufatura/5g/relatorio',
  '/manufatura/alertas/relatorio',
  '/manufatura/controle-autonomo/relatorio',
  '/sqd/homologacoes/relatorio',
  '/sqd/homologacoes-itens/relatorio',
  '/sqd/auditorias/relatorio',
  '/ro/reclamacoes/relatorio',
];

// ---------------------------------------------------------------------------
// Normalizacao
// ---------------------------------------------------------------------------

// Campos que mudam sozinhos entre duas rodadas e nao dizem nada sobre regra de
// negocio. Se ficassem na fotografia, toda conferencia acusaria diferenca.
const VOLATEIS = new Set(['geradoEm', 'agora', 'timestamp', 'iat', 'exp']);

// Ordena as chaves e derruba os volateis para que duas rodadas do mesmo estado
// gerem exatamente o mesmo texto.
function normalizar(v) {
  if (Array.isArray(v)) return v.map(normalizar);
  if (v && typeof v === 'object') {
    const saida = {};
    for (const chave of Object.keys(v).sort()) {
      if (VOLATEIS.has(chave)) continue;
      saida[chave] = normalizar(v[chave]);
    }
    return saida;
  }
  return v;
}

const nomeArquivo = (rota) =>
  rota.replace(/^\//, '').replace(/[\/?=&]/g, '_') + '.json';

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
let token = '';

async function entrar() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, senha: SENHA }),
  });
  if (!r.ok) throw new Error(`Login falhou (${r.status}). API em ${API}?`);
  token = (await r.json()).access_token;
}

async function ler(rota) {
  const r = await fetch(API + rota, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tipo = r.headers.get('content-type') || '';
  if (!tipo.includes('json')) {
    const bytes = (await r.arrayBuffer()).byteLength;
    // O tamanho e o que da para conferir num binario, e serve bem: se o
    // relatorio parar de trazer linhas, ele despenca. O .xlsx e um zip com a
    // data da geracao dentro, entao oscila 1 ou 2 bytes a cada chamada mesmo
    // sem nada mudar - nesse caso a comparacao e em KB. O PDF e estavel.
    const pdf = tipo.includes('pdf');
    return pdf
      ? { status: r.status, tipo: 'application/pdf', bytes }
      : { status: r.status, tipo: tipo.split(';')[0], kb: Math.round(bytes / 1024) };
  }
  return { status: r.status, corpo: normalizar(await r.json()) };
}

// ---------------------------------------------------------------------------
// Coleta
// ---------------------------------------------------------------------------
async function coletar() {
  const foto = {};
  const listas = {};

  for (const rota of ROTAS) {
    foto[rota] = await ler(rota);
    const corpo = foto[rota].corpo;
    if (Array.isArray(corpo)) listas[rota] = corpo;
    // Algumas listas vem paginadas dentro de `dados`/`itens`.
    else if (corpo && Array.isArray(corpo.dados)) listas[rota] = corpo.dados;
    else if (corpo && Array.isArray(corpo.itens)) listas[rota] = corpo.itens;
  }

  // Ordenar por id deixa a amostra estavel: a mesma rodada escolhe sempre os
  // mesmos registros, independente da ordem que o banco devolveu.
  const amostraDe = (rota) =>
    (listas[rota] ?? [])
      .filter((x) => x && typeof x.id === 'number')
      .sort((a, b) => a.id - b.id)
      .slice(0, AMOSTRA);

  for (const { lista, detalhe } of DETALHES) {
    for (const linha of amostraDe(lista)) {
      const rota = detalhe(linha.id);
      foto[rota] = await ler(rota);
    }
  }

  for (const base of EXPORTACOES) {
    for (const formato of ['pdf', 'excel']) {
      const rota = `${base}?formato=${formato}`;
      foto[rota] = await ler(rota);
    }
  }

  return foto;
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
function gravarArquivos(foto, hoje) {
  fs.rmSync(PASTA, { recursive: true, force: true });
  fs.mkdirSync(PASTA, { recursive: true });
  for (const [rota, resposta] of Object.entries(foto)) {
    fs.writeFileSync(
      path.join(PASTA, nomeArquivo(rota)),
      JSON.stringify({ rota, ...resposta }, null, 2),
    );
  }
  fs.writeFileSync(
    path.join(PASTA, '_indice.json'),
    JSON.stringify({ capturadoEm: hoje, api: API, rotas: Object.keys(foto).sort() }, null, 2),
  );
}

// O dia de quem esta rodando o teste, no relogio LOCAL. Com toISOString() o
// script anunciava o dia seguinte a partir das 21h em UTC-3 e o aviso de
// "referencia de outro dia" aparecia sem motivo - ou, pior, nao aparecia
// quando devia.
function hojeLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

async function gravar() {
  const hoje = hojeLocal();
  const foto = await coletar();
  gravarArquivos(foto, hoje);
  const rotas = Object.keys(foto);
  const erros = rotas.filter((r) => foto[r].status >= 400);
  console.log(`Fotografia gravada: ${rotas.length} rotas em ${PASTA}`);
  if (erros.length) {
    console.log(`\nATENCAO — ${erros.length} rota(s) responderam com erro:`);
    for (const r of erros) console.log(`  ${foto[r].status}  ${r}`);
  }
}

async function conferir() {
  const indice = JSON.parse(fs.readFileSync(path.join(PASTA, '_indice.json'), 'utf8'));
  const hoje = hojeLocal();
  if (indice.capturadoEm !== hoje) {
    // Varios numeros do sistema andam com o calendario (prazo de RNC, alerta
    // vencido, competencia em aberto). Comparar com a fotografia de outro dia
    // acusa diferenca que nao e culpa do codigo.
    console.log(
      `AVISO: a referencia e de ${indice.capturadoEm} e hoje e ${hoje}. ` +
        `Diferencas em prazos e vencimentos podem ser so a virada do dia.\n`,
    );
  }

  const foto = await coletar();
  const rotas = new Set([...indice.rotas, ...Object.keys(foto)]);
  const mudaram = [];
  const sumiram = [];
  const novas = [];

  for (const rota of [...rotas].sort()) {
    const arquivo = path.join(PASTA, nomeArquivo(rota));
    const tinha = fs.existsSync(arquivo);
    const tem = rota in foto;
    if (tinha && !tem) { sumiram.push(rota); continue; }
    if (!tinha && tem) { novas.push(rota); continue; }
    const antes = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    delete antes.rota;
    const agora = foto[rota];
    if (JSON.stringify(antes) !== JSON.stringify(agora)) {
      mudaram.push({ rota, antes, agora });
    }
  }

  if (!mudaram.length && !sumiram.length && !novas.length) {
    console.log(`OK — ${Object.keys(foto).length} rotas conferem com a referencia.`);
    return;
  }

  if (mudaram.length) {
    console.log(`\n${mudaram.length} rota(s) MUDARAM:`);
    for (const m of mudaram) {
      console.log(`\n  ${m.rota}`);
      for (const linha of diferenca(m.antes, m.agora)) console.log(`    ${linha}`);
    }
  }
  if (sumiram.length) console.log(`\nSumiram da API:\n  ${sumiram.join('\n  ')}`);
  if (novas.length) console.log(`\nNovas na API:\n  ${novas.join('\n  ')}`);
  process.exitCode = 1;
}

// Aponta os caminhos que divergem, ate um teto, para o relatorio nao virar um
// despejo do JSON inteiro quando a lista toda muda.
function diferenca(a, b, caminho = '', achados = [], teto = 12) {
  if (achados.length >= teto) return achados;
  const iguais = JSON.stringify(a) === JSON.stringify(b);
  if (iguais) return achados;

  const objeto = (v) => v && typeof v === 'object';
  if (objeto(a) && objeto(b) && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && a.length !== b.length) {
      achados.push(`${caminho || '(raiz)'}: ${a.length} itens -> ${b.length} itens`);
      return achados;
    }
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const c of chaves) {
      diferenca(a[c], b[c], caminho ? `${caminho}.${c}` : c, achados, teto);
      if (achados.length >= teto) break;
    }
    return achados;
  }
  achados.push(`${caminho || '(raiz)'}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return achados;
}

// ---------------------------------------------------------------------------
const comando = process.argv[2];
(async () => {
  if (comando !== 'gravar' && comando !== 'conferir') {
    console.log('uso: node scripts/fotografia.js gravar|conferir');
    process.exitCode = 2;
    return;
  }
  await entrar();
  if (comando === 'gravar') await gravar();
  else await conferir();
})().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
