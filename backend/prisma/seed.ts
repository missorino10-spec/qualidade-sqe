import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('123456', 10);

  // Usuarios
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@bigdutchman.com.br',
      senhaHash,
      papel: 'ADMIN',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'qualidade@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Analista Qualidade',
      email: 'qualidade@bigdutchman.com.br',
      senhaHash,
      papel: 'QUALIDADE',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'producao@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Operador Producao',
      email: 'producao@bigdutchman.com.br',
      senhaHash,
      papel: 'PRODUCAO',
    },
  });

  // Tabela de periodicidade por classificacao (pre-setada e editavel)
  const periodicidades = [
    {
      classificacao: 'A' as const,
      periodicidadeTexto: '1 a cada 5 entregas',
      frequenciaN: 5,
      tipoInspecao: 'Amostragem',
      nivelInspecaoTexto: 'Inspecao Reduzida (30% dos itens)',
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
      nivelInspecaoTexto: 'Inspecao Normal (50% dos itens)',
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
      nivelInspecaoTexto: 'Inspecao Intensiva (100% dos itens)',
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
      nivelInspecaoTexto: 'Inspecao Intensiva (100% dos itens)',
      nivelRomano: 'III',
      percentualAmostra: 100,
      nqa: 1.0,
      conformidadeMin: 0,
    },
  ];
  for (const p of periodicidades) {
    await prisma.periodicidadeConfig.upsert({
      where: { classificacao: p.classificacao },
      update: p,
      create: p,
    });
  }

  // Fornecedores (aba ESCOPO - Planilha de Planejamento de Inspecoes)
  // Campos sem informacao ficam em branco. Classificacao sem info -> 'C' (default de trabalho).
  const fornecedores = [
    {
      codigo: '780949',
      nome: 'Inobram',
      tipoFornecimento: 'Paineis eletricos',
      categoriaInspecao: 'Eletrico/Montagem',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '793940',
      nome: 'Metalurgica Barra do Pirai S/A',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '780962',
      nome: 'Lubing do Brasil Ltda',
      tipoFornecimento: 'Tubos e pecas injetadas em plastico',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '780891',
      nome: 'Metalurgica Bello Ltda',
      tipoFornecimento: 'Aramados',
      categoriaInspecao: 'Aramados',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '782950',
      nome: 'Brastil',
      tipoFornecimento: 'Tubos de aco',
      categoriaInspecao: 'Tubos',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781071',
      nome: 'Sew-Eurodrive Brasil Ltda',
      tipoFornecimento: 'Motoredutores',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'B' as const,
      fazLote: false,
    },
    {
      codigo: '788996',
      nome: 'Helptech',
      tipoFornecimento: 'Pecas injetadas',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '795392',
      nome: 'Cabomaq-Forestieri',
      tipoFornecimento: 'Cabos eletricos',
      categoriaInspecao: 'Eletrico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '793036',
      nome: 'MM Plast',
      tipoFornecimento: 'Tubos extrudados PVC',
      categoriaInspecao: 'Plastico extrudado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781051',
      nome: 'Polijet',
      tipoFornecimento: 'Pecas injetadas',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '791605',
      nome: 'Fusopar Parafusos',
      tipoFornecimento: 'Parafusos, Porcas, Arruelas',
      categoriaInspecao: 'Fixadores',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781091',
      nome: 'Weg Linhares',
      tipoFornecimento: 'Motores e Motoredutores',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '781064',
      nome: 'Robustec',
      tipoFornecimento: 'Pecas metal mecanica',
      categoriaInspecao: 'Metalmecanica',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: false,
    },
    {
      codigo: '782896',
      nome: 'Dancor',
      tipoFornecimento: 'Conjunto moto bomba',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '791452',
      nome: 'Buzas',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '788484',
      nome: 'Confortcel',
      tipoFornecimento: 'Placas Evaporativas',
      categoriaInspecao: 'Componentes',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '790124',
      nome: 'Santae',
      tipoFornecimento: 'Pecas Plastico/PVC',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '797193',
      nome: 'Morlan',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '795544',
      nome: 'Maccaferri',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '788638',
      nome: 'CRB Metalurgica',
      tipoFornecimento: 'Pecas usinadas',
      categoriaInspecao: 'Usinagem',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '782461',
      nome: 'Weg Equipamentos',
      tipoFornecimento: 'Motores eletricos',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '785405',
      nome: 'Tigre',
      tipoFornecimento: 'Tubos/Conexao PVC',
      categoriaInspecao: 'PVC',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '793135',
      nome: 'Bekaert Ropes',
      tipoFornecimento: 'Cabos de aco',
      categoriaInspecao: 'Cabos de aco',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '771274',
      nome: 'Barbieri S.R.L.',
      tipoFornecimento: 'Esteiras Plastico',
      categoriaInspecao: 'Estrutural',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '790068',
      nome: 'Acotubo',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '789706',
      nome: 'Acotech',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781070',
      nome: 'Scareli',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781025',
      nome: 'Parafusos Rudge Ramos',
      tipoFornecimento: 'Parafusos, Porcas, Arruelas',
      categoriaInspecao: 'Fixadores',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '780988',
      nome: 'Metalurgica Luzi',
      tipoFornecimento: 'Pecas trefiladas',
      categoriaInspecao: 'Conformacao a frio',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781092',
      nome: 'Weg Drives',
      tipoFornecimento: 'Paineis eletricos e Inversores',
      categoriaInspecao: 'Eletrico/Montagem',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
  ];

  for (const f of fornecedores) {
    await prisma.fornecedor.upsert({
      where: { codigo: f.codigo },
      update: {
        nome: f.nome,
        tipoFornecimento: f.tipoFornecimento,
        categoriaInspecao: f.categoriaInspecao,
        esforcoQualidade: f.esforcoQualidade,
        classificacaoFornecimento: f.classificacaoFornecimento,
        fazVisual: true,
        fazLote: f.fazLote,
      },
      create: {
        codigo: f.codigo,
        nome: f.nome,
        tipoFornecimento: f.tipoFornecimento,
        categoriaInspecao: f.categoriaInspecao,
        esforcoQualidade: f.esforcoQualidade,
        classificacaoFornecimento: f.classificacaoFornecimento,
        fazVisual: true,
        fazLote: f.fazLote,
      },
    });
  }

  console.log(
    `Seed concluido. ${fornecedores.length} fornecedores. Usuario admin:`,
    admin.email,
    '/ senha: 123456',
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
