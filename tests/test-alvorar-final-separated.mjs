import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx=contextoAplicacao();
const run=code=>vm.runInContext(code,ctx);
const setup=fs.readFileSync(new URL('test-alvorar-payments-export.mjs',import.meta.url),'utf8').match(/run\(`([\s\S]*?)`\);/)[1];
run(setup);
run(`
extratoBancarioTemp[5].tipoConciliacao='Outras saidas';
gerarSugestoesConciliacao({redirecionarSeOk:false});
conciliacaoItensTemp.forEach(i=>{if(i.movimento==='recebimento')codigosConciliacaoTemp[i.id]='1152';
 if(i.movimento==='saida-pendente')codigosConciliacaoTemp[i.id]='455';});
salvarRegrasRecebimentoConciliacao();
const finalSeparadoTeste=montarExportacaoFinalAlvorar();
const gruposSeparadosTeste=particionarExportacaoAlvorar(finalSeparadoTeste,{separarMovimentos:true});
const importacaoFinalTeste=consolidarExportacaoFinalPorMatrizAlvorar(finalSeparadoTeste);
`);
assert.ok(run('finalSeparadoTeste?.length>0'));
assert.equal(run('conferirParcelasPorContaDia(finalSeparadoTeste).length'),0,'Conjunto completo bate por conta/dia');
assert.equal(run('[...gruposSeparadosTeste.values()].reduce((s,rows)=>s+rows.length,0)'),run('finalSeparadoTeste.length'));
assert.deepEqual(Array.from(run('[...gruposSeparadosTeste.keys()].sort()')), [
 'Pagamentos/Banco/MNN.xlsx','Pagamentos/Caixa/PCA.xlsx',
 'Recebimentos/Banco/MNN.xlsx','Recebimentos/Caixa/PCA.xlsx',
 'Transferencias/Banco/MNN.xlsx','Transferencias/Caixa/MNN.xlsx']);
assert.deepEqual(Array.from(run('[...importacaoFinalTeste.keys()].sort()')), [
 'Importacao Final/MNN.xlsx','Importacao Final/PCA.xlsx']);
assert.equal(run('[...importacaoFinalTeste.values()].reduce((s,rows)=>s+rows.length,0)'),run('finalSeparadoTeste.length'),
 'Importacao Final deve conter cada lancamento uma unica vez');
