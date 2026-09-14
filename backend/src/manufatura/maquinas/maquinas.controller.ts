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
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { MaquinasService } from './maquinas.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { responderRelatorio } from '../../comum/relatorio-lista';
import { calcularPpm } from '../manufatura-utils';

// O recorte desta tela e o mes inteiro, e nao um par De-Ate: a grade de
// apontamento e mensal, como as abas da planilha.
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

// Abreviacao do dia da semana como a tela escreve ("05/09 sex").
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const ROTULO_AREA: Record<string, string> = {
  FABRICACAO: 'Fabricação',
  MONTAGEM: 'Montagem',
};

class MaquinaDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsIn(['FABRICACAO', 'MONTAGEM']) area?: any;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

class ProducaoDto {
  @IsString() data: string;
  @IsOptional() @IsNumber() qtdProduzida?: number;
  @IsOptional() @IsNumber() qtdDefeito?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.CAD_MAQUINAS, { leituraLivre: true })
@Controller('maquinas')
export class MaquinasController {
  constructor(private service: MaquinasService) {}

  @Get()
  listar(@Query('area') area?: string, @Query('todas') todas?: string) {
    return this.service.listar(area, todas === 'true');
  }

  // Precisa vir ANTES de @Get(':id'), senao "producao" cai na rota do id.
  @Get('producao/resumo')
  resumoProducao(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    const hoje = new Date();
    return this.service.resumoMensal(
      ano ? Number(ano) : hoje.getFullYear(),
      mes ? Number(mes) : hoje.getMonth() + 1,
    );
  }

