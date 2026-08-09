// Conserta o nome do arquivo que chega no upload.
//
// O multipart/form-data carrega o nome do arquivo dentro do cabecalho
// Content-Disposition, e o parser (busboy, por baixo do multer) le esse
// cabecalho como latin-1 - e a regra do formato. O navegador, porem, manda os
// bytes em UTF-8. Resultado: cada acento chega partido em dois caracteres e
// "Relatorio" com acento vira "RelatÃ³rio" na tela.
//
// Aqui refazemos o caminho: remontamos os bytes originais e lemos de novo como
// UTF-8. A conversao e feita so quando e seguro, para nunca estragar um nome
// que ja estava certo.
export function corrigirNomeArquivo(nome: string): string {
  if (!nome) return nome;

  // Acima de 0xFF o texto ja e Unicode de verdade: nao passou pelo latin-1.
  if (/[^\x00-\xFF]/.test(nome)) return nome;

  const relido = Buffer.from(nome, 'latin1').toString('utf8');

  // O caractere de substituicao denuncia que os bytes nao formavam UTF-8
  // valido - ou seja, o nome original ja estava correto.
  if (relido.includes('\uFFFD')) return nome;

  return relido;
}

// Monta o Content-Disposition do download.
//
// Cabecalho HTTP so trafega ASCII, entao o nome com acento precisa ir tambem
// na forma "filename*" (RFC 5987), que os navegadores preferem. O "filename"
// simples fica como reserva, sem acento e sem aspas - aspas soltas quebrariam
// o cabecalho.
export function disposicaoAnexo(nome: string): string {
  const seguro = (nome || 'anexo')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nome || 'anexo')}`;
}
