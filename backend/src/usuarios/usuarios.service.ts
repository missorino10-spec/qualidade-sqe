import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ModuloSistema, NivelAcesso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ficha do colaborador + o que ele enxerga do sistema.
 *
 * O admin cadastra a pessoa, o sistema devolve uma senha provisoria para ele
 * entregar, e no primeiro acesso o proprio colaborador troca. A senha nunca
 * fica visivel depois disso: se a pessoa perder, o admin gera outra pela ficha.
 */

const selectSemSenha = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  matricula: true,
  cargo: true,
  setor: true,
  telefone: true,
  dataAdmissao: true,
  precisaTrocarSenha: true,
  createdAt: true,
  acessos: { select: { modulo: true, nivel: true } },
};

// Sem 0/O/1/l de proposito: a senha e ditada ou anotada num papel.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function senhaProvisoria() {
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s;
}

export interface DadosFicha {
  nome?: string;
  email?: string;
  papel?: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
  ativo?: boolean;
  matricula?: string | null;
  cargo?: string | null;
  setor?: string | null;
  telefone?: string | null;
  dataAdmissao?: string | null;
}

export interface AcessoEntrada {
  modulo: ModuloSistema;
  nivel: NivelAcesso;
}

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: selectSemSenha,
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: selectSemSenha,
    });
    if (!usuario) throw new NotFoundException('Colaborador não encontrado');
    return usuario;
  }

  async create(data: DadosFicha & { acessos?: AcessoEntrada[] }) {
    if (!data.nome || !data.email) {
      throw new BadRequestException('Nome e e-mail são obrigatórios.');
    }
    const email = data.email.trim().toLowerCase();
    const jaExiste = await this.prisma.usuario.findUnique({ where: { email } });
    if (jaExiste) {
      throw new BadRequestException('Já existe um colaborador com este e-mail.');
    }

    const senha = senhaProvisoria();
    const usuario = await this.prisma.usuario.create({
      data: {
        nome: data.nome.trim(),
        email,
        senhaHash: await bcrypt.hash(senha, 10),
        papel: data.papel ?? 'QUALIDADE',
        precisaTrocarSenha: true,
        matricula: data.matricula ?? null,
        cargo: data.cargo ?? null,
        setor: data.setor ?? null,
        telefone: data.telefone ?? null,
        dataAdmissao: data.dataAdmissao ? new Date(data.dataAdmissao) : null,
        acessos: data.acessos?.length
          ? { create: data.acessos.map((a) => ({ ...a })) }
          : undefined,
      },
      select: selectSemSenha,
    });
    // A senha so aparece aqui, uma unica vez, para o admin entregar.
    return { usuario, senhaProvisoria: senha };
  }

  async update(id: number, data: DadosFicha) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Colaborador não encontrado');
    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: data.nome?.trim(),
        email: data.email?.trim().toLowerCase(),
        papel: data.papel,
        ativo: data.ativo,
        matricula: data.matricula,
        cargo: data.cargo,
        setor: data.setor,
        telefone: data.telefone,
        dataAdmissao:
          data.dataAdmissao === undefined
            ? undefined
            : data.dataAdmissao
              ? new Date(data.dataAdmissao)
              : null,
      },
      select: selectSemSenha,
    });
  }

  async resetarSenha(id: number) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Colaborador não encontrado');
    const senha = senhaProvisoria();
    await this.prisma.usuario.update({
      where: { id },
      data: {
        senhaHash: await bcrypt.hash(senha, 10),
        precisaTrocarSenha: true,
      },
    });
    return { senhaProvisoria: senha };
  }

  /**
   * Grava a lista inteira de acessos de uma vez: o que nao vem na lista deixa
   * de existir (e o "Sem acesso" da tela). Em transacao para nao existir um
   * instante em que a pessoa fica sem nada por acidente.
   */
  async definirAcessos(id: number, acessos: AcessoEntrada[]) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Colaborador não encontrado');
    await this.prisma.$transaction([
      this.prisma.acessoModulo.deleteMany({ where: { usuarioId: id } }),
      this.prisma.acessoModulo.createMany({
        data: acessos.map((a) => ({ usuarioId: id, ...a })),
      }),
    ]);
    return this.findOne(id);
  }
}
