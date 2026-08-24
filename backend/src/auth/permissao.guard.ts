import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { MODULO_KEY, ModuloMeta } from './modulo.decorator';

/**
 * Fecha a API de verdade. Esconder o botao na tela nao adianta: sem isso,
 * qualquer pessoa logada chama qualquer rota direto.
 *
 * A permissao e lida do banco a cada chamada (nao do token) para o admin
 * conseguir tirar acesso de alguem na hora, sem esperar o token de 12h vencer.
 */
@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<ModuloMeta>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Rota sem modulo declarado (auth, anexos, historico) segue so com login.
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // quem responde por isso e o JwtAuthGuard

    if (user.papel === 'ADMIN') return true;

    const metodo = String(req.method).toUpperCase();
    const leitura = metodo === 'GET' || metodo === 'HEAD';
    if (leitura && meta.leituraLivre) return true;

    const acessos = await this.prisma.acessoModulo.findMany({
      where: { usuarioId: user.id },
    });
    const doModulo = acessos.find((a) => a.modulo === meta.modulo);

    if (leitura) {
      if (doModulo) return true;
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }

    if (doModulo?.nivel === 'EDITAR') return true;

    // Atalho do inspetor: criar fornecedor eventual / item fora da base.
    if (metodo === 'POST' && meta.criacaoLivrePara?.length) {
      const pode = acessos.some(
        (a) =>
          a.nivel === 'EDITAR' && meta.criacaoLivrePara!.includes(a.modulo),
      );
      if (pode) return true;
    }

    throw new ForbiddenException(
      doModulo
        ? 'Seu acesso a esta área é somente para visualização.'
        : 'Você não tem acesso a esta área.',
    );
  }
}
