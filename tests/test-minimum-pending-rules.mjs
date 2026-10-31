import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal não encontrado.');

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
  configGrupos[grupoAtivo] = { modoImportacaoPagamentos: 'ana_rita' };
  const data = new Date(2026, 6, 1);
  const movimento = (historico = 'PAGAMENTO') => ({ data, conta: 'CAIXA LJ BERIMBAU 5227', valor: -428.36, historico, complemento: '', documento: '', empresa: '', origem: '', tipoConciliacao: 'Parcelas de Títulos' });
  const a1 = movimento('MESMA LINHA');
  const a2 = movimento('MESMA LINHA');
  const b1 = movimento('MESMA LINHA');
  const a3 = movimento('LINHA SOBREPOSTA');
  const b2 = movimento('LINHA SOBREPOSTA');
  const semSobreposicao = removerSobreposicaoMovimentosExtrato([
    { movimentos: [a1, a2, a3] },
    { movimentos: [b1, b2] }
  ]);

  const pagamentos = [0, 1].map(idx => ({
    idx, dataKey: dataKey(data), conta: 'CAIXA LJ BERIMBAU 5227',
    fornecedor: idx ? 'OUTRO FORNECEDOR' : 'COELBA NEOENERGIA', valor: 428.36
  }));
  const movimentos = [movimento('PIX SEM NOME'), movimento('PAGAMENTO SEM FORNECEDOR')];
  const chaveIndice = dataKey(data) + '\\u0001' + valorConciliacaoEmCentavos(428.36);
  const indice = new Map([[chaveIndice, movimentos.map((mov, idxMov) => ({ mov, idxMov }))]]);
  const usados = new Set();
  const sugestoes = new Map();
  autoConciliarPorContaDataValor(pagamentos, indice, usados, sugestoes);

  const sugestoesIncompletas = new Map();
  autoConciliarPorContaDataValor(pagamentos, new Map([[chaveIndice,
    [{ mov: movimentos[0], idxMov: 0 }]]]), new Set(), sugestoesIncompletas);

  return {
    quantidadeSemSobreposicao: semSobreposicao.length,
    repeticoesReaisPreservadas: semSobreposicao.filter(m => m.historico === 'MESMA LINHA').length,
    conciliados: sugestoes.size,
    usados: usados.size,
    regra: sugestoes.get(0)?.regra,
    incompletosConciliados: sugestoesIncompletas.size
  };
})()`, contexto);

assert.equal(resultado.quantidadeSemSobreposicao, 3);
assert.equal(resultado.repeticoesReaisPreservadas, 2);
assert.equal(resultado.conciliados, 2);
assert.equal(resultado.usados, 2);
assert.equal(resultado.regra, 'Conta financeira + data + valor');
assert.equal(resultado.incompletosConciliados, 0);
assert.match(html, /já .*possui.* apenas do vínculo com o extrato/u);

console.log(JSON.stringify(resultado, null, 2));
