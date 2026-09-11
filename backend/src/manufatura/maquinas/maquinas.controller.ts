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
