// Segredo que assina a sessao. NAO existe valor padrao de proposito: um
// fallback escrito no codigo e publico (o repositorio e o pacote de instalacao
// vao junto), e quem o conhecesse poderia forjar um token de ADMIN e entrar no
// sistema sem senha. Faltando a variavel, a aplicacao nao sobe - e melhor o
// erro aparecer no boot do que a porta ficar aberta sem ninguem perceber.
//
// Todos os caminhos de instalacao ja definem a variavel: Render (painel),
// docker-compose.nuvem.yml, docker-compose.yml e o start.bat do pacote
// portatil (que le config\jwt.txt).
export function jwtSecret(): string {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.trim().length < 16) {
    throw new Error(
      'JWT_SECRET ausente ou curta demais (minimo 16 caracteres). ' +
        'Defina a variavel no ambiente antes de iniciar a aplicacao.',
    );
  }
  return segredo;
}