  // Relatorio do mes que a tela esta mostrando, em PDF ou planilha. Tambem
  // precisa vir antes de ':id'.
  @Get('producao/relatorio')
  async relatorioProducao(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    const hoje = new Date();
    const a = ano ? Number(ano) : hoje.getFullYear();
    const m = mes ? Number(mes) : hoje.getMonth() + 1;
    const resumo = await this.service.resumoMensal(a, m);
    await responderRelatorio(
      res,
      {
        titulo: 'Produção Diária e PPM',
        emitidoPor: user.nome,
        filtros: [{ rotulo: 'Mês', valor: `${MESES[m - 1]} de ${a}` }],
        // Os mesmos tres numeros do topo da tela.
        totais: [
          {
            rotulo: 'Produzidas no mês',
            valor: resumo.pecasProduzidas.toLocaleString('pt-BR'),
          },
          {
            rotulo: 'Peças com defeito',
            valor: resumo.pecasComDefeito.toLocaleString('pt-BR'),
          },
          { rotulo: 'PPM do mês', valor: resumo.ppm.toLocaleString('pt-BR') },
        ],
        colunas: [
          { titulo: 'Código', peso: 60, valor: (l: any) => l.codigo },
          { titulo: 'Máquina / linha', peso: 150, valor: (l: any) => l.nome },
          {
            titulo: 'Área',
            peso: 70,
            valor: (l: any) => ROTULO_AREA[l.area] ?? l.area,
          },
          {
            titulo: 'Produzidas',
            peso: 66,
            valor: (l: any) => l.pecasProduzidas,
            tipo: 'numero',
          },
          {
            titulo: 'Com defeito',
            peso: 66,
            valor: (l: any) => l.pecasComDefeito,
            tipo: 'numero',
          },
          {
            titulo: 'PPM',
            peso: 60,
            valor: (l: any) => l.ppm,
            tipo: 'numero',
            negrito: true,
          },
          {
            // Mostra o que ainda falta lancar, como o tag da tela.
            titulo: 'Dias apontados',
            peso: 66,
            valor: (l: any) => `${l.diasApontados} de ${resumo.diasNoMes}`,
          },
        ],
        linhas: resumo.linhas,
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
  criar(@Body() dto: MaquinaDto) {
    return this.service.criar(dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: MaquinaDto) {
    return this.service.atualizar(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }

  @Get(':id/producao')
  producao(
    @Param('id', ParseIntPipe) id: number,
    @Query('ano') ano: string,
    @Query('mes') mes: string,
  ) {
    const hoje = new Date();
    return this.service.producaoDoMes(
      id,
      ano ? Number(ano) : hoje.getFullYear(),
      mes ? Number(mes) : hoje.getMonth() + 1,
    );
  }

  // Relatorio de uma maquina so, dia a dia - o mesmo que a tela mostra depois
  // de entrar na maquina. O servico devolve apenas os dias que tem apontamento;
  // aqui o mes e preenchido por inteiro, igual a grade da tela, para que o dia
  // em branco apareca no papel como dia sem lancamento.
  @Get(':id/producao/relatorio')
  async relatorioProducaoMaquina(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
  ) {
    const hoje = new Date();
    const a = ano ? Number(ano) : hoje.getFullYear();
    const m = mes ? Number(mes) : hoje.getMonth() + 1;
    const [maquina, producao] = await Promise.all([
      this.service.detalhe(id),
      this.service.producaoDoMes(id, a, m),
    ]);

    const apontado = new Map(
      producao.dias.map((d) => [new Date(d.data).getUTCDate(), d]),
    );
    const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const linhas = Array.from({ length: diasNoMes }, (_, i) => {
      const dia = i + 1;
      const d = apontado.get(dia);
      const produzidas = d?.qtdProduzida ?? 0;
      const defeitos = d?.qtdDefeito ?? 0;
      return {
        dia: `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')} ${
          DIAS_SEMANA[new Date(Date.UTC(a, m - 1, dia)).getUTCDay()]
        }`,
        lancado: d != null,
        qtdProduzida: d ? produzidas : null,
        qtdDefeito: d ? defeitos : null,
        // Dia sem producao nao tem PPM: a tela mostra "-" e aqui fica vazio.
        ppm: produzidas ? calcularPpm(produzidas, defeitos) : null,
      };
    });

    await responderRelatorio(
      res,
      {
        titulo: 'Produção Diária e PPM — lançamento diário',
        emitidoPor: user.nome,
        filtros: [
          {
            rotulo: 'Máquina',
            valor: `${maquina.codigo} — ${maquina.nome}`,
          },
          {
            rotulo: 'Área',
            valor: ROTULO_AREA[maquina.area] ?? maquina.area,
          },
          { rotulo: 'Mês', valor: `${MESES[m - 1]} de ${a}` },
        ],
        // Os mesmos tres numeros do topo da tela da maquina.
        totais: [
          {
            rotulo: 'Produzidas no mês',
            valor: producao.pecasProduzidas.toLocaleString('pt-BR'),
          },
          {
            rotulo: 'Peças com defeito',
            valor: producao.pecasComDefeito.toLocaleString('pt-BR'),
          },
          { rotulo: 'PPM do mês', valor: producao.ppm.toLocaleString('pt-BR') },
          {
            rotulo: 'Dias apontados',
            valor: `${producao.dias.length} de ${diasNoMes}`,
          },
        ],
        colunas: [
          { titulo: 'Dia', peso: 90, valor: (l: any) => l.dia },
          {
            titulo: 'Qtd. produzida',
            peso: 90,
            valor: (l: any) => l.qtdProduzida,
            tipo: 'numero',
          },
          {
            titulo: 'Qtd. com defeito',
            peso: 90,
            valor: (l: any) => l.qtdDefeito,
            tipo: 'numero',
          },
          {
            titulo: 'PPM do dia',
            peso: 80,
            valor: (l: any) => l.ppm,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Situação',
            peso: 90,
            valor: (l: any) => (l.lancado ? 'Lançado' : 'Sem lançamento'),
          },
        ],
        linhas,
      },
      formato,
    );
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/producao')
  salvarProducao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProducaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.salvarProducao(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id/producao/:producaoId')
  removerProducao(
    @Param('id', ParseIntPipe) id: number,
    @Param('producaoId', ParseIntPipe) producaoId: number,
  ) {
    return this.service.removerProducao(id, producaoId);
  }
}
