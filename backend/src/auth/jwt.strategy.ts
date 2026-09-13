import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { jwtSecret } from './jwt-secret';

export interface JwtPayload {
  sub: number;
  email: string;
  nome: string;
  papel: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  // O usuario e relido do banco a cada chamada, e nao aproveitado do token.
  // O token vale 12h: sem esta consulta, quem fosse desativado (ou rebaixado de
  // ADMIN) continuava entrando pelo resto do dia com o token que ja tinha na
  // mao. E a mesma regra que o PermissaoGuard ja seguia para os modulos - o
  // papel e o "ativo" ficavam de fora por descuido.
  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nome: true, papel: true, ativo: true },
    });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel,
    };
  }
}
