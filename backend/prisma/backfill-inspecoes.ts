import { PrismaClient } from '@prisma/client';
import { numeroDocumento } from '../src/sqe/sqe-utils';

const prisma = new PrismaClient();

// ============================================================
// BACKFILL - numeracao de inspecoes e RNCs (executar UMA vez)
//
// Antes desta mudanca a inspecao nao tinha numero e a RNC nao apontava para
// o recebimento. Os registros ja existentes ficariam com o numero em branco
// na lista e sem vinculo com a inspecao de origem. Este script:
//
//   1. numera como INSP####/AAAA todo recebimento que ja tem formulario
//      preenchido (Visual e/ou Lote), na ordem cronologica;
//   2. liga cada RNC ao recebimento, a partir do formulario que a originou;
//   3. renumera as RNCs para RNC####/AAAA.
//
// Nada e apagado. Se um mesmo recebimento tiver mais de uma RNC (Visual e
// Lote abriram uma cada, no comportamento antigo), o script apenas avisa -
// juntar ou cancelar e decisao da Qualidade.
//
// Uso: node_modules/.bin/ts-node prisma/backfill-inspecoes.ts
// ============================================================

async function numerarInspecoes() {
  const entregas = await prisma.entregaPortaria.findMany({
    include: {
      inspecoesVisual: { select: { id: true } },
      inspecoesLote: { select: { id: true } },
    },
    orderBy: [{ dataEntrega: 'asc' }, { id: 'asc' }],
  });

  const inspecionadas = entregas.filter(
    (e) => e.inspecoesVisual.length > 0 || e.inspecoesLote.length > 0,
  );

  // Continua a partir do maior sequencial ja existente em cada ano.
  const proximo = new Map<number, number>();
  for (const e of inspecionadas) {
    if (e.inspecaoAno && e.inspecaoSequencial) {
      const atual = proximo.get(e.inspecaoAno) ?? 0;
      proximo.set(e.inspecaoAno, Math.max(atual, e.inspecaoSequencial));
    }
  }

  let numeradas = 0;
  for (const e of inspecionadas) {
    if (e.numeroInspecao) continue;
    const ano = e.dataEntrega.getFullYear();
    const sequencial = (proximo.get(ano) ?? 0) + 1;
    proximo.set(ano, sequencial);
    const numero = numeroDocumento('INSP', sequencial, ano);

    await prisma.entregaPortaria.update({
      where: { id: e.id },
      data: { numeroInspecao: numero, inspecaoAno: ano, inspecaoSequencial: sequencial },
    });
    // O numero do relatorio dos formularios e o numero da inspecao.
    await prisma.inspecaoVisual.updateMany({
      where: { entregaId: e.id },
      data: { relatorioNumero: numero },
    });
    await prisma.inspecaoLote.updateMany({
      where: { entregaId: e.id },
      data: { relatorioNumero: numero },
    });
    numeradas++;
    console.log(`  inspecao ${numero} (recebimento #${e.id})`);
  }
  console.log(`Inspecoes numeradas: ${numeradas} de ${inspecionadas.length}`);
}

async function ligarRncsAoRecebimento() {
  const rncs = await prisma.rnc.findMany({
    where: { entregaId: null },
    include: {
      inspecaoVisual: { select: { entregaId: true } },
      inspecaoLote: { select: { entregaId: true } },
    },
  });

  let ligadas = 0;
  for (const r of rncs) {
    const entregaId =
      r.inspecaoVisual?.entregaId ?? r.inspecaoLote?.entregaId ?? null;
    if (!entregaId) {
      console.log(`  RNC ${r.numero}: sem inspecao de origem, deixada solta`);
      continue;
    }
    await prisma.rnc.update({ where: { id: r.id }, data: { entregaId } });
    ligadas++;
  }
  console.log(`RNCs ligadas ao recebimento: ${ligadas} de ${rncs.length}`);

  // Avisa sobre recebimentos com mais de uma RNC (comportamento antigo).
  const todas = await prisma.rnc.findMany({
    where: { entregaId: { not: null }, status: { not: 'CANCELADA' } },
    select: { id: true, numero: true, entregaId: true },
  });
  const porEntrega = new Map<number, string[]>();
  for (const r of todas) {
    const lista = porEntrega.get(r.entregaId!) ?? [];
    lista.push(r.numero);
    porEntrega.set(r.entregaId!, lista);
  }
  for (const [entregaId, numeros] of porEntrega) {
    if (numeros.length > 1) {
      console.log(
        `  ATENCAO: recebimento #${entregaId} tem ${numeros.length} RNCs (${numeros.join(', ')}) - a regra nova e UMA por inspecao`,
      );
    }
  }
}

async function renumerarRncs() {
  const rncs = await prisma.rnc.findMany({
    orderBy: [{ dataAbertura: 'asc' }, { id: 'asc' }],
    select: { id: true, numero: true, dataAbertura: true },
  });

  const proximo = new Map<number, number>();
  let renumeradas = 0;
  // Libera os numeros antigos antes de reatribuir: numero e unico, entao um
  // alvo pode colidir com o numero atual de outra RNC.
  for (const r of rncs) {
    await prisma.rnc.update({
      where: { id: r.id },
      data: { numero: `tmp-${r.id}` },
    });
  }
  for (const r of rncs) {
    const ano = r.dataAbertura.getFullYear();
    const sequencial = (proximo.get(ano) ?? 0) + 1;
    proximo.set(ano, sequencial);
    const numero = numeroDocumento('RNC', sequencial, ano);
    await prisma.rnc.update({
      where: { id: r.id },
      data: { numero, ano, sequencial },
    });
    if (numero !== r.numero) {
      console.log(`  RNC ${r.numero} -> ${numero}`);
      renumeradas++;
    }
  }
  console.log(`RNCs renumeradas: ${renumeradas} de ${rncs.length}`);
}

async function main() {
  console.log('== Numerando inspecoes ==');
  await numerarInspecoes();
  console.log('== Ligando RNCs ao recebimento ==');
  await ligarRncsAoRecebimento();
  console.log('== Renumerando RNCs ==');
  await renumerarRncs();
  console.log('Backfill concluido.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
