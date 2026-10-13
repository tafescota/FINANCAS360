import fs from 'node:fs';
import vm from 'node:vm';

const arquivoAplicacao = process.argv[2]
  ? new URL(process.argv[2], `file:///${process.cwd().replace(/\\/g, '/')}/`)
  : new URL('../index.html', import.meta.url);
const html = fs.readFileSync(arquivoAplicacao, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal não encontrado.');

const script = match[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
const elemento = {
  addEventListener() {},
  appendChild() {},
  classList: { add() {}, remove() {}, toggle() {} },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  remove() {},
  style: {},
  value: '',
};
const contexto = vm.createContext({
  alert() {},
  confirm() { return true; },
  console,
  CSS: { escape: String },
  document: {
    addEventListener() {},
    body: elemento,
    createElement() { return { ...elemento }; },
    getElementById() { return elemento; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  fetch: async () => ({ ok: true, json: async () => ({ grupos: [], depara: {} }) }),
  localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
  setInterval() {},
  setTimeout(fn) { return fn(); },
  window: { addEventListener() {} },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`
  grupoAtivo = 'PCA';
  configGrupos = { PCA: { modoImportacaoPagamentos: 'parcelas' } };
  extratoBancarioTemp = [
    {
      data: new Date(2026, 6, 31),
      conta: 'PCA - 14155 - ITAÚ',
      valor: -940000,
      historico: 'PCA - 14155 - SICOOB',
      complemento: '',
      documento: '',
      tipoConciliacao: 'Conciliação Mista'
    },
    {
      data: new Date(2026, 6, 31),
      conta: 'PCA - 14155 - SICOOB',
      valor: 940000,
      historico: 'PIX RECEBIDO - OUTRA IF - MESMA TIT.',
      complemento: 'PCA - 14155 - ITAÚ',
      documento: '',
      tipoConciliacao: 'Transferência entre Contas'
    }
  ];
  conciliacaoItensTemp = [];
  codigosConciliacaoTemp = {};
  montarLinhasDominioConciliacao({ validarPendencias: false });
`, contexto);

if (resultado.length !== 1) {
  throw new Error(`Esperava 1 lançamento da transferência; foram gerados ${resultado.length}.`);
}

const [data, debito, credito, valor, , complemento, , empresa, , , tipo] = resultado[0];
if (data !== '31/07/2026') throw new Error(`Data incorreta: ${data}`);
if (debito !== 'PCA - 14155 - SICOOB') throw new Error(`Débito incorreto: ${debito}`);
if (credito !== 'PCA - 14155 - ITAÚ') throw new Error(`Crédito incorreto: ${credito}`);
if (valor !== 940000) throw new Error(`Valor incorreto: ${valor}`);
if (!complemento.includes('Transferência entre contas')) throw new Error(`Complemento incorreto: ${complemento}`);
if (empresa !== '14155') throw new Error(`Empresa incorreta: ${empresa}`);
if (tipo !== 'PROPRIO') throw new Error(`Tipo incorreto: ${tipo}`);

console.log(JSON.stringify({ data, debito, credito, valor, complemento, empresa, tipo }, null, 2));

const resultadoNumerarios = vm.runInContext(`
  extratoBancarioTemp = [
    {
      data: new Date(2026, 6, 31), conta: 'PCA - 14155 - ITAÚ', valor: -125000,
      historico: 'PCA - 19025 - BANCO DO BRASIL', tipoConciliacao: 'Conciliação Mista'
    },
    {
      data: new Date(2026, 6, 31), conta: 'PCA - 19025 - BANCO DO BRASIL', valor: 125000,
      complemento: 'PCA - 14155 - ITAÚ', tipoConciliacao: 'Transferência entre Contas'
    }
  ];
  const parNumerarios = paresTransferenciasExtrato(extratoBancarioTemp)[0];
  conciliacaoItensTemp = itensNumerarioTransferenciasPareadas(extratoBancarioTemp);
  codigosConciliacaoTemp = Object.fromEntries(conciliacaoItensTemp.map(item => [
    item.id,
    item.pontaTransferencia === 'origem' ? '19999' : '29999'
  ]));
  ({
    classificacao: classificarTransferenciaEntreContas(parNumerarios),
    pendencias: conciliacaoItensTemp.map(item => item.pontaTransferencia),
    linhas: montarLinhasDominioConciliacao({ validarPendencias: false })
  });
`, contexto);

if (resultadoNumerarios.classificacao.tipo !== 'NUMERARIOS') {
  throw new Error(`Empresas diferentes foram classificadas como ${resultadoNumerarios.classificacao.tipo}.`);
}
if (resultadoNumerarios.classificacao.criterio !== 'codigo-empresa') {
  throw new Error(`Critério inesperado: ${resultadoNumerarios.classificacao.criterio}.`);
}
if (resultadoNumerarios.pendencias.length !== 2) {
  throw new Error(`Esperava Numerários Ativo e Passivo; foram criadas ${resultadoNumerarios.pendencias.length} pontas.`);
}
if (resultadoNumerarios.linhas.length !== 2) {
  throw new Error(`Esperava 2 lançamentos intercompany; foram gerados ${resultadoNumerarios.linhas.length}.`);
}

const classificacaoIncompleta = vm.runInContext(`
  classificarTransferenciaEntreContas({
    saida: { conta: 'Conta origem sem empresa' },
    entrada: { conta: 'Conta destino sem empresa' }
  });
`, contexto);
if (classificacaoIncompleta.tipo !== 'NUMERARIOS' || classificacaoIncompleta.criterio !== 'identificacao-incompleta') {
  throw new Error('Transferência sem empresa identificada passou sem Numerários.');
}

console.log(JSON.stringify({
  empresasDiferentes: {
    classificacao: resultadoNumerarios.classificacao.tipo,
    criterio: resultadoNumerarios.classificacao.criterio,
    pontas: resultadoNumerarios.pendencias,
    lancamentos: resultadoNumerarios.linhas.length
  },
  identificacaoIncompleta: classificacaoIncompleta.tipo
}, null, 2));

const pareamentoAplicacoes = vm.runInContext(`
  extratoBancarioTemp = [
    { data: new Date(2026, 7, 28), conta: 'SMF - BANCO', valor: -6000, historico: 'APLICACAO CDB', complemento: 'SMF - APLICAÇÃO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 28), conta: 'HFC - BANCO', valor: -6000, historico: 'APLICACAO CDB', complemento: 'HFC - APLICAÇÃO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 28), conta: 'DOLCE - BANCO', valor: -6000, historico: 'APLICACAO CDB', complemento: 'DOLCE - APLICAÇÃO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 28), conta: 'HFC - APLICAÇÃO', valor: 6000, historico: 'APLICAÇÃO - CDB', complemento: 'HFC - BANCO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 28), conta: 'DOLCE - APLICAÇÃO', valor: 6000, historico: 'APLICAÇÃO - CDB', complemento: 'DOLCE - BANCO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 28), conta: 'SMF - APLICAÇÃO', valor: 6000, historico: 'APLICAÇÃO - CDB', complemento: 'SMF - BANCO', tipoConciliacao: 'Transferência entre Contas' }
  ];
  paresTransferenciasExtrato(extratoBancarioTemp).map(par => ({
    origem: par.saida.conta,
    destino: par.entrada.conta,
    tipo: classificarTransferenciaEntreContas(par).tipo
  }));
`, contexto);

if (pareamentoAplicacoes.length !== 3
  || pareamentoAplicacoes.some(par => par.tipo !== 'PROPRIO' || !vm.runInContext(`contasPertencemMesmaEmpresa(${JSON.stringify(par.origem)}, ${JSON.stringify(par.destino)})`, contexto))) {
  throw new Error(`Aplicações de mesmo valor foram cruzadas entre empresas: ${JSON.stringify(pareamentoAplicacoes)}.`);
}

const pareamentoIncompativel = vm.runInContext(`
  paresTransferenciasExtrato([
    { data: new Date(2026, 7, 11), conta: 'SHIBATA GUARÁ - CAIXA LOJA', valor: -100, historico: 'SHIBATA GUARÁ - BANCO', tipoConciliacao: 'Transferência entre Contas' },
    { data: new Date(2026, 7, 11), conta: 'PEJOTA - BANCO', valor: 100, historico: 'DEP DINHEIRO INTER AG', complemento: 'PEJOTA - CAIXA LOJA', tipoConciliacao: 'Transferência entre Contas' }
  ]).length;
`, contexto);

if (pareamentoIncompativel !== 0) {
  throw new Error('Transferências de empresas diferentes foram pareadas somente por data e valor.');
}

console.log(JSON.stringify({ pareamentoAplicacoes, pareamentoIncompativel }, null, 2));

const resultadoBancos = vm.runInContext(`
  grupoAtivo = 'PCA';
  contasSemConciliacao = {
    PCA: {
      [normalizarTexto('PCA - 14155 - SICOOB')]: '1111',
      [normalizarTexto('PCA - 14155 - ITAÚ')]: '2222'
    }
  };
  lancamentosGerados = [{
    data: '31/07/2026',
    codDebito: 'PCA - 14155 - SICOOB',
    codCredito: 'PCA - 14155 - ITAÚ',
    valorLiq: 940000,
    complemento: 'Transferência própria',
    empresa: '14155',
    origemConciliacao: false
  }];
  ({
    bancoDireto: codigoBancoConciliacao('PCA - 14155 - SICOOB'),
    linhaPagamento: montarLinhasDominioPagamentos()[0]
  });
`, contexto);

if (resultadoBancos.bancoDireto !== '1111') {
  throw new Error(`O banco não foi convertido para o código salvo: ${resultadoBancos.bancoDireto}.`);
}
if (resultadoBancos.linhaPagamento[1] !== '1111' || resultadoBancos.linhaPagamento[2] !== '2222') {
  throw new Error(`A exportação manteve nome de banco: ${JSON.stringify(resultadoBancos.linhaPagamento)}.`);
}

console.log(JSON.stringify({
  deparaBancario: {
    debito: resultadoBancos.linhaPagamento[1],
    credito: resultadoBancos.linhaPagamento[2]
  }
}, null, 2));
