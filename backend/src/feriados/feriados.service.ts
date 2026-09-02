import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chaveDia, Feriados } from '../comum/dias-uteis';

// Cache do calendario em memoria.
//
// O calendario muda uma vez por ano; ler a tabela inteira a cada conta de prazo
// seria desperdicio, ja que uma unica tela do painel faz centenas delas. O
// cache cai sozinho depois de 10 minutos (caso o servidor rode em mais de uma
// instancia) e e derrubado na hora por quem grava.
const VALIDADE_MS = 10 * 60 * 1000;

@Injectable()
export class FeriadosService {
  private cache: Set<string> | null = null;
  private carregadoEm = 0;

  constructor(private prisma: PrismaService) {}

  async conjunto(): Promise<Feriados> {
    const agora = Date.now();
    if (this.cache && agora - this.carregadoEm < VALIDADE_MS) return this.cache;

    const linhas = await this.prisma.feriado.findMany({
      select: { data: true },
    });
    this.cache = new Set(linhas.map((l) => chaveDia(l.data)));
    this.carregadoEm = agora;
    return this.cache;
  }

  invalidar() {
    this.cache = null;
  }
}
