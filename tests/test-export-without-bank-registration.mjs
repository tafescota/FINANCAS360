import assert from 'node:assert/strict';
import vm from 'node:vm';
import {contextoAplicacao} from './test-transfer-cnpj.mjs';

const ctx = contextoAplicacao();
const run = code => vm.runInContext(code, ctx);
for (const name of ['exportarDominioRecebimentos', 'exportarConciliacaoBancaria', 'exportarDominioPagamentos', 'exportarDominioFinal']) {
  assert.equal(run(`${name}.toString().includes('bloquearExportacaoPorContasBancarias')`), false);
}
run(`grupoAtivo='VD';configGrupos={VD:{modoImportacaoPagamentos:'parcelas'}};contasSemConciliacao={VD:{'CEF VD':'123'}};`);
assert.equal(run(`codigoContaExportacaoDominio('CEF VD')`), '123');
assert.equal(run(`codigoContaExportacaoDominio('BRADESCO VD')`), 'BRADESCO VD');
assert.equal(run(`contasSemConciliacao.VD['CEF VD']`), '123');
run(`configGrupos.VD.modoImportacaoPagamentos='cp_simone';`);
assert.equal(run(`grupoDispensaCadastroContasBancarias()`), true);
console.log('Exportacoes sem janela de cadastro; codigos existentes e nomes sem cadastro preservados.');
