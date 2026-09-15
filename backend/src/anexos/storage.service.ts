import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageClient } from '@supabase/storage-js';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { isAbsolute, join, resolve, sep } from 'path';

// Guarda os arquivos anexados. Existem dois lugares possiveis, e quem decide e
// a variavel UPLOAD_DIR:
//
//   UPLOAD_DIR preenchida  -> pasta em disco (servidor da empresa)
//   UPLOAD_DIR vazia       -> Supabase Storage (prototipo na nuvem)
//
// Por que os dois: na nuvem o disco do servidor e efemero - a cada deploy ou
// reinicio ele e apagado, e as fotos das RNCs sumiriam sem aviso. No servidor
// da empresa e o contrario: o disco e permanente, fica dentro da rede e entra
// no mesmo backup do banco, e a internet pode simplesmente nao existir.
//
// Nos dois casos o arquivo NAO tem endereco publico: todo download continua
// passando pelo backend, protegido pelo JWT da aplicacao.
//
// Usamos StorageClient e nao o supabase-js completo: aquele inicializa o
// modulo Realtime, que exige WebSocket nativo (Node 22+). O runtime aqui e
// Node 20, entao o supabase-js quebraria na primeira chamada.
@Injectable()
export class StorageService {
  private cliente: StorageClient | null = null;
  private readonly bucket = process.env.SUPABASE_BUCKET || 'anexos';
  private readonly pasta = (process.env.UPLOAD_DIR || '').trim();

  get emDisco(): boolean {
    return this.pasta !== '';
  }

  // O "nome" e gravado pelo proprio sistema no formato numero-numero.extensao,
  // mas quem chega aqui na leitura e o valor que esta no banco. Recusar nome
  // com pasta dentro impede que um registro adulterado faca o backend ler
  // qualquer arquivo do servidor (C:\...\senhas.txt, por exemplo).
  private caminhoSeguro(nome: string): string {
    const base = resolve(this.pasta);
    const alvo = resolve(join(base, nome));
    if (isAbsolute(nome) || !alvo.startsWith(base + sep)) {
      throw new InternalServerErrorException(
        `Nome de arquivo inválido para o anexo: ${nome}`,
      );
    }
    return alvo;
  }

  private conectar(): StorageClient {
    if (this.cliente) return this.cliente;

    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) {
      throw new InternalServerErrorException(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configuradas: ' +
          'não é possível gravar nem ler anexos.',
      );
    }

    this.cliente = new StorageClient(`${url}/storage/v1`, {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
    });
    return this.cliente;
  }

  async enviar(nome: string, bytes: Buffer, mimeType?: string): Promise<void> {
    if (this.emDisco) {
      const destino = this.caminhoSeguro(nome);
      try {
        await mkdir(resolve(this.pasta), { recursive: true });
        // 'wx' recusa se o arquivo ja existir, do mesmo jeito que o upsert:false
        // do Storage: nome repetido significa defeito, e sobrescrever apagaria
        // silenciosamente o anexo de outro documento.
        await writeFile(destino, bytes, { flag: 'wx' });
      } catch (e: any) {
        throw new InternalServerErrorException(
          `Falha ao gravar o anexo em disco: ${e?.message ?? e}`,
        );
      }
      return;
    }

    const { error } = await this.conectar()
      .from(this.bucket)
      .upload(nome, bytes, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Falha ao gravar o anexo no Storage: ${error.message}`,
      );
    }
  }

  async baixar(nome: string): Promise<Buffer> {
    if (this.emDisco) {
      try {
        return await readFile(this.caminhoSeguro(nome));
      } catch (e: any) {
        throw new InternalServerErrorException(
          `Falha ao ler o anexo em disco: ${e?.message ?? e}`,
        );
      }
    }

    const { data, error } = await this.conectar()
      .from(this.bucket)
      .download(nome);
    if (error || !data) {
      throw new InternalServerErrorException(
        `Falha ao ler o anexo no Storage: ${error?.message ?? 'sem retorno'}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  }

  // Usado na montagem do PDF da RNC: uma foto ilegivel nao pode derrubar a
  // geracao do documento inteiro.
  async baixarOuNulo(nome: string): Promise<Buffer | null> {
    try {
      return await this.baixar(nome);
    } catch {
      return null;
    }
  }
}
