import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { CnqService } from './cnq.service';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import { semanaAno } from '../../sqe/sqe-utils';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// Espelha a aba "Defeitos e CNQ" da planilha de indicadores.
class CnqDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsInt() tipoDefeitoId?: number;
  // Defeito digitado quando o tipo escolhido e "Outros"
  @IsOptional() @IsString() defeitoOutros?: string;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() valorUnitario?: number;
  // So vem preenchido quando a pessoa digita o total a mao. Sem ele o servico
  // volta a calcular quantidade x valor unitario.
  @IsOptional() @IsNumber() valorTotal?: number;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() acao?: string;
}

// A semana sai do trecho ISO da data, e nao da Date crua: aqui a data pode
// chegar como texto vindo da tela ou como Date vinda do banco, e o trecho ISO
// e o unico jeito de tratar os dois casos do mesmo jeito.
//
// A Date e remontada com Date.UTC porque semanaAno/semanaReferencia leem em
// UTC. Com o construtor local, o lancamento de 28/07 cairia na semana de 27/07
// em qualquer servidor a leste de Greenwich.
function semanaDaData(d?: Date | string | null): string {
  if (!d) return '';
  const iso = (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);
  const [ano, mes, dia] = iso.split('-').map(Number);
  return semanaAno(new Date(Date.UTC(ano, mes - 1, dia))).semana;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/cnq')
export class CnqController {
  constructor(private service: CnqService) {}

  @Get()
  listar(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
  ) {
    return this.service.listar(
      de,
      ate,
      maquinaId ? Number(maquinaId) : undefined,
    );
  }

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
  ) {
    const id = maquinaId ? Number(maquinaId) : undefined;
    const lancamentos = await this.service.listar(de, ate, id);
    // O nome vem do cadastro e nao do primeiro lancamento: o recorte pode nao
    // ter nenhum e ainda assim precisa dizer qual maquina foi escolhida.
    const maquina = id ? await this.service.nomeMaquina(id) : undefined;
    const totalCnq = lancamentos.reduce(
      (t, c) => t + Number(c.valorTotal ?? 0),
      0,
    );
    const totalPecas = lancamentos.reduce(
      (t, c) => t + Number(c.quantidade ?? 0),
      0,
    );
    await responderRelatorio(
      res,
      {
        titulo: 'Custo da Não Qualidade (CNQ)',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          { rotulo: 'Máquina / linha', valor: maquina ?? 'Todas' },
        ],
        totais: [
          {
            rotulo: 'CNQ total',
            valor: `R$ ${totalCnq.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          },
          { rotulo: 'Peças lançadas', valor: totalPecas.toLocaleString('pt-BR') },
          { rotulo: 'Lançamentos', valor: String(lancamentos.length) },
        ],
        colunas: [
          { titulo: 'Número', peso: 52, valor: (c: any) => c.numero },
          { titulo: 'Data', peso: 44, valor: (c: any) => c.data, tipo: 'data' },
          { titulo: 'Semana', peso: 34, valor: (c: any) => semanaDaData(c.data) },
          {
            titulo: 'Máquina / linha',
            peso: 76,
            valor: (c: any) => c.maquina?.nome,
          },
          {
            titulo: 'Item',
            peso: 110,
            valor: (c: any) =>
              [c.itemCodigo, c.itemDescricao].filter(Boolean).join(' — '),
          },
          {
            // O texto digitado em "Outros" acompanha o nome do tipo, como na
            // tela: "Outros" sozinho nao diz qual foi o defeito.
            titulo: 'Descrição do defeito',
            peso: 96,
            valor: (c: any) =>
              [c.tipoDefeito?.nome, c.defeitoOutros].filter(Boolean).join(' — '),
          },
          {
            titulo: 'Qtd.',
            peso: 32,
            valor: (c: any) => c.quantidade,
            tipo: 'numero',
          },
          {
            titulo: 'Valor unit.',
            peso: 52,
            valor: (c: any) => c.valorUnitario,
            tipo: 'moeda',
          },
          {
            titulo: 'CNQ (R$)',
            peso: 58,
            valor: (c: any) => c.valorTotal,
            tipo: 'moeda',
            negrito: true,
          },
          { titulo: 'Ação', peso: 96, valor: (c: any) => c.acao },
          { titulo: 'Observações', peso: 96, valor: (c: any) => c.observacoes },
        ],
        linhas: lancamentos,
      },
      formato,
    );
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: CnqDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CnqDto) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
