import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

// Freio de tentativa de senha. A aplicacao fica exposta na internet e o
// /auth/login nao tinha limite nenhum: dava para um robo tentar milhares de
// senhas por minuto contra um e-mail conhecido ate acertar.
//
// A contagem e por IP + e-mail, nao so por IP: numa fabrica a rede inteira sai
// pelo mesmo IP, e travar por IP puro deixaria um colega sem entrar por causa
// do erro de digitacao de outro.
//
// A contagem vive na memoria do processo de proposito. E um servico unico e o
// que se quer barrar e a rajada; guardar isso no banco seria uma escrita a cada
// tentativa de login, inclusive nas legitimas.

const JANELA_MS = 15 * 60 * 1000; // 15 minutos
const LIMITE = 10; // tentativas na janela, por IP + e-mail
const LIMPEZA_A_CADA = 500; // chamadas entre uma faxina e outra do mapa

type Registro = { tentativas: number; ate: number };

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly contagem = new Map<string, Registro>();
  private desdeAUltimaLimpeza = 0;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    const chave = `${req.ip}|${email}`;
    const agora = Date.now();

    this.limpar(agora);

    const atual = this.contagem.get(chave);
    if (!atual || atual.ate <= agora) {
      this.contagem.set(chave, { tentativas: 1, ate: agora + JANELA_MS });
      return true;
    }

    atual.tentativas += 1;
    if (atual.tentativas > LIMITE) {
      const faltam = Math.ceil((atual.ate - agora) / 60000);
      throw new HttpException(
        `Muitas tentativas de login. Tente novamente em ${faltam} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  // Sem isso o mapa so cresce: um robo variando o e-mail criaria uma entrada
  // por tentativa e o processo iria acumulando memoria ate cair.
  private limpar(agora: number) {
    if (++this.desdeAUltimaLimpeza < LIMPEZA_A_CADA) return;
    this.desdeAUltimaLimpeza = 0;
    for (const [chave, reg] of this.contagem) {
      if (reg.ate <= agora) this.contagem.delete(chave);
    }
  }
}
