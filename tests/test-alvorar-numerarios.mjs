import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx=contextoAplicacao();
const run=code=>vm.runInContext(code,ctx);
run(`
grupoAtivo='ALVORAR';configGrupos={ALVORAR:{modoImportacaoPagamentos:'alvorar'},OUTRO:{modoImportacaoPagamentos:'parcelas'}};
function tituloAlvorar(empresa,cnpj,conta,centro='Rateado') {
  const row=Array(27).fill('');row[0]='Conta a Pagar';row[3]=empresa;row[4]='FORNECEDOR TESTE';row[7]=new Date(2026,8,1);row[8]=10;row[10]='Despesa';row[11]=centro;row[13]=10;row[14]=conta;row[16]='Outros';row[22]=cnpj;return row;
}
const titulosTeste=[tituloAlvorar('3337','23083975000126','MNN-3337 - SICOOB'),tituloAlvorar('5312','23083975000207','MNN-3337 - SICOOB'),tituloAlvorar('910301','01872967000479','SERLOC QDB - 910301 - SICOOB')];
registrarMapaEmpresasImportadas(titulosTeste);registrarMapaCnpjContasImportadas(titulosTeste);
titulosTeste.forEach(prepararLinhaParcelasNumerarios);
`);
assert.equal(run(`empresaOrigemLinha(titulosTeste[1])`),'3337');
assert.equal(run(`centroCustoLinha(titulosTeste[1])`),'5312');
assert.equal(run(`parcelasNumerariosLinha(titulosTeste[1])`),true);
assert.equal(run(`parcelasNumerariosLinha(titulosTeste[0])`),false);
assert.equal(run(`empresaMatrizFilialExportacao('5312 - MNN - LOJA','MNN-3337 - SICOOB')`),'5312');
assert.equal(run(`cnpjContaFinanceira('MNN - 3337 - SICOOB')`),'23083975000126');
assert.equal(run(`codigoEmpresaAlvorar('SICOOB 3337 E 5312')`),'');
assert.equal(run(`codigoEmpresaAlvorar('CONTA 999999')`),'');
assert.equal(run(`classificarTransferenciaEntreContas({saida:{conta:'MNN-3337 - SICOOB'},entrada:{conta:'MNN - 3337 - ITAU'}}).tipo`),'PROPRIO');
assert.equal(run(`classificarTransferenciaEntreContas({saida:{conta:'MNN-3337 - SICOOB'},entrada:{conta:'CAIXA LOJA - 5312'}}).tipo`),'NUMERARIOS');
assert.equal(run(`classificarTransferenciaEntreContas({saida:{conta:'BANCO SEM EMPRESA'},entrada:{conta:'MNN-3337 - SICOOB'}}).criterio`),'identificacao-incompleta');
run(`linhasImportadas=titulosTeste;extratoBancarioTemp=[{conta:'MNN-3337 - SICOOB',data:new Date(2026,8,1),valor:10,tipoConciliacao:'Transferência entre Contas',complemento:'CAIXA LOJA - 3337'}];`);
assert.equal(run(`regrasTransitoParcelas().length`),0,'Sem extrato caixa nao pedir transito por conta do titulo');
assert.equal(run(`movimentosTransitoParcelas().size`),0,'Sem extrato caixa nao inventar a outra ponta');
run(`extratoBancarioTemp.push({conta:'CAIXA LOJA - 3337',data:new Date(2026,8,2),valor:-10,tipoConciliacao:'Transferência entre Contas',complemento:'MNN-3337 - SICOOB'});`);
assert.equal(run(`regrasTransitoParcelas().length`),1,'Caixa importado em outro mes deve funcionar normalmente');
assert.equal(run(`movimentosTransitoParcelas().size`),2);
run(`sugestoesParcelasExtratoTemp=[];depara.ALVORAR={};`);
assert.equal(run(`validarExportacaoParcelasExtrato([['01/09/2026','999301','MNN-3337 - SICOOB',10,'','','','SEM EMPRESA']])`),false);
run(`grupoAtivo='OUTRO';`);
assert.equal(run(`cnpjContaFinanceira('MNN-3337 - SICOOB')`),'');
assert.equal(run(`grupoUsaNumerariosParcelas()`),false);
run(`limparSessaoImportacao();`);
assert.equal(run(`codigosEmpresasAlvorar.size`),0);
assert.equal(run(`Object.keys(mapaCnpjEmpresasAlvorar).length`),0);
console.log('ALVORAR: codigos, filiais, titularidade, nomes, escopo por extratos e caixa futuro conferidos.');
