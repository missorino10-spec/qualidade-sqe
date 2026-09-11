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
import { IsInt, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { AlertasService } from './alertas.service';
import { gerarPdfAlerta } from './alerta-pdf';
import { StorageService } from '../../anexos/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  bytesDasFotos,
  carregarFotosEvidencia,
} from '../../comum/fotos-evidencia';
import { EVID } from '../../comum/inspecao';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import {
  alertaEmAberto,
  alertaVencido,
  diasParaPrazo,
  labelStatusAlerta,
  situacaoAlerta,
} from '../../comum/alerta';

// A mesma leitura que a tela mostra embaixo do prazo. So vale enquanto o
// alerta esta em aberto: alerta encerrado fora do prazo nao fica "atrasado".
function leituraPrazo(a: {
  status?: string | null;
  prazo?: string | Date | null;
}): string {
  const dias = diasParaPrazo(a.prazo);
  if (!alertaEmAberto(a.status) || dias === null) return '';
  if (dias < 0) return `${Math.abs(dias)} dia(s) de atraso`;
  return dias === 0 ? 'Vence hoje' : `Faltam ${dias} dia(s)`;
}

// Espelha o formulario "Alerta da Qualidade" (.docx).
class AlertaDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() acao?: string;
  @IsOptional() @IsString() setor?: string;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsString() legendaErrado?: string;
  @IsOptional() @IsString() legendaCerto?: string;
  @IsOptional() @IsString() prazo?: string;
  // "Elaborado por" nao vem mais do formulario: o sistema assina com o usuario
  // logado.
}

class RenovacaoDto {
  @IsOptional() @IsString() prazo?: string;
  @IsOptional() @IsString() motivo?: string;
}

class EncerramentoDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsString() observacao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/alertas')
export class AlertasController {
  constructor(
    private service: AlertasService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  listar(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listar(
      de,
      ate,
      maquinaId ? Number(maquinaId) : undefined,
      status,
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
    @Query('status') status?: string,
  ) {
    const id = maquinaId ? Number(maquinaId) : undefined;
    const alertas = await this.service.listar(de, ate, id, status);
    const maquina = id ? await this.service.nomeMaquina(id) : undefined;
    await responderRelatorio(
      res,
      {
        titulo: 'Alertas da Qualidade',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          { rotulo: 'Máquina / linha', valor: maquina ?? 'Todas' },
          {
            rotulo: 'Situação',
            valor: status ? (labelStatusAlerta[status] ?? status) : 'Todas',
          },
        ],
        // Os mesmos tres numeros do topo da tela.
        totais: [
          {
            rotulo: 'Alertas em aberto',
            valor: String(alertas.filter((a) => alertaEmAberto(a.status)).length),
          },
          {
            rotulo: 'Vencidos',
            valor: String(alertas.filter((a) => alertaVencido(a)).length),
          },
          { rotulo: 'Total no filtro', valor: String(alertas.length) },
        ],
        colunas: [
          { titulo: 'Número', peso: 52, valor: (a: any) => a.numero },
          { titulo: 'Data', peso: 44, valor: (a: any) => a.data, tipo: 'data' },
          {
            titulo: 'Descrição do problema',
            peso: 150,
            valor: (a: any) => a.titulo,
          },
          {
            titulo: 'Onde se aplica',
            peso: 90,
            valor: (a: any) =>
              [a.setor, a.maquina?.nome].filter(Boolean).join(' — '),
          },
          {
            titulo: 'Prazo para corrigir',
            peso: 50,
            valor: (a: any) => a.prazo,
            tipo: 'data',
          },
          // A leitura do prazo acompanha a data, como na tela: "3 dia(s) de
          // atraso" diz mais do que a data sozinha.
          { titulo: 'Prazo', peso: 56, valor: (a: any) => leituraPrazo(a) },
          {
            titulo: 'Ação imediata',
            peso: 130,
            valor: (a: any) => a.acao,
          },
          {
            titulo: 'Situação',
            peso: 50,
            valor: (a: any) => situacaoAlerta(a).texto,
            negrito: true,
          },
        ],
        linhas: alertas,
      },
      formato,
    );
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  // Cartaz do alerta, com as fotos dos dois paineis.
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const alerta = await this.service.detalhe(id);
    const [errado, certo] = await Promise.all([
      carregarFotosEvidencia(this.prisma, this.storage, EVID.alertaErrado, id),
      carregarFotosEvidencia(this.prisma, this.storage, EVID.alertaCerto, id),
    ]);
    const nomeArquivo = `${(alerta.numero ?? `alerta-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfAlerta(alerta, {
      errado: bytesDasFotos(errado),
      certo: bytesDasFotos(certo),
    });
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: AlertaDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlertaDto) {
    return this.service.atualizar(id, dto);
  }

  // Renovar: prorroga o prazo e guarda o anterior no historico.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/renovar')
  renovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenovacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.renovar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/encerrar')
  encerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncerramentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.encerrar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/reabrir')
  reabrir(@Param('id', ParseIntPipe) id: number) {
    return this.service.reabrir(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
