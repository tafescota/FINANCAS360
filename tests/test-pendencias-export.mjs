import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx = contextoAplicacao();
const run = code => vm.runInContext(code, ctx);
run(`
grupoAtivo='ALVORAR'; configGrupos={ALVORAR:{modoImportacaoPagamentos:'alvorar'}};
conciliacaoItensTemp=Array.from({length:720},(_,i)=>({id:'s'+i,movimento:'saida-pendente',
  historico:i<710?'HAGANA DEBITO':'OUTRO',conta:'BANCO 3337',data:'10/09/2026',total:119.8,empresaBanco:'3337'}));
conciliacaoItensTemp.push({id:'r',movimento:'recebimento',historico:'HAGANA PIX',qtd:25,total:7944.48});
conciliacaoItensTemp.push({id:'n',movimento:'numerario-rateio',naturezaNumerario:'passivo',total:42});
conciliacaoItensTemp.push({id:'p',movimento:'pagamento-pendente',total:15});
codigosConciliacaoTemp={s0:'123'};saidasExtratoRevisadasConciliacaoTemp={s1:true};
vinculosPagamentoConciliacaoTemp={p:'0'};filtroPendenciasConciliacaoTemp='hagana';
XLSX.utils.book_new=()=>({});XLSX.writeFile=(wb,nome)=>{globalThis.exportado={wb,nome};};
const antesExportar=JSON.stringify([conciliacaoItensTemp,codigosConciliacaoTemp,saidasExtratoRevisadasConciliacaoTemp,
  vinculosPagamentoConciliacaoTemp,depara,deparaRecebimentos,configGrupos]);
document.getElementById('escopo-exportacao-pendencias').value='filtradas';
exportarPendenciasConciliacao();
`);
assert.equal(run('exportado.wb.Pendencias.length'),710,'Exportar todos os filtrados, inclusive alem dos 650 renderizados');
assert.equal(run('exportado.wb.Pendencias[1][11]'),119.8);
assert.equal(run('exportado.wb.Pendencias.at(-1)[10]'),25);
assert.equal(run('exportado.wb.Contexto.find(r=>r[0]==="Pesquisa")[1]'),'hagana');
assert.match(run('exportado.nome'),/filtradas.*\.xlsx$/);
run(`document.getElementById('escopo-exportacao-pendencias').value='todas';exportarPendenciasConciliacao();`);
assert.equal(run('exportado.wb.Pendencias.length'),721);
assert.equal(run('exportado.wb.Pendencias.at(-1)[7]'),'Numerarios passivo');
assert.equal(run('JSON.stringify([conciliacaoItensTemp,codigosConciliacaoTemp,saidasExtratoRevisadasConciliacaoTemp,vinculosPagamentoConciliacaoTemp,depara,deparaRecebimentos,configGrupos])===antesExportar'),true,'Exportar nao salva nem modifica regras ou preenchimentos');
run(`filtroPendenciasConciliacaoTemp='inexistente';document.getElementById('escopo-exportacao-pendencias').value='filtradas';exportado=null;exportarPendenciasConciliacao();`);
assert.equal(run('exportado'),null);
for (const modo of ['parcelas','cp_simone','alvorar','f360_original']) {
  run(`configGrupos.ALVORAR.modoImportacaoPagamentos=${JSON.stringify(modo)};`);
  assert.ok(run(`itensPendentesConciliacao('').length`)>0);
}
console.log('Exportacao: filtros, todos os itens, valores numericos, grupos e ausencia de gravacao conferidos.');
