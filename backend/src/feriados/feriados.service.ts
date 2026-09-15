import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chaveDia, Feriados } from '../comum/dias-uteis';
import { calendarioDoAno } from './calendario';

// O calendario de lei NAO fica guardado no banco: e calculado na hora, para
// qualquer ano, por calendarioDoAno(). Assim nao existe mais "ano que alguem
// esqueceu de gerar" - antes, 2025 estava com zero feriados no banco e todo
// prazo daquele ano contava feriado como dia util, sem erro nenhum na tela.
//
// No banco ficam so os dias que nenhuma conta adivinha: recesso de fim de ano,
// ponte e parada de manutencao.
//
// A janela vai de 2015 ate cinco anos a frente porque nenhuma conta de prazo
// olha alem disso. Sao ~16 dias por ano: o conjunto inteiro cabe em memoria
// sem pesar.
const ANO_INICIAL = 2015;
const ANOS_A_FRENTE = 5;

// Cache do calendario em memoria.
//
// O calendario muda uma vez por ano; ler a tabela inteira a cada conta de prazo
// seria desperdicio, ja que uma unica tela do painel faz centenas delas. O
// cache cai sozinho depois de 10 minutos (caso o servidor rode em mais de uma
// instancia) e e derrubado na hora por quem grava. A validade curta tambem faz
// a janela de anos andar sozinha na virada do ano.
const VALIDADE_MS = 10 * 60 * 1000;

@Injectable()
export class FeriadosService {
  private cache: Set<string> | null = null;
  private carregadoEm = 0;

  constructor(private prisma: PrismaService) {}

  async conjunto(): Promise<Feriados> {
    const agora = Date.now();
    if (this.cache && agora - this.carregadoEm < VALIDADE_MS) return this.cache;

    const dias = new Set<string>();
    const ultimo = new Date().getUTCFullYear() + ANOS_A_FRENTE;
    for (let ano = ANO_INICIAL; ano <= ultimo; ano++)
      for (const f of calendarioDoAno(ano)) dias.add(chaveDia(f.data));

    const linhas = await this.prisma.feriado.findMany({
      select: { data: true },
    });
    for (const l of linhas) dias.add(chaveDia(l.data));

    this.cache = dias;
    this.carregadoEm = agora;
    return this.cache;
  }

  invalidar() {
    this.cache = null;
  }
}
