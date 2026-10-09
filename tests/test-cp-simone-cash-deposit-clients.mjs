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
  grupoAtivo = 'CP SIMONE - TITULOS';
  configGrupos = { [grupoAtivo]: { modoImportacaoPagamentos: 'cp_simone' } };
  const caixa = {
    data: new Date(2026, 7, 5), conta: 'CARREFOUR - CAIXA LOJA', valor: -100,
    historico: 'CARREFOUR - BANCO', tipoConciliacao: 'Transferência entre Contas'
  };
  const banco = {
    data: new Date(2026, 7, 7), conta: 'CARREFOUR - BANCO', valor: 100,
    historico: 'DEP DINHEIRO CAIXA AG', complemento: 'CARREFOUR - CAIXA LOJA',
    tipoConciliacao: 'Transferência entre Contas'
  };
  const misto = {
    data: new Date(2026, 7, 10), conta: 'HFVD - BANCO', valor: 148.70,
    historico: 'HFVD - CAIXA LOJA', documento: 'Depósito para CC em 04/08/2026',
    tipoConciliacao: 'Conciliação Mista'
  };
  const mistoDeposito = {
    data: new Date(2026, 7, 10), conta: 'HFVD - BANCO', valor: 730,
    historico: 'DEP DINHEIRO INTER AG', complemento: 'ERRO BANCO', documento: '1',
    tipoConciliacao: 'Conciliação Mista'
  };
  const erroBanco = {
    data: new Date(2026, 7, 3), conta: 'PEJOTA - BANCO', valor: 3191,
    historico: 'DEPOSITO C/CORRENTE-BDN', complemento: 'ERRO BANCO',
    tipoConciliacao: 'Parcelas de Títulos'
  };
  const aplicacao = {
    data: new Date(2026, 7, 4), conta: 'INFINITY - BANCO', valor: 35000,
    historico: 'RESGATE - CDB', complemento: 'INFINITY - APLICAÇÃO',
    tipoConciliacao: 'Transferência entre Contas'
  };

  extratoBancarioTemp = [caixa, banco, misto, mistoDeposito, erroBanco, aplicacao];
  conciliacaoItensTemp = [
    { id: 'saida-caixa', movimento: 'saida-pendente', idxOriginal: 0, chaveRegraSaida: 'carrefour-antiga' },
    { id: 'rec-banco', movimento: 'recebimento', tipo: banco.tipoConciliacao, historico: banco.historico, conta: banco.conta, movimentos: [banco] },
    { id: 'rec-misto', movimento: 'recebimento', tipo: misto.tipoConciliacao, historico: misto.historico, conta: misto.conta, movimentos: [misto] },
    { id: 'rec-misto-deposito', movimento: 'recebimento', tipo: mistoDeposito.tipoConciliacao, historico: mistoDeposito.historico, conta: mistoDeposito.conta, movimentos: [mistoDeposito] },
    { id: 'rec-erro', movimento: 'recebimento', tipo: erroBanco.tipoConciliacao, historico: erroBanco.historico, conta: erroBanco.conta, movimentos: [erroBanco] },
    { id: 'rec-aplicacao', movimento: 'recebimento', tipo: aplicacao.tipoConciliacao, historico: aplicacao.historico, conta: aplicacao.conta, movimentos: [aplicacao] }
  ];
  codigosConciliacaoTemp = {
    'saida-caixa': '211',
    'rec-banco': '5',
    'rec-misto': '5',
    'rec-misto-deposito': '5',
    'rec-erro': '278',
    'rec-aplicacao': '21'
  };
  depara = { [grupoAtivo]: {} };
  deparaRecebimentos = { [grupoAtivo]: {} };
  deparaSaidasExtrato = { [grupoAtivo]: {} };

  const linhas = montarLinhasDominioConciliacao({ validarPendencias: false });
  const paresCp = paresTransferenciasExtrato([caixa, { ...banco, data: caixa.data }]).length;
  const aplicacaoEhDeposito = movimentoEhDepositoCaixaNoBancoCpSimone(aplicacao);
  grupoAtivo = 'OUTRO GRUPO';
  configGrupos = { [grupoAtivo]: { modoImportacaoPagamentos: 'parcelas_numerarios' } };
  const detectaForaCp = movimentoEhDepositoCaixaBancoCpSimone(caixa)
    || movimentoEhDepositoCaixaBancoCpSimone(banco);

  return {
    linhas: linhas.map(linha => ({ debito: linha[1], credito: linha[2], valor: linha[3] })),
    paresCp,
    detectaForaCp,
    aplicacaoEhDeposito
  };
})()`, contexto);

const porValor = new Map(resultado.linhas.map(linha => [linha.valor, linha]));
const saidaCaixa = resultado.linhas.find(linha => linha.credito === 'CARREFOUR - CAIXA LOJA' && linha.valor === 100);
if (!saidaCaixa || saidaCaixa.debito !== '1152' || saidaCaixa.credito !== 'CARREFOUR - CAIXA LOJA') {
  throw new Error(`A saída do caixa não passou por Clientes: ${JSON.stringify(saidaCaixa)}.`);
}
for (const valor of [148.7, 730, 3191]) {
  const linha = porValor.get(valor);
  if (!linha || linha.credito !== '1152') {
    throw new Error(`O depósito ${valor} não passou por Clientes: ${JSON.stringify(linha)}.`);
  }
}
const depositoBanco = resultado.linhas.find(linha => linha.debito === 'CARREFOUR - BANCO' && linha.valor === 100);
if (!depositoBanco || depositoBanco.credito !== '1152') {
  throw new Error(`A entrada bancária não passou por Clientes: ${JSON.stringify(depositoBanco)}.`);
}
const resgate = porValor.get(35000);
if (!resgate || resgate.credito !== '21') {
  throw new Error(`O resgate de aplicação foi alterado: ${JSON.stringify(resgate)}.`);
}
if (resultado.paresCp !== 0) throw new Error('Caixa e banco foram pareados diretamente na CP SIMONE.');
if (resultado.detectaForaCp || resultado.aplicacaoEhDeposito) {
  throw new Error(`A regra alcançou aplicação ou outro grupo: ${JSON.stringify(resultado)}.`);
}

console.log(JSON.stringify({
  clientes: '1152',
  caixaViaClientes: true,
  bancoViaClientes: true,
  mistosViaClientes: true,
  erroBancoViaClientes: true,
  aplicacaoPreservada: true,
  outrosGruposPreservados: true
}, null, 2));
