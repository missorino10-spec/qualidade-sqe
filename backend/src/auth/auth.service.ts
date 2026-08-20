import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    const ok = await bcrypt.compare(senha, usuario.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    const payload = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      },
    };
  }
}
