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
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { HomologacoesService } from './homologacoes.service';

// Cabecalho do FMR.024.03 + questionario + controle do FMR.029.01.
// Todos os campos do controle sao opcionais: a homologacao nasce com a
// autoavaliacao e o controle vai sendo preenchido depois.
class HomologacaoDto {
  @IsOptional() @IsString() fornecedorNome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoEstadual?: string;
  @IsOptional() @IsString() responsavelInfo?: string;
  @IsOptional() @IsString() setor?: string;
  @IsOptional() @IsString() dataAvaliacao?: string;

  // { "A1": "SIM", "A2": "NAO", ... }
  @IsOptional() @IsObject() respostas?: Record<string, string>;

  @IsOptional() @IsString() codigoFornecedor?: string;
  @IsOptional()
  @IsIn(['COMPRAS', 'ENGENHARIA', 'NC'])
  solicitante?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() escopoFornecedor?: string;
  @IsOptional() @IsString() processosTerceirizados?: string;
  @IsOptional() @IsString() dataSolicitacao?: string;
  @IsOptional() @IsString() dataEnvioRelatorio?: string;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO'])
  statusHomologacao?: string;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO', 'NAO_APLICAVEL'])
  statusPlanoAcao?: string;
  @IsOptional() @IsString() dataReavaliacao?: string;
  @IsOptional()
  @IsIn([
    'NAO_APLICAVEL_CANCELADO',
    'NAO_IMPLEMENTADO_ATRASADO',
    'EFETIVO',
    'PARCIALMENTE_EFETIVO',
    'INEFICAZ',
  ])
  efetividadePlanoAcao?: string;
  @IsOptional() @IsString() acao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sqd/homologacoes')
export class HomologacoesController {
  constructor(private service: HomologacoesService) {}

  // Catalogo das perguntas (blocos, pesos e pontos) para montar a tela.
  @Get('formulario')
  formulario() {
    return this.service.formulario();
  }

  @Get()
  listar(@Query('ano') ano?: string) {
    return this.service.listar(ano ? Number(ano) : undefined);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: HomologacaoDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HomologacaoDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
