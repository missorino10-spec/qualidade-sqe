import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateItemDto {
  @IsString() codigo: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

class UpdateItemDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('itens')
export class ItensController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.prisma.item.findMany({
      where: fornecedorId ? { fornecedorId: Number(fornecedorId) } : undefined,
      include: { fornecedor: { select: { id: true, nome: true } } },
      orderBy: { descricao: 'asc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.prisma.item.update({ where: { id }, data: dto });
  }
}
