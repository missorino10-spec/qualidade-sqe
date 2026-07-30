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
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { CnqService } from './cnq.service';

// Espelha a aba "Defeitos e CNQ" da planilha de indicadores.
class CnqDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsInt() tipoDefeitoId?: number;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() acao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
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
