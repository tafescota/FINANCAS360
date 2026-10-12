import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal não encontrado.');

const script = match[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
const elemento = {
  addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} },
  querySelector() { return null; }, querySelectorAll() { return []; }, remove() {},
  style: {}, value: '', textContent: '', innerHTML: '', className: '',
};
const contexto = vm.createContext({
  alert() {}, confirm() { return true; }, console, CSS: { escape: String },
  document: {
    addEventListener() {}, body: elemento, createElement() { return { ...elemento }; },
    getElementById() { return { ...elemento }; }, querySelector() { return null; }, querySelectorAll() { return []; },
  },
  fetch: async () => ({ ok: true, json: async () => ({ grupos: [], depara: {} }) }),
  localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
  setInterval() {}, setTimeout(fn) { return fn(); }, window: { addEventListener() {} },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`
  grupoAtivo = 'CP SIMONE - TITULOS';
  const escopoHfc = escopoRegraPagamento('HFC - 7549', 'HFC - 7549', true, false);
  const escopoHfm = escopoRegraPagamento('HFM - 7524', 'HFM - 7524', true, false);
  const chaveHfc = montarChave('FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL', escopoHfc);
  const chaveHfm = montarChave('FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL', escopoHfm);

  const chaveLegada = montarChave(
    'FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL',
    'RATEIO: HFC - 7549 / HFC - 7549'
  );
  const regrasLegadas = { [chaveLegada]: '2121' };
  const codigoReaproveitado = encontrarCodigoRegra(
    regrasLegadas, 'FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL', ''
  );

  const chaveLegadaOutraUnidade = montarChave(
    'FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL',
    'RATEIO: HFM - 7524 / HFM - 7524'
  );
  const codigoConflitante = encontrarCodigoRegra(
    { [chaveLegada]: '2121', [chaveLegadaOutraUnidade]: '9999' },
    'FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL', ''
  );

  const regrasFgtsMesmoCodigo = {
    [montarChave('FGTS', 'INDENIZAÇÕES / RESCISÕES', 'Outros', 'PG FGTS RESCISÓRIO FUNCIONÁRIO A', '')]: '187',
    [montarChave('FGTS', 'INDENIZAÇÕES / RESCISÕES', 'Boleto', 'FGTS RESCISÓRIO FUNCIONÁRIO B', '')]: '187'
  };
  const codigoNovoHistorico = encontrarCodigoRegra(
    regrasFgtsMesmoCodigo, 'FGTS', 'INDENIZAÇÕES / RESCISÕES', 'Outros', 'FGTS RESCISÓRIO JULIO CESAR', ''
  );
  const codigoNovoHistoricoConflitante = encontrarCodigoRegra(
    { ...regrasFgtsMesmoCodigo, [montarChave('FGTS', 'INDENIZAÇÕES / RESCISÕES', 'Outros', 'EXCEÇÃO', '')]: '999' },
    'FGTS', 'INDENIZAÇÕES / RESCISÕES', 'Outros', 'NOVO HISTÓRICO', ''
  );
  const regrasFolha = {
    [montarChave('FUNCIONARIO A', 'Rateado', 'Folha de Pagamento', 'Folha normal', '')]: '178',
    [montarChave('FUNCIONARIO B', 'Rateado', 'Folha de Pagamento', 'Folha normal', '')]: '178'
  };
  const codigoNovoFuncionario = encontrarCodigoRegra(
    regrasFolha, 'FUNCIONARIO NOVO', 'Rateado', 'Folha de Pagamento', 'Folha normal', ''
  );
  const codigoNovoFuncionarioConflitante = encontrarCodigoRegra(
    { ...regrasFolha, [montarChave('FUNCIONARIO C', 'Rateado', 'Folha de Pagamento', 'Folha normal', '')]: '999' },
    'OUTRO FUNCIONARIO', 'Rateado', 'Folha de Pagamento', 'Folha normal', ''
  );

  const numerarioHfc = chaveNumerarioRateio('HFC - 7549', 'HFM - 7524', 'EMPRESA DO BANCO', 'ATIVO');
  const numerarioHfm = chaveNumerarioRateio('HFM - 7524', 'HFC - 7549', 'EMPRESA DO BANCO', 'ATIVO');
  grupoAtivo = 'OUTRO GRUPO';
  const escopoOutroGrupo = escopoRegraPagamento('EMPRESA A', 'UNIDADE B', true, false);
  const codigoReaproveitadoOutroGrupo = encontrarCodigoRegra(
    regrasLegadas, 'FUNCIONARIOS', 'FOLHA DE PAGAMENTO', 'Outros', 'PAGAMENTO MENSAL', ''
  );

  ({
    escopoHfc,
    escopoHfm,
    chavesComunsIguais: chaveHfc === chaveHfm,
    codigoReaproveitado,
    codigoConflitante,
    codigoNovoHistorico,
    codigoNovoHistoricoConflitante,
    codigoNovoFuncionario,
    codigoNovoFuncionarioConflitante,
    numerariosContinuamSeparados: numerarioHfc !== numerarioHfm,
    escopoOutroGrupo,
    codigoReaproveitadoOutroGrupo
  });
`, contexto);

if (resultado.escopoHfc || resultado.escopoHfm || !resultado.chavesComunsIguais) {
  throw new Error(`As regras comuns da CP SIMONE ainda estão separadas por unidade: ${JSON.stringify(resultado)}.`);
}
if (resultado.codigoReaproveitado !== '2121') {
  throw new Error(`A regra antiga da unidade não foi reaproveitada: ${resultado.codigoReaproveitado}.`);
}
if (resultado.codigoConflitante) {
  throw new Error('Regras antigas com códigos diferentes foram compartilhadas sem revisão.');
}
if (resultado.codigoNovoHistorico !== '187') {
  throw new Error(`Um novo histórico com fornecedor e plano unívocos não reutilizou a regra: ${resultado.codigoNovoHistorico}.`);
}
if (resultado.codigoNovoHistoricoConflitante) {
  throw new Error('Um fornecedor/plano com códigos diferentes foi aplicado automaticamente.');
}
if (resultado.codigoNovoFuncionario !== '178') {
  throw new Error(`O compartilhamento autorizado de folha deixou de funcionar: ${resultado.codigoNovoFuncionario}.`);
}
if (resultado.codigoNovoFuncionarioConflitante) {
  throw new Error('Um plano/documento com códigos diferentes foi aplicado automaticamente.');
}
if (!resultado.numerariosContinuamSeparados) {
  throw new Error('As contas específicas de numerários deixaram de ser separadas por empresa.');
}
if (resultado.escopoOutroGrupo || resultado.codigoReaproveitadoOutroGrupo !== '2121') {
  throw new Error('As regras comuns ainda não estão compartilhadas nos demais grupos.');
}

console.log(JSON.stringify(resultado, null, 2));
