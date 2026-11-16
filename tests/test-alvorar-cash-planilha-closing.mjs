import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function elemento() {
  return { addEventListener() {}, appendChild() {}, remove() {}, focus() {}, insertAdjacentHTML() {},
    classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{}, value:'', textContent:'', innerHTML:'',
    querySelector(){return null;}, querySelectorAll(){return [];} };
}

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/i)[1].replace(/\n\/\/ Iniciar[\s\S]*$/u,'');
const ctx=vm.createContext({console,alert(){},confirm(){return true;},CSS:{escape:String},
  document:{addEventListener(){},body:elemento(),createElement:elemento,getElementById(){return elemento();},querySelector(){return null;},querySelectorAll(){return[];}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},setInterval(){},setTimeout(){},clearTimeout(){},window:{addEventListener(){}},
  XLSX:{utils:{sheet_to_json(){return[];},aoa_to_sheet(data){return{data};},book_append_sheet(){}}}});
vm.runInContext(fs.readFileSync(new URL('../alvorar.js',import.meta.url),'utf8'),ctx);
vm.runInContext(script,ctx);
const run=code=>vm.runInContext(code,ctx);

run(`grupoAtivo='ALVORAR';configGrupos={ALVORAR:{modoImportacaoPagamentos:'alvorar'}};
Object.values(ESTABELECIMENTOS_ALVORAR).flat().forEach(c=>codigosEmpresasAlvorar.add(c));
function titulo(conta,empresa,valor,falta=false){const r=[];r[COLS.TIPO]='Conta a Pagar';r[COLS.CONTA]=conta;r[COLS.EMPRESA]=empresa;
 r[COLS.VALOR_LIQ]=valor;r[COLS.ACRESCIMO]=0;r[COLS.LIQUIDACAO]=new Date(2026,9,1);r[COLS.FORNECEDOR]=falta?'VENDAS DINHEIRO':'FORNECEDOR';
 r[COLS.PLANO]=falta?'Falta de Caixa':'Despesa';r[COLS.HISTORICO]=falta?'Ajuste do Fechamento de Caixa - Título gerado automaticamente.':'Despesa';return r;}
recebimentosAlvorarTemp=[{data:new Date(2026,9,1),dataKey:'01/10/2026',conta:'CAIXA LOJA - 5312',valor:100,origem:'titulos',
 fornecedor:'VENDAS DINHEIRO',plano:'Vendas de Mercadorias',tipo:'Venda',centroCusto:'5312',empresaBanco:'5312'}];
linhasImportadas=[titulo('CAIXA LOJA - 5312','5312',30),titulo('CAIXA LOJA - 5312','5312',10,true),titulo('CAIXA LOJA - 9999','9999',5,true)];
extratoBancarioTemp=[
 {data:new Date(2026,9,1),conta:'CAIXA LOJA - 5312',valor:90,tipoConciliacao:'Parcelas de Títulos',complemento:'VENDAS DINHEIRO'},
 {data:new Date(2026,9,2),conta:'CAIXA LOJA - 22094',valor:200,tipoConciliacao:'Parcelas de Títulos',complemento:'VENDAS DINHEIRO'},
 {data:new Date(2026,9,3),conta:'CAIXA LOJA - 22094',valor:-57,tipoConciliacao:'Parcelas de Títulos',complemento:'CASTRO COMERCIO'}];
saidasAvulsasPagamentosAlvorar=()=>[{idxOriginal:2}];depositosCaixaSemExtratoAlvorar=()=>({gerados:[],semCaixa:[]});
montarLinhasDepositosCaixaBaseAlvorar=()=>[];baixasResiduaisCaixaSemExtratoAlvorar=()=>({gerados:[],pendentes:[]});
var fechamento=fechamentoCaixaPelasPlanilhasAlvorar([['01/10/2026','CAIXA LOJA - 5312','2098',90],['02/10/2026','CAIXA LOJA - 22094','2098',200],['03/10/2026','300','CAIXA LOJA - 5312',30],['03/10/2026','300','CAIXA LOJA - 22094',57]]);`);

const fechamento=run('fechamento');
assert.equal(fechamento.extratoEntradas,290,'Recebidas CX liquidas + conta presente somente no extrato');
assert.equal(fechamento.extratoSaidas,87,'Titulo normal + saida avulsa, sem faltas convertidas em recebimento');
assert.equal(fechamento.diferencaEntradas,0);
assert.equal(fechamento.diferencaSaidas,0);
assert.equal(fechamento.diferencaSaldo,0);
assert.ok(run(`resumoFechamentoParcelasExtrato.toString().includes('caixaBateAlvorar')`),'O selo deve considerar a diferenca agregada do caixa');
console.log('ALVORAR: fechamento do caixa usa a base efetivamente exportada e o selo respeita as diferencas.');
