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
  UseGuards,
} from '@nestjs/common';
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

@UseGuards(JwtAuthGuard, RolesGuard)
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
