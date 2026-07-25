import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspecoesService } from './inspecoes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

const ORIGENS = [
  'PLANO_INSPECAO',
  'HOMOLOGACAO',
  'DEVOLUCAO',
  'RETRABALHO',
  'RELATORIO_OCORRENCIA',
  'OUTROS',
];

class CabecalhoDto {
  @IsOptional() @Type(() => Number) @IsInt() entregaId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() toleranciasNorm?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdInspecionada?: number;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
  @IsOptional() @IsString() relatorioNumero?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: any;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsIn(['APROVADO', 'REPROVADO']) resultado?: any;
  @IsOptional() @IsString() dataInspecao?: string;
  @IsOptional() @IsString() disposicao?: string;
}

class CreateVisualDto extends CabecalhoDto {
  @IsOptional() @IsArray() checklist?: any[];
}

class CreateLoteDto extends CabecalhoDto {
  @IsOptional() @IsArray() cotas?: any[];
  @IsOptional() @IsBoolean() encadeadoAposVisual?: boolean;
}

class RecebimentoDto {
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspecoes')
export class InspecoesController {
  constructor(
    private service: InspecoesService,
    private prisma: PrismaService,
  ) {}

  // Template do checklist visual (12 grupos)
  @Get('template-visual')
  templateVisual() {
    return this.service.templateVisual();
  }

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.service.listarTodas(
      fornecedorId ? Number(fornecedorId) : undefined,
    );
  }

  // Avalia se o fornecedor deve ser inspecionado nesta entrega
  @Get('avaliar')
  avaliar(@Query('fornecedorId', ParseIntPipe) fornecedorId: number) {
    return this.service.avaliarRecebimento(fornecedorId);
  }

  // Registra recebimento sem inspecao (ciclo de periodicidade nao exige)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('recebimento')
  recebimento(@Body() dto: RecebimentoDto, @CurrentUser() user: AuthUser) {
    return this.service.registrarRecebimento(dto, user.id);
  }

  @Get('visual/:id')
  async findVisual(@Param('id', ParseIntPipe) id: number) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, nome: true, codigo: true } },
        item: { select: { id: true, descricao: true, codigo: true } },
        inspetor: { select: { id: true, nome: true } },
        rncs: { select: { id: true, numero: true, status: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    return { ...insp, tipoFormulario: 'VISUAL' };
  }

  @Get('lote/:id')
  async findLote(@Param('id', ParseIntPipe) id: number) {
    const insp = await this.prisma.inspecaoLote.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, nome: true, codigo: true } },
        item: { select: { id: true, descricao: true, codigo: true } },
        inspetor: { select: { id: true, nome: true } },
        rncs: { select: { id: true, numero: true, status: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    return { ...insp, tipoFormulario: 'LOTE' };
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('visual')
  criarVisual(@Body() dto: CreateVisualDto, @CurrentUser() user: AuthUser) {
    return this.service.criarVisual(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('lote')
  criarLote(@Body() dto: CreateLoteDto, @CurrentUser() user: AuthUser) {
    return this.service.criarLote(dto, user.id);
  }

  // Exclusao permanente - restrito a ADMIN.
  // cascade=true tambem apaga as RNCs vinculadas.
  @Roles('ADMIN')
  @Delete('visual/:id')
  deletarVisual(
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade') cascade?: string,
  ) {
    return this.service.deletarVisual(id, cascade === 'true');
  }

  @Roles('ADMIN')
  @Delete('lote/:id')
  deletarLote(
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade') cascade?: string,
  ) {
    return this.service.deletarLote(id, cascade === 'true');
  }
}
