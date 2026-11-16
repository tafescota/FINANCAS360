import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const elemento=()=>({addEventListener(){},appendChild(){},remove(){},focus(){},insertAdjacentHTML(){},
  classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},value:'',textContent:'',innerHTML:'',
  querySelector(){return null;},querySelectorAll(){return[];}});
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
var linhasConsolidadasTeste=[
 Object.assign(['01/10/2026','100','200',10,'','Pagamento','','3337','','','',''],{movimentoExportacaoAlvorar:'Pagamentos',tipoExtratoAlvorar:'Banco'}),
 Object.assign(['02/10/2026','300','400',20,'','Recebimento','','5312','','','',''],{movimentoExportacaoAlvorar:'Recebimentos',tipoExtratoAlvorar:'Caixa'}),
 Object.assign(['03/10/2026','500','600',30,'','Transferencia','','14155','','','',''],{movimentoExportacaoAlvorar:'Transferencias',tipoExtratoAlvorar:'Banco'})];
var finaisPorMatrizTeste=consolidarExportacaoFinalPorMatrizAlvorar(linhasConsolidadasTeste);`);

assert.deepEqual(Array.from(run('[...finaisPorMatrizTeste.keys()].sort()')),
  ['Importacao Final/MNN.xlsx','Importacao Final/PCA.xlsx']);
assert.equal(run("finaisPorMatrizTeste.get('Importacao Final/MNN.xlsx').length"),2);
assert.equal(run("finaisPorMatrizTeste.get('Importacao Final/PCA.xlsx').length"),1);
assert.equal(run('[...finaisPorMatrizTeste.values()].flat().length'),3,'Nao perder nem duplicar lancamentos');
assert.equal(run("tipoRecebimentoAlvorar({origem:'cartoes',adquirente:'PIX Bancário'})"),'PIX - PIX Bancário');
const require=createRequire(import.meta.url);
ctx.XLSX=require('../../outputs/ANALISE_INICIAL_ALVORAR_20261014/xlsx-teste.min.js');
ctx.Blob=Blob;ctx.TextEncoder=TextEncoder;
ctx.URL={createObjectURL(blob){ctx.zipFinalConsolidadoTeste=blob;return 'blob:teste';},revokeObjectURL(){}};
ctx.document.createElement=()=>({click(){}});
run('aguardarPinturaInterface=()=>Promise.resolve()');
await run('exportarZipAlvorar(linhasConsolidadasTeste,{separarMovimentos:true})');
const zip=ctx.XLSX.CFB.read(new Uint8Array(await ctx.zipFinalConsolidadoTeste.arrayBuffer()),{type:'array'});
const nomes=zip.FullPaths.map(p=>p.replace(/^[^/]+\//,''));
assert.ok(nomes.includes('Importacao Final/MNN.xlsx'));
assert.ok(nomes.includes('Importacao Final/PCA.xlsx'));
for(const nome of ['Importacao Final/MNN.xlsx','Importacao Final/PCA.xlsx']) {
  const wb=ctx.XLSX.read(zip.FileIndex[nomes.indexOf(nome)].content,{type:'array'});
  assert.deepEqual(wb.SheetNames,['Lancamentos Dominio']);
}
const leiaMe=new TextDecoder().decode(zip.FileIndex[nomes.indexOf('LEIA-ME.txt')].content);
assert.match(leiaMe,/Importacao Final OU as pastas separadas/i);
console.log('ALVORAR: Importacao Final consolida todos os movimentos por matriz e classifica PIX corretamente.');
