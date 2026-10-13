import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx=contextoAplicacao();
const run=code=>vm.runInContext(code,ctx);
run(`
grupoAtivo='VD';configGrupos={VD:{modoImportacaoPagamentos:'parcelas'}};renderNovasChaves=()=>{};
function tituloTeste(conta,cnpj,empresa='VD 108',valor=10){const r=Array(23).fill('');r[0]='Conta a Pagar';r[3]=empresa;r[4]='FORNECEDOR';r[7]=new Date(2026,5,2);r[10]='DESPESA';r[13]=valor;r[14]=conta;r[16]='Outros';r[22]=cnpj;return r;}
prepararPagamentosImportados([tituloTeste('CAIXA VD','20275872000170'),tituloTeste('CEF VD','20275872000170')],false);
`);
assert.equal(run('novasChavesTemp.filter(n=>n.transitoParcelas).length'),1,'Transito precisa aparecer junto dos titulos');
run(`novasChavesTemp.filter(n=>n.transitoParcelas).forEach(n=>codigosTemp[n.chave]='777');salvarCodigosPreenchidosNoGrupo(false);`);
assert.equal(run('codigoContaTransitoParcelas("20275872000170")'),'777');
run(`prepararPagamentosImportados(linhasImportadas,false);`);
assert.equal(run('novasChavesTemp.filter(n=>n.transitoParcelas).length'),0,'Regra de transito salva nao deve voltar');
run(`extratoBancarioTemp=[
{data:new Date(2026,5,2),conta:'CAIXA VD',valor:-1000,historico:'CEF VD',tipoConciliacao:'Transferência entre Contas'},
{data:new Date(2026,5,3),conta:'CEF VD',valor:1000,complemento:'CAIXA VD',tipoConciliacao:'Transferência entre Contas'}];`);
assert.equal(run('movimentosTransitoParcelas().size'),2);
assert.equal(run('montarLinhasTransitoParcelas()[0][0]'),'02/06/2026');
assert.equal(run('montarLinhasTransitoParcelas()[1][0]'),'03/06/2026');
assert.equal(run('montarLinhasTransitoParcelas()[0][1]'),'777');
assert.equal(run('montarLinhasTransitoParcelas()[0][2]'),'CAIXA VD');
assert.equal(run('montarLinhasTransitoParcelas()[1][1]'),'CEF VD');
assert.equal(run('montarLinhasTransitoParcelas()[1][2]'),'777');
assert.equal(run('conferirParcelasPorContaDia(montarLinhasTransitoParcelas()).length'),0);
run(`
registrarMapaCnpjContasImportadas([tituloTeste('CAIXA VD','20275872000170'),tituloTeste('CEF VD','20275872000250')]);
`);
assert.equal(run('movimentosTransitoParcelas().size'),0,'Transito nao pode ligar CNPJs diferentes');
for(const modo of ['cp_simone','rateio','aromas']) {
  ctx.modoTeste=modo;
  run(`configGrupos.VD.modoImportacaoPagamentos=modoTeste;`);
  assert.equal(run('grupoParcelasConciliaPorExtrato()'),false);
  assert.equal(run('movimentosTransitoParcelas().size'),0);
}
run(`configGrupos.VD.modoImportacaoPagamentos='parcelas_numerarios';`);
assert.equal(run('grupoParcelasConciliaPorExtrato()'),true);
run(`linhasImportadas=[tituloTeste('CEF VD','20275872000170'),tituloTeste('OUTRA CONTA','20275872000250','FILIAL')];registrarMapaCnpjContasImportadas(linhasImportadas);`);
assert.equal(run(`empresaMatrizFilialExportacao('FILIAL','301','194','CEF VD')`),'FILIAL','Conta de origem nao pode trocar a empresa da despesa/numerario');
run(`
configGrupos.VD.modoImportacaoPagamentos='parcelas';
linhasImportadas=[tituloTeste('CEF VD','20275872000170')];registrarMapaCnpjContasImportadas(linhasImportadas);
lancamentosGerados=[{idx:0,codDebito:'301',codCredito:'CEF VD',valorLiq:10,data:'02/06/2026',empresa:'VD 108',complemento:'FORNECEDOR'}];
extratoBancarioTemp=[{conta:'CEF VD',valor:100,data:new Date(2026,5,1),historico:'RECEITA',tipoConciliacao:'Parcelas de Títulos'}];
gerarSugestoesConciliacao({redirecionarSeOk:false});
`);
assert.equal(run('montarPagamentosConciliadosParcelas().length'),0,'Titulo sem saida nao pode movimentar banco');
assert.equal(run(`conciliacaoItensTemp.some(i=>i.movimento==='pagamento-pendente')`),true);
run(`codigosConciliacaoTemp['pag-0']='301';salvarRegrasRecebimentoConciliacao();`);
assert.equal(run(`vinculosPagamentoConciliacaoTemp['pag-0']`),undefined,'Salvar conta nao equivale a revisar ausencia');
run(`vinculosPagamentoConciliacaoTemp['pag-0']=VINCULO_PAGAMENTO_SEM_EXTRATO;gerarSugestoesConciliacao({redirecionarSeOk:false});`);
assert.equal(run('montarPagamentosConciliadosParcelas().length'),0,'Titulo revisado sem extrato permanece excluido');
run(`
vinculosPagamentoConciliacaoTemp={};codigosConciliacaoTemp={};
extratoBancarioTemp=[{conta:'CEF VD',valor:-10,data:new Date(2026,5,3),documento:'DOC1',complemento:'FORNECEDOR',tipoConciliacao:'Parcelas de Títulos'}];
linhasImportadas[0][1]='DOC1';gerarSugestoesConciliacao({redirecionarSeOk:false});
`);
assert.equal(run('montarPagamentosConciliadosParcelas()[0][0]'),'03/06/2026','Usar a data efetiva do banco');
assert.equal(run('sugestoesParcelasExtratoTemp[0].status'),'provável');
assert.equal(run('validarExportacaoParcelasExtrato(montarPagamentosConciliadosParcelas())'),false,'Vinculo provavel necessita confirmacao');
run(`pagamentosProvaveisConfirmadosTemp.add(chaveConfirmacaoPagamentoParcelas(sugestoesParcelasExtratoTemp[0]));`);
assert.equal(run('validarExportacaoParcelasExtrato(montarPagamentosConciliadosParcelas())'),true);
run(`const linhasDiaErrado=montarPagamentosConciliadosParcelas();linhasDiaErrado[0][0]='02/06/2026';`);
assert.equal(run('conferirParcelasPorContaDia(linhasDiaErrado).length'),2,'Total mensal igual nao autoriza dias divergentes');
run(`
extratoBancarioTemp=[{conta:'CEF VD',valor:-59.9,data:new Date(2026,5,5),historico:'TARIFA CARTAO',complemento:'MOOZ VISA',tipoConciliacao:'Parcelas de Cartões'},
{conta:'CEF VD',valor:100,data:new Date(2026,5,5),historico:'CLIENTE TESTE',tipoConciliacao:'Parcelas de Títulos'}];
linhasImportadas=[];lancamentosGerados=[];gerarSugestoesConciliacao({redirecionarSeOk:false});
// O gerador exige titulos: cria um titulo zero, que nao gera pagamento.
linhasImportadas=[tituloTeste('CEF VD','20275872000170','VD 108',0)];registrarMapaCnpjContasImportadas(linhasImportadas);
gerarSugestoesConciliacao({redirecionarSeOk:false});
conciliacaoItensTemp.forEach(i=>{codigosConciliacaoTemp[i.id]=i.movimento==='saida-pendente'?'455':'1152';});salvarRegrasRecebimentoConciliacao();
const regrasSalvasTeste=JSON.stringify({pagamentos:depara[grupoAtivo],recebimentos:deparaRecebimentos[grupoAtivo],saidas:deparaSaidasExtrato[grupoAtivo]});
codigosConciliacaoTemp={};conciliacaoItensTemp=[];depara={};deparaRecebimentos={};deparaSaidasExtrato={};
const restauradasTeste=JSON.parse(regrasSalvasTeste);depara.VD=restauradasTeste.pagamentos;deparaRecebimentos.VD=restauradasTeste.recebimentos;deparaSaidasExtrato.VD=restauradasTeste.saidas;
gerarSugestoesConciliacao({redirecionarSeOk:false});
`);
assert.equal(run(`conciliacaoItensTemp.filter(i=>i.movimento==='saida-pendente').every(i=>codigosConciliacaoTemp[i.id]==='455')`),true,'Saidas de cartao devem reutilizar conta salva');
assert.equal(run(`conciliacaoItensTemp.filter(i=>i.movimento==='recebimento').every(i=>codigosConciliacaoTemp[i.id]==='1152')`),true,'Recebimentos devem reutilizar conta salva');
console.log('Parcelas: transito na liquidacao, datas reais, revisao de vinculos, protecao diaria, persistencia e CP isolada conferidos.');
