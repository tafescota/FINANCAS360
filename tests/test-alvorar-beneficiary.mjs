import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx=contextoAplicacao();
const run=code=>vm.runInContext(code,ctx);
run(`
grupoAtivo='ALVORAR';configGrupos={ALVORAR:{modoImportacaoPagamentos:'alvorar'},OUTRO:{modoImportacaoPagamentos:'parcelas'}};
const nomes=['ANA RITA SOUZA UCHOA','ANA RITA SILVA SOUZA'];
const pagamentosTeste=nomes.map((fornecedor,idx)=>({idx,fornecedor,conta:'PCA - 14155 - ITAU',dataKey:'25/09/2026',valor:902.79}));
const movimentosTeste=nomes.map((complemento,idxMov)=>({idxMov,mov:{conta:'PCA - 14155 - ITAU',valor:-902.79,complemento}}));
const indiceTeste=new Map([['25/09/2026\\u000190279',movimentosTeste]]);
const usadosTeste=new Set();const sugestoesTeste=new Map();
conciliarBeneficiariosExatosAlvorar(pagamentosTeste,indiceTeste,usadosTeste,sugestoesTeste);
`);
assert.equal(run('sugestoesTeste.size'),2);
assert.equal(run('sugestoesTeste.get(0).mov.complemento'),'ANA RITA SOUZA UCHOA');
assert.equal(run('sugestoesTeste.get(1).mov.complemento'),'ANA RITA SILVA SOUZA');
run(`usadosTeste.clear();sugestoesTeste.clear();conciliarBeneficiariosExatosAlvorar([pagamentosTeste[0],{...pagamentosTeste[0],idx:2}],indiceTeste,usadosTeste,sugestoesTeste);`);
assert.equal(run('sugestoesTeste.size'),0,'Dois titulos disputando a mesma saida nao devem ser forçados');
run(`usadosTeste.clear();sugestoesTeste.clear();const positivo=new Map([['25/09/2026\\u000190279',[{idxMov:9,mov:{conta:pagamentosTeste[0].conta,valor:902.79,complemento:nomes[0]}}]]]);conciliarBeneficiariosExatosAlvorar([pagamentosTeste[0]],positivo,usadosTeste,sugestoesTeste);`);
assert.equal(run('sugestoesTeste.size'),0,'Devolucao positiva nao deve quitar titulo de pagamento');
run(`grupoAtivo='OUTRO';conciliarBeneficiariosExatosAlvorar(pagamentosTeste,indiceTeste,usadosTeste,sugestoesTeste);`);
assert.equal(run('sugestoesTeste.size'),0,'Nao mudar os demais formatos');
console.log('ALVORAR: beneficiarios distintos, exclusividade e devolucao preservada conferidos.');
