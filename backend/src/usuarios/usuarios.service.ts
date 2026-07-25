import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const selectSemSenha = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  createdAt: true,
};

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: selectSemSenha,
      orderBy: { nome: 'asc' },
    });
  }

  async create(data: {
    nome: string;
    email: string;
    senha: string;
    papel?: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
  }) {
    const senhaHash = await bcrypt.hash(data.senha, 10);
    return this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash,
        papel: data.papel ?? 'QUALIDADE',
      },
      select: selectSemSenha,
    });
  }

  async update(
    id: number,
    data: {
      nome?: string;
      email?: string;
      senha?: string;
      papel?: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
      ativo?: boolean;
    },
  ) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Usuario nao encontrado');
    const patch: any = {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      ativo: data.ativo,
    };
    if (data.senha) {
      patch.senhaHash = await bcrypt.hash(data.senha, 10);
    }
    return this.prisma.usuario.update({
      where: { id },
      data: patch,
      select: selectSemSenha,
    });
  }
}
