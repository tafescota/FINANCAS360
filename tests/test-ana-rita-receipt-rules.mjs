import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal nao encontrado.');

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
vm.runInContext(match[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, ''), contexto);

const resultado = vm.runInContext(`(() => {
  grupoAtivo = 'ANA RITA';
  configGrupos = { 'ANA RITA': { modoImportacaoPagamentos: 'ana_rita' } };
  const item = (conta, tipo, historico, complemento = '') => ({
    id: conta + historico,
    movimento: 'recebimento',
    conta,
    tipo,
    historico,
    movimentos: [{ conta, tipoConciliacao: tipo, historico, complemento, documento: '' }]
  });
  const moozTitulo = item('BANCO DO BRASIL - LOJA BERIMBAU (5227)', 'Parcelas de Titulos', 'PIX RECEBIDO MOOZ CARTOES HAGANA');
  const moozCartao = item('BANCO DO BRASIL - LOJA BERIMBAU (5227)', 'Parcelas de Cartoes', 'CREDITO DE VENDAS MOOZ');
  const pixBanco = item('BANCO DO BRASIL - LOJA BERIMBAU (5227)', 'Parcelas de Titulos', 'PIX RECEBIDO RITA SOUZA');
  const pixCaixa = item('CAIXA LJ BERIMBAU 5227', 'Parcelas de Titulos', 'ENTRADA PIX CLIENTE JOAO');
  const pixFilial = item('ITAU - VD BERIMBAU 18837', 'Parcelas de Titulos', 'PIX RECEBIDO RITA SOUZA');
  const rendimento = item('APLICACAO BB - LOJA BERIMBAU 5227', 'Parcelas de Titulos', 'RENDIMENTO PAGO');

  const chaveMoozTitulo = obterChaveRegraRecebimentoConciliacao(moozTitulo);
  const chaveMoozCartao = obterChaveRegraRecebimentoConciliacao(moozCartao);
  const chavePixBanco = obterChaveRegraRecebimentoConciliacao(pixBanco);
  const chavePixCaixa = obterChaveRegraRecebimentoConciliacao(pixCaixa);
  const chavePixFilial = obterChaveRegraRecebimentoConciliacao(pixFilial);
  const chaveRendimento = obterChaveRegraRecebimentoConciliacao(rendimento);
  const regraAntiga = montarChaveRecebimentoPorForma(pixBanco.tipo, '', origemRegraRecebimento(pixBanco));
  const codigoAntigo = encontrarCodigoRegraRecebimentoConciliacao(
    { [regraAntiga]: '999' }, pixBanco.tipo, pixBanco.historico, '', origemRegraRecebimento(pixBanco), pixBanco
  );
  const codigoNovo = encontrarCodigoRegraRecebimentoConciliacao(
    { [chavePixBanco]: '6' }, pixBanco.tipo, pixBanco.historico, '', origemRegraRecebimento(pixBanco), pixBanco
  );

  return {
    categorias: [moozTitulo, pixBanco, rendimento].map(i => naturezaRecebimentoAnaRita(i).categoria),
    moozMesmaRegra: chaveMoozTitulo === chaveMoozCartao,
    pixMesmaEmpresa: chavePixBanco === chavePixCaixa,
    pixEmpresasSeparadas: chavePixBanco !== chavePixFilial,
    naturezasSeparadas: chaveMoozTitulo !== chavePixBanco && chavePixBanco !== chaveRendimento,
    aplicaMooz: recebimentoAtendeRegra(moozTitulo, moozCartao),
    naoAplicaPixEmMooz: !recebimentoAtendeRegra(pixBanco, moozCartao),
    naoAplicaPixOutraEmpresa: !recebimentoAtendeRegra(pixFilial, pixBanco),
    codigoAntigo,
    codigoNovo,
    chaves: { chaveMoozTitulo, chavePixBanco, chavePixFilial, chaveRendimento }
  };
})()`, contexto);

assert.equal(JSON.stringify(resultado.categorias), JSON.stringify(['CARTOES', 'PIX_CLIENTES', 'RENDIMENTOS_APLICACAO']));
assert.equal(resultado.moozMesmaRegra, true);
assert.equal(resultado.pixMesmaEmpresa, true);
assert.equal(resultado.pixEmpresasSeparadas, true);
assert.equal(resultado.naturezasSeparadas, true);
assert.equal(resultado.aplicaMooz, true);
assert.equal(resultado.naoAplicaPixEmMooz, true);
assert.equal(resultado.naoAplicaPixOutraEmpresa, true);
assert.equal(resultado.codigoAntigo, '');
assert.equal(resultado.codigoNovo, '6');

console.log(JSON.stringify(resultado, null, 2));
