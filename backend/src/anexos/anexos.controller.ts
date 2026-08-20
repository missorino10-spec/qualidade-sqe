import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { StorageService } from './storage.service';
import { corrigirNomeArquivo, disposicaoAnexo } from './nome-arquivo';

@UseGuards(JwtAuthGuard)
@Controller('anexos')
export class AnexosController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // Upload: /api/anexos?entidadeTipo=RNC&entidadeId=1  (multipart, campo "file")
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    if (!entidadeTipo || !entidadeId) {
      throw new BadRequestException('Informe entidadeTipo e entidadeId.');
    }

    // O nome vem do multipart em latin-1; sem isso todo acento fica torto.
    const nomeArquivo = corrigirNomeArquivo(file.originalname);

    // Mesmo formato de nome de antes, para a coluna "caminho" nao mudar.
    const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const nomeNoStorage = `${unico}${extname(nomeArquivo)}`;

    // Grava o arquivo primeiro: se o Storage falhar, nao fica registro orfao
    // no banco apontando para um anexo que nao existe.
    await this.storage.enviar(nomeNoStorage, file.buffer, file.mimetype);

    return this.prisma.anexo.create({
      data: {
        entidadeTipo,
        entidadeId: Number(entidadeId),
        nomeArquivo,
        caminho: nomeNoStorage,
        mimeType: file.mimetype,
        tamanho: file.size,
        uploadedById: user.id,
      },
    });
  }

  @Get()
  listar(
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
  ) {
    return this.prisma.anexo.findMany({
      where: { entidadeTipo, entidadeId: Number(entidadeId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const anexo = await this.prisma.anexo.findUnique({
      where: { id: Number(id) },
    });
    if (!anexo) throw new NotFoundException('Anexo não encontrado');

    const bytes = await this.storage.baixar(anexo.caminho);
    res.set({
      'Content-Type': anexo.mimeType || 'application/octet-stream',
      'Content-Disposition': disposicaoAnexo(anexo.nomeArquivo),
      'Content-Length': String(bytes.length),
    });
    res.send(bytes);
  }
}
