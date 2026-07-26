import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Guarda os arquivos anexados no Supabase Storage.
//
// Motivo: na nuvem o disco do servidor e efemero - a cada novo deploy ou
// reinicio ele e apagado. Gravar anexo em disco significaria perder as fotos
// das RNCs sem aviso. O Storage e persistente e independente do servidor.
//
// O bucket e PRIVADO: nenhum arquivo tem URL publica. Todo download continua
// passando pelo backend, protegido pelo JWT da aplicacao.
@Injectable()
export class StorageService {
  private cliente: SupabaseClient | null = null;
  private readonly bucket = process.env.SUPABASE_BUCKET || 'anexos';

  private conectar(): SupabaseClient {
    if (this.cliente) return this.cliente;

    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) {
      throw new InternalServerErrorException(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao configuradas: ' +
          'nao e possivel gravar nem ler anexos.',
      );
    }

    this.cliente = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.cliente;
  }

  async enviar(nome: string, bytes: Buffer, mimeType?: string): Promise<void> {
    const { error } = await this.conectar()
      .storage.from(this.bucket)
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
    const { data, error } = await this.conectar()
      .storage.from(this.bucket)
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
