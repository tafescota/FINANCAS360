import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal não encontrado.');

const script = match[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
const elemento = {
  addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} },
  querySelector() { return null; }, querySelectorAll() { return []; }, remove() {},
  style: {}, value: '', textContent: '', innerHTML: '', className: '',
};
const contexto = vm.createContext({
  alert() {}, confirm() { return true; }, console, CSS: { escape: String },
  document: {
    addEventListener() {}, body: elemento, createElement() { return { ...elemento }; },
    getElementById() { return { ...elemento }; }, querySelector() { return null; }, querySelectorAll() { return []; },
  },
  fetch: async () => ({ ok: true, json: async () => ({ grupos: [], depara: {} }) }),
  localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
  setInterval() {}, setTimeout(fn) { return fn(); }, window: { addEventListener() {} },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`(() => {
  const plano = 'MERCADORIA PARA REVENDA';
  const tipo = 'Boleto';
  const historico = 'COMPRA DO MES';
  const regras = {
    [montarChave('FORNECEDOR A', plano, tipo, historico, '')]: '321'
  };

  grupoAtivo = 'SANTOS & GALDINO';
  const mesmoFornecedor = encontrarCodigoRegra(regras, 'FORNECEDOR A', plano, tipo, 'OUTRA COMPRA', '');
  const outroFornecedor = encontrarCodigoRegra(regras, 'FORNECEDOR B', plano, tipo, historico, '');

  grupoAtivo = 'CP SIMONE - TITULOS';
  const outroFornecedorCpSimone = encontrarCodigoRegra(regras, 'FORNECEDOR B', plano, tipo, historico, '');
  novasChavesTemp = [
    { chave: 'A', fornecedor: 'FORNECEDOR A', plano, tipoDoc: tipo, historico, escopoRegra: '' },
    { chave: 'B', fornecedor: 'FORNECEDOR B', plano, tipoDoc: tipo, historico, escopoRegra: '' }
  ];
  codigosTemp = { A: '321', B: '' };
  reaplicarRegrasSalvasNasPendenciasPagamento(regras);
  removerPendenciasResolvidasPagamento();
  return {
    mesmoFornecedor,
    outroFornecedor,
    outroFornecedorCpSimone,
    pendenciasRestantes: novasChavesTemp.map(item => item.fornecedor)
  };
})()`, contexto);

if (resultado.mesmoFornecedor !== '321') {
  throw new Error('A regra deixou de ser reutilizada para o mesmo fornecedor e plano.');
}
if (resultado.outroFornecedor) {
  throw new Error('Uma regra de outro fornecedor foi aplicada apenas porque o plano era igual.');
}
if (resultado.outroFornecedorCpSimone) {
  throw new Error('A CP SIMONE aplicou a regra em outro fornecedor apenas porque o plano era igual.');
}
if (resultado.pendenciasRestantes.length !== 1 || resultado.pendenciasRestantes[0] !== 'FORNECEDOR B') {
  throw new Error(`A pendência do outro fornecedor desapareceu: ${JSON.stringify(resultado.pendenciasRestantes)}.`);
}

console.log(JSON.stringify({ isolamentoFornecedor: true, cpSimoneIsoladaPorFornecedor: true, outraPendenciaPermaneceVisivel: true }, null, 2));

vm.runInContext(`(() => {
  grupoAtivo = 'CP SIMONE - TITULOS';
  const consultar = (regras, fornecedor, plano, tipo = 'Outros') =>
    encontrarCodigoRegra(regras, fornecedor, plano, tipo, 'NOVO HISTORICO');
  const exigir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
  for (const plano of ['USO E CONSUMO', 'MERCADORIA PARA REVENDA', 'OUTRA DESPESA']) {
    const regras = { [montarChave('A', plano, 'Outros', 'ANTIGO')]: '123' };
    exigir(!consultar(regras, 'B', plano), 'Generalizou outro fornecedor: ' + plano);
    exigir(consultar(regras, 'A', plano) === '123', 'Perdeu reaproveitamento do mesmo fornecedor');
  }
  for (const [fornecedor, plano, codigo] of [
    ['Lince Finance', 'Consultoria Financeira', '425'],
    ['DIVERSOS', 'MANUTENÇÃO E REPAROS', '402'],
    ['TELEFONICA', 'INTERNET', '373'],
    ['TELEFONICA', 'TELEFONIA', '374']
  ]) {
    const chave = montarChave('ORIGEM CONFIRMADA', plano, 'Outros', 'ANTIGO');
    const regras = { [chave]: codigo };
    exigir(consultar(regras, fornecedor, plano) === codigo, 'Perdeu caso confirmado: ' + fornecedor);
    exigir(!consultar(regras, 'NOVO FORNECEDOR', plano), 'Excecao alcancou novo fornecedor');
    exigir(!consultar({ [chave]: '999' }, fornecedor, plano), 'Excecao aceitou outra conta');
    exigir(consultar({ ...regras, [montarChave(fornecedor, plano, 'Outros', 'NOVO HISTORICO')]: '777' }, fornecedor, plano) === '777', 'Ignorou regra especifica');
    exigir(!consultar({ ...regras, [montarChave('OUTRO', plano, 'Outros', 'ANTIGO')]: '999' }, fornecedor, plano), 'Ignorou conflito');
    grupoAtivo = 'SANTOS & GALDINO';
    exigir(!consultar(regras, fornecedor, plano), 'Excecao atingiu outro grupo');
    grupoAtivo = 'CP SIMONE - TITULOS';
  }
  const folha = { [montarChave('FUNCIONARIO A', 'Rateado', 'Folha de Pagamento', '')]: '178' };
  const documentos = {
    [montarChave('MESMO', 'DESPESA', 'Boleto', 'ANTIGO')]: '111',
    [montarChave('MESMO', 'DESPESA', 'Outros', 'ANTIGO')]: '222'
  };
  exigir(consultar(documentos, 'MESMO', 'DESPESA', 'Boleto') === '111', 'Perdeu reaproveitamento por documento do proprio fornecedor');
  exigir(!consultar(documentos, 'DIFERENTE', 'DESPESA', 'Boleto'), 'Documento permitiu outro fornecedor');
  exigir(consultar(folha, 'FUNCIONARIO B', 'Rateado', 'Folha de Pagamento') === '178', 'Perdeu folha');
  exigir(!consultar(folha, 'FORNECEDOR', 'Rateado', 'Nota Fiscal'), 'Folha contaminou nota fiscal');
  exigir(!consultar({ [montarChave('A', 'Rateado', 'Nota Fiscal', '')]: '999' }, 'B', 'Rateado', 'Folha de Pagamento'), 'Folha herdou conta de nota fiscal');
})()`, contexto);
console.log('Excecoes confirmadas, prioridade de regras especificas e limites de folha: OK');
