import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================
// SEED - versao NUVEM (branch deploy/cloud)
//
// O banco sobe VAZIO de dados operacionais. Este seed cria apenas:
//   1. o usuario administrador inicial (credenciais via variavel de ambiente)
//   2. os 4 parametros de periodicidade (A/B/C/D)
//
// Por que a periodicidade continua aqui: nao existe endpoint de criacao
// para PeriodicidadeConfig (o controller so tem GET e PATCH). Sem estas
// 4 linhas, "frequenciaN" cai no default 1 e TODA carga passaria a exigir
// inspecao, desligando na pratica a regra de inspecao ciclica. Sao
// parametros do metodo de inspecao - nao contem dado de fornecedor.
//
// NAO ha fornecedores, itens, inspecoes, RNCs nem anexos: todo registro
// da demonstracao deve ser criado pela propria tela, com dado ficticio.
// ============================================================

async function main() {
  // ---- 1. Usuario administrador inicial ----
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !senha) {
    throw new Error(
      'SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD sao obrigatorias. ' +
        'Defina as duas no painel do provedor antes de rodar o seed. ' +
        'Nenhuma senha padrao e embutida neste arquivo.',
    );
  }

  if (senha.length < 12) {
    throw new Error(
      'SEED_ADMIN_PASSWORD deve ter no minimo 12 caracteres. ' +
        'A aplicacao fica exposta na internet - senha fraca nao e aceita.',
    );
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  // upsert com "update: {}" -> se o admin ja existir, a senha NAO e
  // sobrescrita. Rodar o seed de novo nunca reseta credencial existente.
  const admin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      nome: 'Administrador',
      email,
      senhaHash,
      papel: 'ADMIN',
    },
  });

  // ---- 2. Parametros de periodicidade por classificacao ----
  const periodicidades = [
    {
      classificacao: 'A' as const,
      periodicidadeTexto: '1 a cada 5 entregas',
      frequenciaN: 5,
      tipoInspecao: 'Amostragem',
      nivelInspecaoTexto: 'Inspeção Reduzida (30% dos itens)',
      nivelRomano: 'I',
      percentualAmostra: 30,
      nqa: 4.0,
      conformidadeMin: 98,
    },
    {
      classificacao: 'B' as const,
      periodicidadeTexto: '1 a cada 3 entregas',
      frequenciaN: 3,
      tipoInspecao: 'Amostragem',
      nivelInspecaoTexto: 'Inspeção Normal (50% dos itens)',
      nivelRomano: 'II',
      percentualAmostra: 50,
      nqa: 2.5,
      conformidadeMin: 90,
    },
    {
      classificacao: 'C' as const,
      periodicidadeTexto: 'Todas as entregas',
      frequenciaN: 1,
      tipoInspecao: 'Integral',
      nivelInspecaoTexto: 'Inspeção Intensiva (100% dos itens)',
      nivelRomano: 'III',
      percentualAmostra: 100,
      nqa: 1.0,
      conformidadeMin: 80,
    },
    {
      classificacao: 'D' as const,
      periodicidadeTexto: 'Todas as entregas',
      frequenciaN: 1,
      tipoInspecao: 'Integral',
      nivelInspecaoTexto: 'Inspeção Intensiva (100% dos itens)',
      nivelRomano: 'III',
      percentualAmostra: 100,
      nqa: 1.0,
      conformidadeMin: 0,
    },
  ];

  // "update: {}" como no admin: os valores abaixo sao a CARGA INICIAL, nao a
  // verdade. NQA, percentual de amostra e conformidade minima sao editaveis na
  // tela de Periodicidade e mandam no plano de amostragem e no C1 do IDF - com
  // "update: p" o seed regravava os quatro registros a cada boot e o ajuste
  // feito pela Qualidade voltava para a tabela do codigo no deploy seguinte,
  // sem aviso.
  for (const p of periodicidades) {
    await prisma.periodicidadeConfig.upsert({
      where: { classificacao: p.classificacao },
      update: {},
      create: p,
    });
  }

  // ---- 3. Maquinas da Fabricacao (modulo MANUFATURA) ----
  // Sao as 15 abas de maquina da planilha de indicadores da Qualidade: um
  // cadastro da fabrica, nao dado operacional. As linhas de MONTAGEM nao
  // entram aqui porque a planilha nao nomeia as linhas - a Qualidade cadastra
  // pela propria tela de Maquinas.
  const maquinas = [
    'Infinity',
    'Meccal',
    'Dobradeira Newton',
    'Prensa 100',
    'Prensa 40',
    'Roll Forming',
    'Laser',
    'Prensa 300',
    'Cocho',
    'Chapa Anel',
    'Diversas',
    'Puncionadeira Finn Power',
    'Dobradeira Warcon',
    'Puncionadeira LVD',
    'Dobradeira Finn Power',
  ];

  for (let i = 0; i < maquinas.length; i++) {
    const codigo = `MAQ${String(i + 1).padStart(2, '0')}`;
    await prisma.maquina.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nome: maquinas[i], area: 'FABRICACAO' },
    });
  }

  // ---- 4. Descricao do Defeito (lista oficial da Qualidade) ----
  // Alimenta o lancamento de CNQ e o bloco de defeitos do relatorio.
  const defeitos = [
    'Acabamento Danificado',
    'Marca de Solda',
    'Furação Não Realizada',
    'Dimensional Fora do Especificado',
    'Setup Incorreto',
    'Dobra Invertida',
    'Furação Deslocada',
    'Falha de Corte',
    'Rebarba',
    'Chapa Danificada',
    'Sobra de Material',
    'Material Deformado',
    'Oxidação',
    'Pico de Energia',
    'Repuxo Invertido',
    // Defeitos da Montagem
    'Ruído',
    'Vazamento',
  ];

  for (let i = 0; i < defeitos.length; i++) {
    await prisma.tipoDefeito.upsert({
      where: { nome: defeitos[i] },
      update: {},
      create: { nome: defeitos[i], ordem: i + 1 },
    });
  }

  // Saidas de emergencia da lista, sempre no fim. "Outros" pede o texto do
  // defeito no lancamento - dai o exigeDetalhe.
  for (const saida of [
    { nome: 'Não Definido', ordem: 900, exigeDetalhe: false },
    { nome: 'Outros', ordem: 901, exigeDetalhe: true },
  ]) {
    await prisma.tipoDefeito.upsert({
      where: { nome: saida.nome },
      update: { exigeDetalhe: saida.exigeDetalhe },
      create: saida,
    });
  }

  // A senha NAO e impressa no log (o log do provedor fica visivel no painel).
  console.log(
    `Seed (nuvem) concluido. Admin: ${admin.email}. ` +
      `${periodicidades.length} parametros de periodicidade, ` +
      `${maquinas.length} maquinas e ${defeitos.length} tipos de defeito. ` +
      `Nenhum fornecedor, item, inspecao ou RNC criado.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
