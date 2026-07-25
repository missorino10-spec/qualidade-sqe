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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('anexos')
export class AnexosController {
  constructor(private prisma: PrismaService) {}

  // Upload: /api/anexos?entidadeTipo=RNC&entidadeId=1  (multipart, campo "file")
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unico}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    if (!entidadeTipo || !entidadeId) {
      throw new BadRequestException('entidadeTipo e entidadeId obrigatorios');
    }
    return this.prisma.anexo.create({
      data: {
        entidadeTipo,
        entidadeId: Number(entidadeId),
        nomeArquivo: file.originalname,
        caminho: file.filename,
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
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');
    const caminhoAbs = join(UPLOAD_DIR, anexo.caminho);
    if (!existsSync(caminhoAbs)) {
      throw new NotFoundException('Arquivo fisico nao encontrado');
    }
    res.download(caminhoAbs, anexo.nomeArquivo);
  }
}
