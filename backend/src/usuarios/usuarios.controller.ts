import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const MODULOS = [
  'SQE',
  'MANUFATURA',
  'SQD',
  'CAD_FORNECEDORES',
  'CAD_ITENS',
  'CAD_MAQUINAS',
  'CAD_INSTRUMENTOS',
];

class AcessoDto {
  @IsIn(MODULOS) modulo: any;
  @IsIn(['VISUALIZAR', 'EDITAR']) nivel: any;
}

class FichaDto {
  @IsOptional() @IsString() matricula?: string | null;
  @IsOptional() @IsString() cargo?: string | null;
  @IsOptional() @IsString() setor?: string | null;
  @IsOptional() @IsString() telefone?: string | null;
  @IsOptional() @IsString() dataAdmissao?: string | null;
}

class CreateUsuarioDto extends FichaDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsOptional() @IsIn(['QUALIDADE', 'PRODUCAO', 'ADMIN']) papel?: any;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcessoDto)
  acessos?: AcessoDto[];
}

class UpdateUsuarioDto extends FichaDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['QUALIDADE', 'PRODUCAO', 'ADMIN']) papel?: any;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

class AcessosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcessoDto)
  acessos: AcessoDto[];
}

// Colaboradores e Acessos e area do admin: nao entra no controle por modulo,
// senao daria para alguem se dar acesso.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.service.create(dto as any);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.service.update(id, dto as any);
  }

  @Put(':id/acessos')
  definirAcessos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcessosDto,
  ) {
    return this.service.definirAcessos(id, dto.acessos as any);
  }

  @Post(':id/resetar-senha')
  resetarSenha(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetarSenha(id);
  }
}
