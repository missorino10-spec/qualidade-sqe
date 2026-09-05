// Classificacao de fornecimento (A, B, C e D).
//
// A cor da etiqueta estava repetida em tres telas - cadastro, periodicidade e
// painel do SQE. Basta uma delas ficar para tras numa mudanca para o mesmo
// fornecedor aparecer verde numa tela e azul na outra.

export const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};
