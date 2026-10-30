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
const XLSX = {
  utils: {
    aoa_to_sheet(data) { return { data }; },
    book_append_sheet(wb, ws, name) { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
  }
};
const contexto = vm.createContext({
  alert() {}, confirm() { return true; }, console, CSS: { escape: String }, XLSX,
  formatarUnidadesExcelAlvorar() {},
  document: {
    addEventListener() {}, body: elemento, createElement() { return { ...elemento }; },
    getElementById() { return { ...elemento }; }, querySelector() { return null; }, querySelectorAll() { return []; },
  },
  fetch: async () => ({ ok: true, json: async () => ({ grupos: [], depara: {} }) }),
  localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
  setInterval() {}, setTimeout(fn) { return fn(); }, window: { addEventListener() {} },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`
  grupoAtivo = 'ANA RITA';
  configGrupos = { 'ANA RITA': { modoImportacaoPagamentos: 'ana_rita', layoutImportacaoPagamentos: 'f360_original' } };
  lancamentosDesconsideradosExportacao = [];
  const wb = { SheetNames: [], Sheets: {} };
  const linha = empresa => ['01/09/2026', '100', '200', 10, '', 'Teste', '', empresa, '', '', ''];
  adicionarAbasDominioExportacao(wb, [
    linha('5227 - BERIMBAU - LOJA'),
    linha('18837 - BERIMBAU - VD'),
    linha('8362 - IRARÁ - LOJA')
  ], true);
  ({
    modo: modoImportacaoDoGrupo(),
    layout: layoutImportacaoDoGrupo(),
    numerarios: grupoUsaNumerariosParcelas(),
    recebimentosExtrato: conciliacaoUsaRecebimentosDoExtrato(),
    recebimentosSeparados: grupoPodeRecebimentosSeparados(),
    nomes: wb.SheetNames,
    linhasAnaRita: wb.Sheets['ANA RITA - MATRIZ E FILIAL']?.data?.length,
    linhasCamille: wb.Sheets.CAMILLE?.data?.length
  });
`, contexto);

if (resultado.modo !== 'ana_rita' || resultado.layout !== 'f360_original') {
  throw new Error(`O formato ANA RITA não foi reconhecido: ${JSON.stringify(resultado)}.`);
}
if (!resultado.numerarios || !resultado.recebimentosExtrato || resultado.recebimentosSeparados) {
  throw new Error(`O fluxo ANA RITA não ficou unificado: ${JSON.stringify(resultado)}.`);
}
const esperadas = ['Consolidado', 'ANA RITA - MATRIZ E FILIAL', 'CAMILLE'];
if (JSON.stringify(resultado.nomes) !== JSON.stringify(esperadas)) {
  throw new Error(`As abas ANA RITA não foram agrupadas corretamente: ${JSON.stringify(resultado.nomes)}.`);
}
if (resultado.linhasAnaRita !== 3 || resultado.linhasCamille !== 2) {
  throw new Error(`A quantidade de linhas nas abas está incorreta: ${JSON.stringify(resultado)}.`);
}

console.log(JSON.stringify(resultado, null, 2));
