import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class UpdatePeriodicidadeDto {
  @IsOptional() @IsString() periodicidadeTexto?: string;
  @IsOptional() @Type(() => Number) @IsInt() frequenciaN?: number;
  @IsOptional() @IsString() tipoInspecao?: string;
  @IsOptional() @IsString() nivelInspecaoTexto?: string;
  @IsOptional() @IsString() nivelRomano?: string;
  @IsOptional() @Type(() => Number) @IsInt() percentualAmostra?: number;
  @IsOptional() @Type(() => Number) @IsNumber() nqa?: number;
  @IsOptional() @Type(() => Number) @IsNumber() conformidadeMin?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('periodicidade')
export class PeriodicidadeController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.periodicidadeConfig.findMany({
      orderBy: { classificacao: 'asc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':classificacao')
  update(
    @Param('classificacao') classificacao: string,
    @Body() dto: UpdatePeriodicidadeDto,
  ) {
    return this.prisma.periodicidadeConfig.update({
      where: { classificacao: classificacao as any },
      data: dto,
    });
  }
}
