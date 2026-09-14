import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { ModuloSistema } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { Modulo } from '../../auth/modulo.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { responderRelatorio } from '../../comum/relatorio-lista';
import { AvaliacaoService } from './avaliacao.service';
import { ROTULO_CLASSE } from './idf';

// Nota digitada a mao. Mandar null (ou omitir) devolve o criterio ao calculo
// automatico.
class NotasManuaisDto {
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC1Manual?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC2Manual?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC3Manual?: number | null;
  @IsOptional() @IsString() justificativa?: string | null;
}

class CompetenciaDto {
  @IsNumber() ano!: number;
  @IsNumber() @Min(1) @Max(12) mes!: number;
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// A coluna "Ação" da tela vem do formulario de monitoramento de fornecedores:
// e o que a classe apurada manda fazer.
const ACAO_CLASSE: Record<string, string> = {
  A: 'Revisão semestral — manter parceria',
  B: 'Revisão trimestral — monitoramento padrão',
  C: 'Revisão mensal — plano de desenvolvimento obrigatório',
  D: 'Ação imediata — suspensão e auditoria',
};

// Padrao unico de leitura da classe: a letra e o nome da faixa, igual na tela,
// no papel e na planilha.
const textoClasse = (c?: string | null) =>
  c ? `${c} — ${ROTULO_CLASSE[c]}` : '';

const mediaIdf = (valores: (number | null | undefined)[]) => {
  const notas = valores.filter((v): v is number => v !== null && v !== undefined);
  if (!notas.length) return 0;
  return notas.reduce((s, v) => s + v, 0) / notas.length;
};

const doisDigitos = (v: number) =>
  v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

@UseGuards(JwtAuthGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('avaliacao-fornecedores')
export class AvaliacaoController {
  constructor(private service: AvaliacaoService) {}

  @Get('competencia-atual')
  competenciaAtual() {
    return this.service.competenciaAtual();
  }

  @Get()
  listar(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    const atual = this.service.competenciaAtual();
    return this.service.listar(
      ano ? Number(ano) : atual.ano,
      mes ? Number(mes) : atual.mes,
    );
  }

  // Relatorio da apuracao da competencia, em PDF ou planilha. O recorte desta
  // tela nao e um intervalo de datas: e a competencia (mes/ano) que o painel
  // esta mostrando, entao o relatorio recebe ano e mes como a lista recebe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    const atual = this.service.competenciaAtual();
    const anoSel = ano ? Number(ano) : atual.ano;
    const mesSel = mes ? Number(mes) : atual.mes;
    const dados = await this.service.listar(anoSel, mesSel);
    const linhas: any[] = dados.linhas ?? [];
    const avaliados = linhas.filter((l) => l.idf !== null);
    const porClasse = (c: string) =>
      avaliados.filter((l) => l.classificacao === c).length;
    // O que a tela mostra na coluna e a nota efetiva: a manual quando existe,
    // senao a automatica.
    const nota = (l: any, n: 1 | 2 | 3) =>
      l[`notaC${n}Manual`] ?? l[`notaC${n}Auto`];

    // O papel sai com as mesmas tres leituras da tela: o mes apurado, o
    // trimestre que esta valendo no cadastro e o trimestre em curso. Numero e
    // letra vao em colunas vizinhas para a planilha continuar somavel.
    const ant = dados.trimestreAnterior;
    const atu = dados.trimestreAtual;
    const rotuloAtual = atu.fechado ? atu.rotulo : `${atu.rotulo} (parcial)`;

    await responderRelatorio(
      res,
      {
        titulo: 'Avaliação de fornecedores — IDF',
        emitidoPor: user.nome,
        filtros: [
          {
            rotulo: 'Competência',
            valor: `${MESES[mesSel - 1]}/${anoSel}`,
          },
          {
            rotulo: 'Apuração',
            valor: `${new Date(dados.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(
              dados.periodoFim,
            ).toLocaleDateString('pt-BR')}`,
          },
          {
            rotulo: 'Situação',
            valor: dados.fechada ? 'Fechada' : 'Em aberto',
          },
          {
            rotulo: 'Classe vigente',
            valor: ant.fechado
              ? `${ant.rotulo} (fechado)`
              : `${ant.rotulo} (sem fechamento)`,
          },
        ],
        totais: [
          {
            rotulo: 'Fornecedores avaliados',
            valor: `${avaliados.length} / ${linhas.length}`,
          },
          {
            rotulo: 'IDF médio da competência',
            valor: doisDigitos(mediaIdf(avaliados.map((l) => l.idf))),
          },
          {
            rotulo: `IDF médio ${atu.rotulo}`,
            valor: doisDigitos(
              mediaIdf(linhas.map((l) => l.trimestreAtual?.idf)),
            ),
          },
          { rotulo: 'Em atenção (C)', valor: String(porClasse('C')) },
          { rotulo: 'Críticos (D)', valor: String(porClasse('D')) },
        ],
        colunas: [
          { titulo: 'Código', peso: 34, valor: (l: any) => l.codigo },
          { titulo: 'Fornecedor', peso: 110, valor: (l: any) => l.nome },
          {
            titulo: 'Lotes insp.',
            peso: 28,
            valor: (l: any) => l.lotesInspecionados,
            tipo: 'numero',
          },
          {
            titulo: 'Reprov.',
            peso: 26,
            valor: (l: any) => l.lotesReprovados,
            tipo: 'numero',
          },
          {
            titulo: 'Conformidade',
            peso: 38,
            // Sem lote inspecionado nao ha conformidade: a tela mostra "—" e o
            // papel fica em branco, em vez de anunciar 0%.
            valor: (l: any) =>
              l.lotesInspecionados ? l.pctConformidade : null,
            tipo: 'percentual',
          },
          {
            titulo: 'C1 (50%)',
            peso: 28,
            valor: (l: any) => nota(l, 1),
            tipo: 'numero',
          },
          {
            titulo: 'RNCs',
            peso: 24,
            valor: (l: any) => l.rncsConsideradas,
            tipo: 'numero',
          },
          {
            titulo: 'Resposta (do envio)',
            peso: 40,
            valor: (l: any) => l.horasRespostaMedia,
            tipo: 'numero',
          },
          {
            titulo: 'C2 (30%)',
            peso: 28,
            valor: (l: any) => nota(l, 2),
            tipo: 'numero',
          },
          {
            titulo: 'C3 (20%)',
            peso: 28,
            valor: (l: any) => nota(l, 3),
            tipo: 'numero',
          },
          {
            titulo: 'IDF do mês',
            peso: 30,
            valor: (l: any) => l.idf,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Classe do mês',
            peso: 48,
            valor: (l: any) => textoClasse(l.classificacao),
          },
          {
            titulo: `IDF ${ant.rotulo}`,
            peso: 32,
            valor: (l: any) => l.trimestreAnterior?.idf ?? null,
            tipo: 'numero',
          },
          {
            titulo: `Classe ${ant.rotulo}`,
            peso: 48,
            valor: (l: any) => textoClasse(l.trimestreAnterior?.classificacao),
          },
          {
            titulo: `IDF ${rotuloAtual}`,
            peso: 34,
            valor: (l: any) => l.trimestreAtual?.idf ?? null,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: `Classe ${rotuloAtual}`,
            peso: 48,
            valor: (l: any) => textoClasse(l.trimestreAtual?.classificacao),
          },
          {
            // A acao segue o trimestre em curso: e o desempenho que esta
            // acontecendo, nao o mes solto.
            titulo: 'Ação',
            peso: 92,
            valor: (l: any) =>
              ACAO_CLASSE[l.trimestreAtual?.classificacao] ?? '',
          },
        ],
        linhas,
      },
      formato,
    );
  }

  @Get('consolidado')
  consolidado(@Query('ano') ano?: string) {
    return this.service.consolidado(
      ano ? Number(ano) : this.service.competenciaAtual().ano,
    );
  }

  // Papel e planilha da aba "Anual consolidado": o ano inteiro de uma vez, um
  // fornecedor por linha.
  //
  // Os doze meses e os quatro trimestres saem so com o numero, sem a letra ao
  // lado: a classe se le direto da faixa (>=9 A, >=7 B, >=5 C, abaixo disso D)
  // e duplicar tudo levaria a largura de 22 para 34 colunas. Nos dois
  // resultados do ano, que sao a leitura que interessa, a letra vai junto.
  @Get('consolidado/relatorio')
  async consolidadoRelatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('ano') ano?: string,
  ) {
    const anoSel = ano ? Number(ano) : this.service.competenciaAtual().ano;
    const dados = await this.service.consolidado(anoSel);
    const linhas: any[] = dados.linhas ?? [];
    const resumo = dados.resumo;

    // Mes ainda sem fechamento continua sendo recalculado a cada consulta. O
    // papel diz quais sao, senao quem le acha que o ano todo ja esta congelado.
    const abertos = MESES.filter((_, i) => !dados.mesesFechados?.[i]).map((m) =>
      m.slice(0, 3),
    );

    await responderRelatorio(
      res,
      {
        titulo: `Avaliação de fornecedores — IDF anual consolidado ${anoSel}`,
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Ano', valor: String(anoSel) },
          {
            rotulo: 'Situação',
            valor: dados.anoFechado ? 'Ano fechado' : 'Ano em curso',
          },
          {
            rotulo: 'Meses em aberto',
            valor: abertos.length ? abertos.join(', ') : 'nenhum',
          },
        ],
        totais: [
          { rotulo: 'Fornecedores avaliados', valor: String(resumo.avaliados) },
          {
            rotulo: 'IDF médio do ano',
            valor: doisDigitos(resumo.mediaGeral ?? 0),
          },
          { rotulo: 'Estratégicos (A)', valor: String(resumo.porClasse.A) },
          { rotulo: 'Aprovados (B)', valor: String(resumo.porClasse.B) },
          { rotulo: 'Em atenção (C)', valor: String(resumo.porClasse.C) },
          { rotulo: 'Críticos (D)', valor: String(resumo.porClasse.D) },
        ],
        colunas: [
          { titulo: 'Código', peso: 34, valor: (l: any) => l.codigo },
          { titulo: 'Fornecedor', peso: 110, valor: (l: any) => l.nome },
          ...MESES.map((m, i) => ({
            titulo: m.slice(0, 3),
            peso: 24,
            valor: (l: any) => l.meses?.[i] ?? null,
            tipo: 'numero' as const,
          })),
          ...[1, 2, 3, 4].map((t) => ({
            titulo: `${t}T`,
            peso: 26,
            valor: (l: any) => l.trimestres?.[t - 1] ?? null,
            tipo: 'numero' as const,
          })),
          {
            titulo: 'Anual consolidado',
            peso: 34,
            valor: (l: any) => l.anualConsolidado,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Classe consolidada',
            peso: 52,
            valor: (l: any) => textoClasse(l.classeAnualConsolidado),
          },
          {
            titulo: 'Anual projetado',
            peso: 32,
            valor: (l: any) => l.anualProjetado,
            tipo: 'numero',
          },
          {
            titulo: 'Classe projetada',
            peso: 52,
            valor: (l: any) => textoClasse(l.classeAnualProjetado),
          },
          {
            titulo: 'Ação',
            peso: 92,
            valor: (l: any) => ACAO_CLASSE[l.classeAnualProjetado] ?? '',
          },
        ],
        linhas,
      },
      formato,
    );
  }

  @Get('fornecedor/:id')
  historico(@Param('id', ParseIntPipe) id: number) {
    return this.service.historico(id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Put(':fornecedorId/:ano/:mes')
  salvarNotas(
    @Param('fornecedorId', ParseIntPipe) fornecedorId: number,
    @Param('ano', ParseIntPipe) ano: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Body() dto: NotasManuaisDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.service.salvarNotas(fornecedorId, ano, mes, dto, usuario?.id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('fechar')
  fechar(@Body() dto: CompetenciaDto, @CurrentUser() usuario: AuthUser) {
    return this.service.fechar(dto.ano, dto.mes, usuario?.id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('reabrir')
  reabrir(@Body() dto: CompetenciaDto) {
    return this.service.reabrir(dto.ano, dto.mes);
  }
}
