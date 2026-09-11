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
        ],
        totais: [
          {
            rotulo: 'Fornecedores avaliados',
            valor: `${avaliados.length} / ${linhas.length}`,
          },
          {
            rotulo: 'IDF médio da competência',
            valor: (avaliados.length
              ? avaliados.reduce((s, l) => s + l.idf, 0) / avaliados.length
              : 0
            ).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          },
          { rotulo: 'Em atenção (C)', valor: String(porClasse('C')) },
          { rotulo: 'Críticos (D)', valor: String(porClasse('D')) },
        ],
        colunas: [
          { titulo: 'Código', peso: 40, valor: (l: any) => l.codigo },
          { titulo: 'Fornecedor', peso: 130, valor: (l: any) => l.nome },
          {
            titulo: 'Lotes insp.',
            peso: 35,
            valor: (l: any) => l.lotesInspecionados,
            tipo: 'numero',
          },
          {
            titulo: 'Reprov.',
            peso: 30,
            valor: (l: any) => l.lotesReprovados,
            tipo: 'numero',
          },
          {
            titulo: 'Conformidade',
            peso: 45,
            // Sem lote inspecionado nao ha conformidade: a tela mostra "—" e o
            // papel fica em branco, em vez de anunciar 0%.
            valor: (l: any) =>
              l.lotesInspecionados ? l.pctConformidade : null,
            tipo: 'percentual',
          },
          {
            titulo: 'C1 (50%)',
            peso: 35,
            valor: (l: any) => nota(l, 1),
            tipo: 'numero',
          },
          {
            titulo: 'RNCs',
            peso: 28,
            valor: (l: any) => l.rncsConsideradas,
            tipo: 'numero',
          },
          {
            titulo: 'Resposta (do envio)',
            peso: 50,
            valor: (l: any) => l.horasRespostaMedia,
            tipo: 'numero',
          },
          {
            titulo: 'C2 (30%)',
            peso: 35,
            valor: (l: any) => nota(l, 2),
            tipo: 'numero',
          },
          {
            titulo: 'C3 (20%)',
            peso: 35,
            valor: (l: any) => nota(l, 3),
            tipo: 'numero',
          },
          {
            titulo: 'IDF',
            peso: 35,
            valor: (l: any) => l.idf,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Classificação',
            peso: 75,
            valor: (l: any) =>
              l.classificacao
                ? `${l.classificacao} — ${ROTULO_CLASSE[l.classificacao]}`
                : '',
          },
          {
            titulo: 'Ação',
            peso: 110,
            valor: (l: any) => ACAO_CLASSE[l.classificacao] ?? '',
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
