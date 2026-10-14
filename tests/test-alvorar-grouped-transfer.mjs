import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx=contextoAplicacao();
const run=code=>vm.runInContext(code,ctx);
run(`
grupoAtivo='ALVORAR';configGrupos={ALVORAR:{modoImportacaoPagamentos:'alvorar'},OUTRO:{modoImportacaoPagamentos:'parcelas'}};
registrarMapaEmpresasImportadas([{3:'3337'},{3:'5312'}]);
const origemTeste='MNN-3337 - ITAU';const destinoTeste='MNN-3337 - SICOOB';
const movimentosAgrupados=[{conta:origemTeste,data:new Date(2026,8,17),valor:-1390000,complemento:destinoTeste,tipoConciliacao:'Transferência entre Contas'},
{conta:destinoTeste,data:new Date(2026,8,17),valor:1000000,complemento:origemTeste,tipoConciliacao:'Transferência entre Contas'},
{conta:destinoTeste,data:new Date(2026,8,17),valor:390000,complemento:origemTeste,tipoConciliacao:'Transferência entre Contas'}];
extratoBancarioTemp=movimentosAgrupados;
`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),1);
assert.equal(run('indicesTransferenciasPareadas().size'),3);
assert.equal(run('contarTransferenciasPareadas()'),1);
assert.equal(run('itensNumerarioTransferenciasPareadas().length'),0);
assert.equal(run('montarLinhasDominioConciliacao({validarPendencias:false}).length'),2);
assert.equal(run('conferirParcelasPorContaDia(montarLinhasDominioConciliacao({validarPendencias:false})).length'),0);
run(`extratoBancarioTemp=movimentosAgrupados.map(m=>({...m}));extratoBancarioTemp[2].data=new Date(2026,8,18);`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),0,'Nao alterar datas para fechar transferencia');
run(`extratoBancarioTemp=movimentosAgrupados.map(m=>({...m}));extratoBancarioTemp[2].valor=389999.99;`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),0,'Soma deve ser exata');
run(`extratoBancarioTemp=movimentosAgrupados.map(m=>({...m}));extratoBancarioTemp.push({...extratoBancarioTemp[0]});`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),0,'Nao escolher entre saidas ambiguas');
run(`extratoBancarioTemp=movimentosAgrupados.map(m=>({...m,conta:m.valor>0?'BANCO 5312':m.conta,complemento:m.valor<0?'BANCO 5312':m.complemento}));`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),0,'Entre empresas diferentes nao usar agrupamento proprio');
run(`extratoBancarioTemp=movimentosAgrupados;grupoAtivo='OUTRO';`);
assert.equal(run('transferenciasAgrupadasAlvorar().length'),0);
console.log('ALVORAR: transferencia propria dividida, centavos, datas, ambiguidades e isolamento conferidos.');
