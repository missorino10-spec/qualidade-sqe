import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../auth/modulo.decorator';
import { PermissaoGuard } from '../auth/permissao.guard';

class ContatoDto {
  @IsString() nome: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() funcao?: string;
}

class FornecedorDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() tipoFornecimento?: string;
  @IsOptional() @IsString() categoriaInspecao?: string;
  @IsOptional() @IsString() planoInspecao?: string;
  @IsOptional() @IsString() controlesPrincipais?: string;
  @IsOptional() @IsString() escopoTexto?: string;
  @IsOptional() @IsIn(['BAIXO', 'MEDIO', 'ALTO']) esforcoQualidade?: any;
  @IsOptional() @IsIn(['A', 'B', 'C', 'D']) classificacaoFornecimento?: any;
  @IsOptional() @IsBoolean() fazVisual?: boolean;
  @IsOptional() @IsBoolean() fazLote?: boolean;
  // Cadastro pontual (ex: importacao): fica fora do plano de periodicidade.
  @IsOptional() @IsBoolean() eventual?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContatoDto)
  contatos?: ContatoDto[];
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.CAD_FORNECEDORES, {
  leituraLivre: true,
  criacaoLivrePara: [ModuloSistema.SQE, ModuloSistema.SQD],
})
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private prisma: PrismaService) {}

  // A classificacao do cadastro e a mesma que o painel do SQE aplica ao fechar
  // o trimestre. Para a tela nao ficar com um A/B/C/D sem explicacao, cada
  // fornecedor vem com a ULTIMA apuracao trimestral do historico: e assim que
  // se ve se o valor veio do desempenho ou de uma edicao manual.
  @Get()
  async findAll() {
    const [fornecedores, historico] = await Promise.all([
      this.prisma.fornecedor.findMany({
        orderBy: { nome: 'asc' },
        include: { contatos: true },
      }),
      this.prisma.historicoClassificacao.findMany({
        // So o fechamento TRIMESTRAL ("3T/2026") reclassifica. O historico tem
        // registros antigos por mes ("2026-09") e por trimestre fiscal
        // ("FY26-Q3"), de regras que nao valem mais: eles ficam guardados, mas
        // nao explicam a classe de hoje.
        where: { trimestreFiscal: { contains: 'T/' } },
        orderBy: { createdAt: 'desc' },
        select: {
          fornecedorId: true,
          trimestreFiscal: true,
          classificacaoApurada: true,
          createdAt: true,
        },
      }),
    ]);
    const ultima = new Map<number, (typeof historico)[number]>();
    for (const h of historico)
      if (!ultima.has(h.fornecedorId)) ultima.set(h.fornecedorId, h);

    return fornecedores.map((f) => {
      const h = ultima.get(f.id);
      return {
        ...f,
        ultimaApuracao: h
          ? {
              periodo: h.trimestreFiscal,
              classe: h.classificacaoApurada,
              em: h.createdAt,
            }
          : null,
      };
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.fornecedor.findUnique({
      where: { id },
      include: { contatos: true },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: FornecedorDto) {
    const { contatos, ...rest } = dto;
    return this.prisma.fornecedor.create({
      data: {
        codigo: rest.codigo!,
        nome: rest.nome!,
        cnpj: rest.cnpj,
        endereco: rest.endereco,
        tipoFornecimento: rest.tipoFornecimento,
        categoriaInspecao: rest.categoriaInspecao,
        planoInspecao: rest.planoInspecao,
        controlesPrincipais: rest.controlesPrincipais,
        escopoTexto: rest.escopoTexto,
        esforcoQualidade: rest.esforcoQualidade ?? 'MEDIO',
        classificacaoFornecimento: rest.classificacaoFornecimento ?? 'C',
        fazVisual: rest.fazVisual ?? true,
        fazLote: rest.fazLote ?? false,
        eventual: rest.eventual ?? false,
        contatos: contatos?.length
          ? { create: contatos.slice(0, 2) }
          : undefined,
      },
      include: { contatos: true },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FornecedorDto,
  ) {
    const { contatos, ...rest } = dto;
    // Substitui os contatos (ate 2) se enviados
    if (contatos) {
      await this.prisma.contato.deleteMany({ where: { fornecedorId: id } });
    }
    return this.prisma.fornecedor.update({
      where: { id },
      data: {
        ...rest,
        contatos: contatos?.length
          ? { create: contatos.slice(0, 2) }
          : undefined,
      },
      include: { contatos: true },
    });
  }

  // Excluir de verdade e so do ADMIN. Fornecedor com inspecao, RNC ou
  // homologacao apontando para ele nao sai: o banco recusa e a tela mostra o
  // motivo, o caminho nesse caso e inativar.
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.contato.deleteMany({ where: { fornecedorId: id } });
      await this.prisma.fornecedor.delete({ where: { id } });
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Fornecedor não encontrado');
      if (e?.code === 'P2003')
        throw new BadRequestException(
          'Este fornecedor já está sendo usado em outros registros e não pode ser excluído. Use "Inativar".',
        );
      throw e;
    }
  }
}
