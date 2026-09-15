import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ModuloSistema } from '@prisma/client';
import { ImportacaoService } from './importacao.service';
import { acharCadastro, CADASTROS } from './importacao.definicoes';

// ---------------------------------------------------------------------------
// Tres rotas, iguais para os cinco cadastros:
//
//   GET  /importacao/:cadastro/modelo   -> baixa a planilha ja preenchida
//   POST /importacao/:cadastro/previa   -> devolve o que vai acontecer
//   POST /importacao/:cadastro/aplicar  -> grava
//
// O arquivo e enviado de novo na confirmacao de proposito: o servidor nao
// guarda nada entre a previa e a gravacao, entao nao existe "confirmei uma
// previa que ja nao vale mais".
//
// Quem pode: ADMIN sempre; quem nao e ADMIN precisa de EDITAR em TODOS os
// modulos. Importar mexe no cadastro inteiro de uma vez - e mais do que o botao
// "Novo" faz, e por isso exige mais do que ele. Colaboradores e Acessos e area
// exclusiva do ADMIN, como ja e na tela.
// ---------------------------------------------------------------------------

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const arquivoXlsx = FileInterceptor('arquivo', {
  storage: memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx') {
      cb(
        new BadRequestException(
          'Envie a planilha no formato .xlsx (Excel). Arquivo recebido: ' + ext,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
});

@UseGuards(JwtAuthGuard)
@Controller('importacao')
export class ImportacaoController {
  constructor(
    private service: ImportacaoService,
    private prisma: PrismaService,
  ) {}

  private achar(chave: string) {
    const cad = acharCadastro(chave);
    if (!cad) throw new NotFoundException('Cadastro não existe: ' + chave);
    return cad;
  }

  private async conferirPermissao(user: AuthUser, chave: string) {
    const cad = this.achar(chave);
    if (user.papel === 'ADMIN') return cad;
    if (cad.modulo === null) {
      throw new ForbiddenException(
        'Só o administrador pode importar colaboradores e acessos.',
      );
    }
    const acessos = await this.prisma.acessoModulo.findMany({
      where: { usuarioId: user.id, nivel: 'EDITAR' },
      select: { modulo: true },
    });
    const todos = Object.values(ModuloSistema);
    if (acessos.length < todos.length) {
      throw new ForbiddenException(
        'Importar planilha exige perfil de administrador ou acesso de edição ' +
          'em todos os módulos.',
      );
    }
    return cad;
  }

  /**
   * Alimenta a tela: quais cadastros este usuário pode importar. Quem não pode
   * nem vê o botão - o bloqueio de verdade continua sendo o das outras rotas.
   */
  @Get()
  async disponiveis(@CurrentUser() user: AuthUser) {
    const lista: { chave: string; titulo: string; podeInativar: boolean }[] = [];
    for (const c of CADASTROS) {
      try {
        await this.conferirPermissao(user, c.chave);
        lista.push({
          chave: c.chave,
          titulo: c.titulo,
          podeInativar: c.podeInativar,
        });
      } catch {
        // sem permissao neste cadastro
      }
    }
    return { cadastros: lista };
  }

  @Get(':cadastro/modelo')
  async modelo(
    @Param('cadastro') chave: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const cad = await this.conferirPermissao(user, chave);
    const buffer = await this.service.montarModelo(cad);
    const hoje = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cad.arquivo}-${hoje}.xlsx"`,
    );
    res.end(buffer);
  }

  @Post(':cadastro/previa')
  @UseInterceptors(arquivoXlsx)
  async previa(
    @Param('cadastro') chave: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('listaCompleta') listaCompleta?: string,
  ) {
    const cad = await this.conferirPermissao(user, chave);
    if (!arquivo) throw new BadRequestException('Nenhum arquivo foi enviado.');
    return this.service.analisar(
      cad,
      arquivo.buffer,
      listaCompleta === 'true',
    );
  }

  @Post(':cadastro/aplicar')
  @UseInterceptors(arquivoXlsx)
  async aplicar(
    @Param('cadastro') chave: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('listaCompleta') listaCompleta?: string,
  ) {
    const cad = await this.conferirPermissao(user, chave);
    if (!arquivo) throw new BadRequestException('Nenhum arquivo foi enviado.');
    return this.service.aplicar(
      cad,
      arquivo.buffer,
      listaCompleta === 'true',
      user.id,
    );
  }
}
