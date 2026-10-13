import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

export function contextoAplicacao(arquivo = new URL('../index.html', import.meta.url)) {
  const html = fs.readFileSync(arquivo, 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/i)[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
  const elementos = new Map();
  const storage = new Map();
  const elemento = () => ({
    addEventListener() {}, appendChild() {}, remove() {}, focus() {}, insertAdjacentHTML() {},
    classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, value: '',
    textContent: '', innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; }
  });
  const ctx = vm.createContext({
    console, alert() {}, confirm() { return true; }, CSS: { escape: String },
    document: {
      addEventListener() {}, body: elemento(), createElement: elemento,
      getElementById(id) { if (!elementos.has(id)) elementos.set(id, elemento()); return elementos.get(id); },
      querySelector() { return null; }, querySelectorAll() { return []; }
    },
    localStorage: { getItem(k) { return storage.get(k) || null; }, setItem(k,v) { storage.set(k,v); }, removeItem(k) { storage.delete(k); } },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, window: { addEventListener() {} },
    XLSX: { utils: { sheet_to_json(ws) { return ws; }, aoa_to_sheet(data) { return {data}; }, book_append_sheet(wb, ws, name) { wb[name] = ws.data; } } }
  });
  vm.runInContext(script, ctx);
  return ctx;
}

const ctx = contextoAplicacao();
const run = code => vm.runInContext(code, ctx);
const arquivoAnterior = new URL('../_restore-points/antes-cnpj-transferencias-20261013/index.html',import.meta.url);
if (fs.existsSync(arquivoAnterior)) {
  const anterior = contextoAplicacao(arquivoAnterior);
  for(const nome of ['paresTransferenciasExtrato','montarLinhasDominioPagamentos','pagamentoEhReembolsoTributarioMatriz','adicionarAbaConferenciaNumerarios']) {
    assert.equal(run(`${nome}.toString()`),vm.runInContext(`${nome}.toString()`,anterior),`${nome} deve permanecer inalterada`);
  }
}
run(`
grupoAtivo = 'VD'; configGrupos = {VD:{modoImportacaoPagamentos:'parcelas'}, OUTRO:{modoImportacaoPagamentos:'parcelas'}};
function tituloConta(conta, cnpj) { const r=Array(23).fill(''); r[14]=conta; r[22]=cnpj; return r; }
const parTeste = {saida:{conta:'CEF VD'},entrada:{conta:'BRADESCO VD'}};
registrarMapaCnpjContasImportadas([tituloConta('CEF VD','20.275.872/0001-70'),tituloConta('BRADESCO VD','20275872000170')]);
`);
assert.equal(run('classificarTransferenciaEntreContas(parTeste).tipo'), 'PROPRIO');
assert.equal(run('classificarTransferenciaEntreContas(parTeste).criterio'), 'cnpj-completo');
run(`registrarMapaCnpjContasImportadas([tituloConta('CEF VD','20.275.872/0001-70'),tituloConta('BRADESCO VD','20.275.872/0002-50')]);`);
assert.equal(run('classificarTransferenciaEntreContas(parTeste).tipo'), 'NUMERARIOS', 'Filiais da mesma raiz devem ser diferentes');
run(`registrarMapaCnpjContasImportadas([tituloConta('HFC - BANCO','20275872000170'),tituloConta('HFC - APLICAÇÃO','20275872000250')]);`);
assert.equal(run(`classificarTransferenciaEntreContas({saida:{conta:'HFC - BANCO'},entrada:{conta:'HFC - APLICAÇÃO'}}).tipo`),'NUMERARIOS','CNPJ completo tem prioridade sobre nomes iguais');
run(`registrarMapaCnpjContasImportadas([tituloConta('CEF VD','20275872000170'),tituloConta('CEF VD','20275872000250'),tituloConta('BRADESCO VD','20275872000170')]);`);
assert.equal(run('cnpjContaFinanceira("CEF VD")'), '');
assert.equal(run('classificarTransferenciaEntreContas(parTeste).criterio'), 'identificacao-incompleta');
run(`registrarMapaCnpjContasImportadas([tituloConta('CEF VD','20275872000170')]); configGrupos.VD.cnpjContasFinanceiras={'bradesco vd':'20275872000170'};`);
assert.equal(run('classificarTransferenciaEntreContas(parTeste).tipo'), 'PROPRIO');
run(`grupoAtivo='OUTRO';`);
assert.equal(run('cnpjContaFinanceira("BRADESCO VD")'), '');
assert.equal(run('cnpjContaFinanceira("CEF VD")'), '');
run(`grupoAtivo='VD'; registrarMapaCnpjContasImportadas([tituloConta('CEF VD','20275872000250')]); configGrupos.VD.cnpjContasFinanceiras['cef vd']='20275872000170';`);
assert.equal(run('cnpjContaFinanceira("CEF VD")'), '', 'Cadastro divergente nao pode sobrescrever a empresa importada');
assert.equal(run('normalizarCnpjConta("12345678")'), '');
assert.equal(run('normalizarCnpjConta("abc20275872000170")'), '');
assert.equal(run('normalizarCnpjConta("00275872000170")'), '00275872000170', 'Preservar zeros iniciais');
run(`
document.getElementById('modal-cnpj-contas').dataset.grupo='VD';
document.querySelectorAll=()=>[{dataset:{cnpjConta:'GARANTIDA VD'},value:'20.275.872/0001-70',readOnly:false}];
salvarModalCnpjContas();
`);
assert.equal(run(`JSON.parse(localStorage.getItem(STORAGE_CONFIG_GRUPOS)).VD.cnpjContasFinanceiras['garantida vd']`), '20275872000170');
assert.equal(run(`camposAlteradosPendentesPorGrupo.get('VD').has('configGrupos')`), true);
assert.equal(run(`camposAlteradosPendentesPorGrupo.has('OUTRO')`), false);
run(`const salvoCnpj=localStorage.getItem(STORAGE_CONFIG_GRUPOS); configGrupos=JSON.parse(salvoCnpj); mapaCnpjContasImportadas={};`);
assert.equal(run('cnpjContaFinanceira("GARANTIDA VD")'), '20275872000170');
run(`limparSessaoImportacao();`);
assert.equal(run('grupoMapaCnpjContasImportadas'), '');
const headers = ['Tipo','Empresa','Cliente / Fornecedor','Liquidação','Plano de Contas','Centro de Custos','Conta','Valor Líquido','Empresa (CNPJ)'];
ctx.workbook = {SheetNames:['Parcelas'],Sheets:{Parcelas:[headers,['Conta a Pagar','VD 108','Fornecedor','01/06/2026','Despesa','VD','CEF VD',1,'20275872000170']]}};
assert.equal(run(`linhasPlanilhaTitulos(workbook,'f360_original').dados[0].__empresaCnpj`), '20275872000170');
console.log('CNPJ: mesma empresa, filiais, ambiguidades, fallback, persistencia e isolamento por grupo conferidos.');
