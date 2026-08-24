import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { moduloDaEntidade } from './modulo-da-entidade';

/**
 * Guarda das duas tabelas genericas: Anexo e HistoricoStatus.
 *
 * O PermissaoGuard nao serve aqui porque nestas rotas o modulo nao e fixo: ele
 * depende do "entidadeTipo" que veio na chamada. A regra e a mesma do resto do
 * sistema - ver exige Visualizar, gravar exige Visualizar e editar - so que o
 * modulo e descoberto na hora.
 *
 * A permissao e lida do banco a cada chamada (nao do token), igual ao
 * PermissaoGuard, para tirar acesso de alguem valer na hora.
 */
@Injectable()
export class EntidadeModuloGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // quem responde por isso e o JwtAuthGuard
    if (user.papel === 'ADMIN') return true;

    const tipo = await this.tipoDaChamada(req);
    const modulo = moduloDaEntidade(tipo);
    if (!modulo) {
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }

    const metodo = String(req.method).toUpperCase();
    const leitura = metodo === 'GET' || metodo === 'HEAD';

    const acesso = await this.prisma.acessoModulo.findFirst({
      where: { usuarioId: user.id, modulo },
    });
    if (!acesso) {
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }
    if (leitura || acesso.nivel === 'EDITAR') return true;

    throw new ForbiddenException(
      'Seu acesso a esta área é somente para visualização.',
    );
  }

  /**
   * O rotulo chega de tres jeitos: query (upload e listagem de anexo), rota
   * (historico) ou, no download, so o id do anexo - ai o rotulo vem do proprio
   * registro.
   */
  private async tipoDaChamada(req: any): Promise<string | null> {
    const daChamada = req.query?.entidadeTipo ?? req.params?.entidadeTipo;
    if (daChamada) return String(daChamada);

    const id = Number(req.params?.id);
    if (!Number.isInteger(id)) return null;

    const anexo = await this.prisma.anexo.findUnique({
      where: { id },
      select: { entidadeTipo: true },
    });
    return anexo?.entidadeTipo ?? null;
  }
}
