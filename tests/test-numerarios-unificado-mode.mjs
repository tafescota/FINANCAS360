import assert from 'node:assert/strict';
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
const run = codigo => vm.runInContext(codigo, contexto);

run(`
  grupoAtivo = 'ANA RITA';
  configGrupos = {
    'ANA RITA': {
      modoImportacaoPagamentos: 'parcelas_numerarios_unificado',
      layoutImportacaoPagamentos: 'f360_original'
    },
    'NUMERARIOS LEGADO': { modoImportacaoPagamentos: 'parcelas_numerarios' }
  };
`);

assert.equal(run('modoImportacaoDoGrupo()'), 'parcelas_numerarios_unificado');
assert.equal(run('layoutImportacaoDoGrupo()'), 'f360_original');
assert.equal(run('grupoUsaNumerariosParcelas()'), true, 'O modo unificado deve gerar numerários.');
assert.equal(run('grupoParcelasConciliaPorExtrato()'), true, 'Títulos devem ser conciliados com os extratos.');
assert.equal(run('conciliacaoUsaRecebimentosDoExtrato()'), true, 'Entradas devem vir do mesmo extrato.');
assert.equal(run('grupoPodeRecebimentosSeparados()'), false, 'Não deve existir módulo separado de recebimentos.');
assert.equal(run('grupoPodeRecebimentosRateio()'), false, 'Não deve pedir outra planilha de recebimentos.');
assert.equal(run('modoPermiteProvisaoParcelas()'), true);
assert.match(run('nomeModoImportacao(modoImportacaoDoGrupo(), layoutImportacaoDoGrupo())'), /Numerários Unificado/);

assert.deepEqual(
  JSON.parse(run(`JSON.stringify(interpretarOpcaoFormatoPagamento('parcelas_numerarios_unificado__f360_original'))`)),
  { modo: 'parcelas_numerarios_unificado', layout: 'f360_original' }
);

run(`grupoAtivo = 'NUMERARIOS LEGADO';`);
assert.equal(run('grupoPodeRecebimentosSeparados()'), true, 'O formato legado deve manter o comportamento anterior.');
assert.equal(run('conciliacaoUsaRecebimentosDoExtrato()'), false, 'O formato legado ainda usa recebimentos separados.');

console.log('Numerários unificado: títulos, entradas e saídas no mesmo fluxo, sem alterar o modo legado.');
