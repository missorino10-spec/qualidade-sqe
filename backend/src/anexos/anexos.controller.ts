import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { EntidadeModuloGuard } from '../auth/entidade-modulo.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { StorageService } from './storage.service';
import { corrigirNomeArquivo, disposicaoAnexo } from './nome-arquivo';

// Formatos aceitos no anexo, definidos pela Qualidade em 13/09/2026: so os que
// os documentos do sistema usam de verdade. .csv e .xlsm ficaram de fora de
// proposito - o .xlsm carrega macro, que e justamente o que nao se quer
// circulando por anexo. A trava vale somente para envio novo: anexo antigo com
// outra extensao continua listando e baixando como sempre.
//
// A conferencia e pela extensao do nome, e nao pelo mimeType, porque o mimeType
// chega do navegador de quem envia (dado que o usuario controla) e e a extensao
// que decide com que programa o arquivo vai abrir na ponta.
const EXTENSOES_ACEITAS = [
  '.pdf',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
];

// Anexo e uma tabela so para o sistema inteiro. Quem manda no acesso e o
// "entidadeTipo": anexo de RNC exige SQE, de 8D exige Manufatura, e assim por
// diante. Sem isso qualquer pessoa logada baixaria o arquivo de qualquer area.
@UseGuards(JwtAuthGuard, EntidadeModuloGuard)
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
    // Legenda opcional: a foto do desvio visual sobe com o texto do item do
    // checklist que reprovou, e e esse texto que sai embaixo dela no PDF.
    @Query('legenda') legenda: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const idEntidade = Number(entidadeId);
    if (!entidadeTipo || !Number.isInteger(idEntidade)) {
      throw new BadRequestException('Informe entidadeTipo e entidadeId.');
    }

    // O nome vem do multipart em latin-1; sem isso todo acento fica torto.
    const nomeArquivo = corrigirNomeArquivo(file.originalname);

    const extensao = extname(nomeArquivo).toLowerCase();
    if (!EXTENSOES_ACEITAS.includes(extensao)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido${extensao ? ` (${extensao})` : ''}. ` +
          'Envie PDF, Excel (.xls, .xlsx), Word (.doc, .docx) ou imagem (.jpg, .jpeg, .png).',
      );
    }

    // Mesmo formato de nome de antes, para a coluna "caminho" nao mudar.
    const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const nomeNoStorage = `${unico}${extname(nomeArquivo)}`;

    // Grava o arquivo primeiro: se o Storage falhar, nao fica registro orfao
    // no banco apontando para um anexo que nao existe.
    await this.storage.enviar(nomeNoStorage, file.buffer, file.mimetype);

    return this.prisma.anexo.create({
      data: {
        entidadeTipo,
        entidadeId: idEntidade,
        nomeArquivo,
        caminho: nomeNoStorage,
        mimeType: file.mimetype,
        tamanho: file.size,
        legenda: legenda?.trim() || null,
        uploadedById: user.id,
      },
    });
  }

  @Get()
  listar(
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
  ) {
    // Mesma checagem do upload: sem isso um entidadeId vazio ou com letra
    // virava NaN e o erro so aparecia la no Prisma, como 500.
    const id = Number(entidadeId);
    if (!entidadeTipo || !Number.isInteger(id)) {
      throw new BadRequestException('Informe entidadeTipo e entidadeId.');
    }
    return this.prisma.anexo.findMany({
      where: { entidadeTipo, entidadeId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id/download')
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const anexo = await this.prisma.anexo.findUnique({ where: { id } });
    if (!anexo) throw new NotFoundException('Anexo não encontrado');

    const bytes = await this.storage.baixar(anexo.caminho);
    res.set({
      'Content-Type': anexo.mimeType || 'application/octet-stream',
      // O mimeType vem do navegador de quem subiu o arquivo, ou seja, e um dado
      // que o usuario controla. O anexo ja desce como "attachment"; o nosniff
      // fecha a brecha de o navegador adivinhar outro tipo e executar o
      // conteudo no dominio da API.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': disposicaoAnexo(anexo.nomeArquivo),
      'Content-Length': String(bytes.length),
    });
    res.send(bytes);
  }
}
