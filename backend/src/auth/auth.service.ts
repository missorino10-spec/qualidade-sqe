import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { acessos: { select: { modulo: true, nivel: true } } },
    });
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
      usuario: this.publico(usuario),
    };
  }

  /**
   * Dados frescos do banco. A tela chama ao abrir para o menu refletir o
   * acesso de agora, e nao o que estava valendo quando o token foi emitido.
   */
  async me(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: { acessos: { select: { modulo: true, nivel: true } } },
    });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.publico(usuario);
  }

  // Troca de senha do primeiro acesso (e de quando a pessoa quiser trocar).
  async trocarSenha(id: number, senhaAtual: string, novaSenha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new UnauthorizedException('Sessão inválida');
    const ok = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!ok) throw new BadRequestException('Senha atual incorreta.');
    if (novaSenha.length < 6) {
      throw new BadRequestException('A nova senha precisa ter 6 ou mais caracteres.');
    }
    if (await bcrypt.compare(novaSenha, usuario.senhaHash)) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: {
        senhaHash: await bcrypt.hash(novaSenha, 10),
        precisaTrocarSenha: false,
      },
    });
    return { ok: true };
  }

  private publico(usuario: any) {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      precisaTrocarSenha: usuario.precisaTrocarSenha,
      acessos: usuario.acessos ?? [],
    };
  }
}