assert.equal(run("importacaoFinalTeste.get('Importacao Final/MNN.xlsx').every(l=>familiaEmpresaAlvorar(l[7])==='MNN')"),true);
assert.equal(run("importacaoFinalTeste.get('Importacao Final/PCA.xlsx').every(l=>familiaEmpresaAlvorar(l[7])==='PCA')"),true);
assert.equal(run("gruposSeparadosTeste.get('Pagamentos/Banco/MNN.xlsx').filter(l=>l[7]==='5312').length"),2,'Numerarios da filial acompanham o pagamento, nao os recebimentos');
assert.equal(run("[...gruposSeparadosTeste].filter(([n])=>n.startsWith('Recebimentos/')).flatMap(([,r])=>r).some(l=>l[5].includes('FORNECEDOR'))"),false);
assert.equal(run("[...gruposSeparadosTeste].filter(([n])=>n.startsWith('Transferencias/')).flatMap(([,r])=>r).filter(l=>l[1]==='51531'||l[2]==='51531').length"),2,'Deposito independente em cada data, sem duplicar em outras pastas');
assert.throws(()=>run("particionarExportacaoAlvorar([finalSeparadoTeste[0].slice()],{separarMovimentos:true})"),/sem origem/,'Nao inferir grupo de exportacao pelo codigo da conta');
const require=createRequire(import.meta.url);
ctx.XLSX=require('../../outputs/ANALISE_INICIAL_ALVORAR_20261014/xlsx-teste.min.js');
ctx.Blob=Blob;ctx.TextEncoder=TextEncoder;
ctx.URL={createObjectURL(blob){ctx.zipFinalSeparadoTeste=blob;return 'blob:teste';},revokeObjectURL(){}};
ctx.document.createElement=()=>({click(){ctx.nomeFinalSeparadoTeste=this.download;}});
run('aguardarPinturaInterface=()=>Promise.resolve()');
await run('exportarDominioFinal()');
assert.ok(ctx.zipFinalSeparadoTeste,'Botao normal de final deve gerar ZIP separado');
assert.match(ctx.nomeFinalSeparadoTeste,/^Dominio_ALVORAR_Final_Separado_.*\.zip$/);
const zip=ctx.XLSX.CFB.read(new Uint8Array(await ctx.zipFinalSeparadoTeste.arrayBuffer()),{type:'array'});
const names=zip.FullPaths.map(p=>p.replace(/^[^/]+\//,''));
for(const name of run('[...gruposSeparadosTeste.keys()]')) {
 const entry=zip.FileIndex[names.indexOf(name)];assert.ok(entry?.content?.length,name);
 assert.ok(names.includes('Conferencia_ALVORAR.xlsx'));
 const workbook=ctx.XLSX.read(entry.content,{type:'array'});
 assert.deepEqual(workbook.SheetNames,['Lancamentos Dominio']);
 assert.equal(ctx.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1}).length-1,run(`gruposSeparadosTeste.get('${name}').length`));
}
for(const name of run('[...importacaoFinalTeste.keys()]')) {
 const entry=zip.FileIndex[names.indexOf(name)];assert.ok(entry?.content?.length,name);
 const workbook=ctx.XLSX.read(entry.content,{type:'array'});
 assert.equal(ctx.XLSX.utils.sheet_to_json(workbook.Sheets['Lancamentos Dominio'],{header:1}).length-1,
   run(`importacaoFinalTeste.get('${name}').length`));
}
const readme=zip.FileIndex[names.indexOf('LEIA-ME.txt')];
assert.match(new TextDecoder().decode(readme.content),/Importacao Final OU as pastas separadas/i);
assert.equal(run("tipoRecebimentoAlvorar({origem:'cartoes',adquirente:'PIX Bancário'})"),'PIX - PIX Bancário');
run('depara.ALVORAR={};gerarLancamentos(linhasImportadas,{})');
const finalSemContas=run('montarExportacaoFinalAlvorar()');
assert.ok(finalSemContas?.length,'Final tambem permite apenas contas dos titulos pendentes');
assert.ok(finalSemContas.filter(l=>!l[1]||!l[2]).every(l=>l.contaPendenteTituloAlvorar));
assert.equal(run('conferirParcelasPorContaDia(montarExportacaoFinalAlvorar()).length'),0);
await run('exportarDominioFinal()');
const zipComPendencias=ctx.XLSX.CFB.read(new Uint8Array(await ctx.zipFinalSeparadoTeste.arrayBuffer()),{type:'array'});
const conferenciaEntry=zipComPendencias.FileIndex[zipComPendencias.FullPaths.findIndex(p=>p.endsWith('/Conferencia_ALVORAR.xlsx'))];
assert.ok(ctx.XLSX.read(conferenciaEntry.content,{type:'array'}).Sheets['Contas pendentes']);
run('confirm=()=>false');
assert.equal(run('montarExportacaoFinalAlvorar()'),null,'Cancelamento vale tambem no final');
run('confirm=()=>true');
ctx.zipFinalSeparadoTeste=null;
run("extratoBancarioTemp.push({conta:'MNN-3337 - SICOOB',data:new Date(2026,8,5),valor:50,tipoConciliacao:'Parcelas de Cartões',complemento:'CARTAO SEM TITULARIDADE'})");
await run('exportarDominioFinal()');
assert.equal(ctx.zipFinalSeparadoTeste,null,'Nao exportar recebimentos sem confirmar origem');
assert.ok(run("avisosTeste.some(m=>m.includes('recebimentos'))"));
run(`grupoAtivo='OUTRO';configGrupos.OUTRO={modoImportacaoPagamentos:'cp_simone'};exportarDominioFinalAlvorar=()=>{throw new Error('Outro grupo nao pode usar final ALVORAR')};
bloquearExportacaoRecebimentosSemConciliacao=()=>true;`);
assert.doesNotThrow(()=>run('exportarDominioFinal()'));
console.log('ALVORAR: botao final, pagamentos/recebimentos/transferencias separados por familia/tipo, conjunto integral, numerarios, deposito e bloqueios conferidos.');
