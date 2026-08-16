import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
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
import type { Response } from 'express';
import { InspecoesService } from './inspecoes.service';
import { gerarPdfInspecao } from './inspecao-pdf';
import { StorageService } from '../../anexos/storage.service';
import { carregarFotosEvidencia } from '../../comum/fotos-evidencia';
import { EVID, ORIGENS_RECEBIMENTO } from '../../comum/inspecao';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

// O SQE oferta todas as origens menos a inspecao de producao, que so existe
// na Manufatura.
const ORIGENS = ORIGENS_RECEBIMENTO.map((o) => o.value);

class CabecalhoDto {
  @IsOptional() @Type(() => Number) @IsInt() entregaId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() desenho?: string;
  @IsOptional() @IsString() revisao?: string;
  @IsOptional() @IsString() toleranciasNorm?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdInspecionada?: number;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
  // Inspecao fora do plano de periodicidade (fornecedor eventual ou pedido
  // pontual da Qualidade). O numero do relatorio nao vem do formulario: e o
  // proprio numero da inspecao (INSP0001/2026), atribuido no servico.
  @IsOptional() @IsBoolean() extra?: boolean;
  @IsOptional() @IsIn(ORIGENS) origem?: any;
  // Texto do campo "Outros:" - so vale quando origem = OUTROS.
  @IsOptional() @IsString() origemOutros?: string;
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
    private storage: StorageService,
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

  // Detalhe da inspecao (um recebimento) com os formularios como foram
  // preenchidos. Declarado depois das rotas literais para nao captura-las.
  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  // Relatorio de inspecao em PDF - vale para aprovada ou reprovada, e o
  // mesmo documento.
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const insp = await this.service.detalhe(id);
    // Dois blocos independentes de evidencia: um por formulario.
    const [fotosVisual, fotosDimensional] = await Promise.all([
      carregarFotosEvidencia(
        this.prisma,
        this.storage,
        EVID.sqeVisual,
        insp.visual?.id,
      ),
      carregarFotosEvidencia(
        this.prisma,
        this.storage,
        EVID.sqeDimensional,
        insp.lote?.id,
      ),
    ]);
    const numero = insp.numeroInspecao ?? `recebimento-${id}`;
    const nomeArquivo = `${numero.replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfInspecao(insp, fotosVisual, fotosDimensional);
    doc.pipe(res);
    doc.end();
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
