import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Prefixo global /api (o nginx faz proxy de /api -> backend)
  app.setGlobalPrefix('api');

  // Atras do proxy (Render, nginx) o req.ip chegava como o IP do proprio
  // proxy - assim o freio de tentativa de login contaria todo mundo junto.
  app.set('trust proxy', 1);

  // Cabecalhos minimos de seguranca. Escritos aqui, e nao com o helmet, para
  // nao trazer junto a politica de conteudo (CSP) padrao: no pacote portatil e
  // o proprio backend que serve as telas, e o Ant Design injeta estilo inline -
  // a CSP padrao bloquearia e a tela subiria sem formatacao nenhuma.
  app.use((_req: any, res: any, next: any) => {
    // Nao adivinhe o tipo do conteudo - vale principalmente para o download de
    // anexo, cujo mimeType vem de quem subiu o arquivo.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Nao deixe embutir a aplicacao em iframe de outro site (clickjacking).
    res.setHeader('X-Frame-Options', 'DENY');
    // Nao vaze a URL interna (que carrega os ids) para sites de terceiros.
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // CORS. Sem a variavel CORS_ORIGINS segue como sempre foi - refletindo a
  // origem de quem chamou -, para nao derrubar nenhuma instalacao ja no ar.
  // Preenchendo a variavel (lista separada por virgula) a API passa a atender
  // somente os enderecos listados.
  const origens = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origens.length ? origens : true,
    credentials: true,
  });

  // Validacao automatica dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Quando o servidor e desligado ou reiniciado, o sistema recebe um pedido
  // para encerrar (SIGTERM). Sem isto o Node morre na hora, no meio do que
  // estivesse fazendo. Com isto ele para de aceitar chamadas novas, deixa as
  // que ja estavam em andamento terminarem de gravar e so entao fecha o banco.
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend rodando na porta ${port}`);
}
bootstrap();
