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
  sessionStorage: { clear() {} },
  setInterval() {}, setTimeout(fn) { return fn(); }, window: { addEventListener() {} },
  XLSX: {
    utils: {
      aoa_to_sheet(data) { return { data }; },
      book_append_sheet(wb, ws, nome) { wb.sheets[nome] = ws; },
    },
  },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`
  grupoAtivo = 'CP SIMONE - TITULOS';
  configGrupos = { [grupoAtivo]: { modoImportacaoPagamentos: 'parcelas' } };
  contasSemConciliacao = { [grupoAtivo]: {} };
  mapaEmpresasImportadas = {
    '7524': 'SM MATRIZ - 7524',
    '14247': 'SM FILIAL - 14247',
    '7549': 'HFM - 7549'
  };

  const linha = ({ empresa, fornecedor, plano, conta, valor, historico }) => {
    const r = Array(20).fill('');
    r[COLS.EMPRESA] = empresa;
    r[COLS.FORNECEDOR] = fornecedor;
    r[COLS.PLANO] = plano;
    r[COLS.CONTA] = conta;
    r[COLS.VALOR_BRUTO] = valor;
    r[COLS.VALOR_LIQ] = valor;
    r[COLS.LIQUIDACAO] = '19/08/2026';
    r[COLS.PARCELA] = '1/1';
    r[COLS.TIPO_DOC] = 'Outros';
    r[COLS.HISTORICO] = historico;
    prepararLinhaParcelasNumerarios(r);
    return r;
  };

  const reembolsoGuia = linha({
    empresa: 'SM MATRIZ - 7524', fornecedor: 'GPS (GUIA DA PREVIDÊNCIA SOCIAL)',
    plano: 'REEMBOLSO DÉBITO', conta: 'SMM - BANCO', valor: 4615.65,
    historico: 'REEMBOLSO GPS SMF'
  });
  const guiaPropria = linha({
    empresa: 'SM MATRIZ - 7524', fornecedor: 'DARF', plano: 'IRPJ',
    conta: 'SMM - BANCO', valor: 900, historico: 'IRPJ MATRIZ'
  });
  const reembolsoComum = linha({
    empresa: 'SM MATRIZ - 7524', fornecedor: 'DIVERSOS', plano: 'REEMBOLSO DÉBITO',
    conta: 'SMM - BANCO', valor: 300, historico: 'REEMBOLSO TREINAMENTO'
  });
  const guiaFilial = linha({
    empresa: 'SM FILIAL - 14247', fornecedor: 'GPS (GUIA DA PREVIDÊNCIA SOCIAL)',
    plano: 'INSS - FUNCIONÁRIO', conta: 'SMF - BANCO', valor: 4615.65,
    historico: 'GPS LOJA'
  });
  const guiaFilialSemReembolso = linha({
    empresa: 'SM FILIAL - 14247', fornecedor: 'DARF',
    plano: 'IRPJ', conta: 'SMF - BANCO', valor: 999,
    historico: 'IRPJ SEM REEMBOLSO DA MATRIZ'
  });

  const chaveNumerarioAtivo = chaveNumerarioTributarioMatriz('SM MATRIZ - 7524', 'ATIVO');
  const chaveNumerarioPassivo = chaveNumerarioTributarioMatriz('SM MATRIZ - 7524', 'PASSIVO');
  const regras = {
    [chaveNumerarioAtivo]: '199',
    [chaveNumerarioPassivo]: '299',
    [montarChave('DARF', 'IRPJ', 'Outros', 'IRPJ MATRIZ', escopoRegraLinha(guiaPropria))]: '111',
    [montarChave('DIVERSOS', 'REEMBOLSO DÉBITO', 'Outros', 'REEMBOLSO TREINAMENTO', escopoRegraLinha(reembolsoComum))]: '194',
    [montarChave('GPS (GUIA DA PREVIDÊNCIA SOCIAL)', 'INSS - FUNCIONÁRIO', 'Outros', 'GPS LOJA', escopoRegraLinha(guiaFilial))]: '555',
    [montarChave('DARF', 'IRPJ', 'Outros', 'IRPJ SEM REEMBOLSO DA MATRIZ', escopoRegraLinha(guiaFilialSemReembolso))]: '556'
  };
  depara = { [grupoAtivo]: regras };
  gerarLancamentos([reembolsoGuia, guiaPropria, reembolsoComum, guiaFilial, guiaFilialSemReembolso], regras);

  const wb = { sheets: {} };
  depara[grupoAtivo][chaveNumerarioTributarioMatriz('HFM - 7549', 'ATIVO')] = '399';
  depara[grupoAtivo][chaveNumerarioTributarioMatriz('HFM - 7549', 'PASSIVO')] = '499';
  adicionarAbaConferenciaNumerarios(wb, [
    linhaDominio('19/08/2026', 'SMM - BANCO', '199', 4615.65, 'Entrada GPS', 'SM MATRIZ - 7524', 'TRANSFERENCIA DE NUMERARIOS'),
    linhaDominio('19/08/2026', '199', 'SMM - BANCO', 4615.65, 'Pagamento GPS', 'SM MATRIZ - 7524', 'TRANSFERENCIA DE NUMERARIOS'),
    linhaDominio('19/08/2026', '555', '194', 4615.65, 'INSS filial', 'SM FILIAL - 14247', 'TRANSFERENCIA DE NUMERARIOS'),
    linhaDominio('19/08/2026', '194', 'SMF - BANCO', 4615.65, 'Repasse filial', 'SM FILIAL - 14247', 'TRANSFERENCIA DE NUMERARIOS'),
    linhaDominio('20/08/2026', 'HFM - BANCO', '399', 100, 'Entrada GPS', 'HFM - 7549', 'TRANSFERENCIA DE NUMERARIOS'),
    linhaDominio('20/08/2026', '399', 'HFM - BANCO', 90, 'Pagamento GPS', 'HFM - 7549', 'TRANSFERENCIA DE NUMERARIOS')
  ], new Set());

  const recebimentosConsolidados = consolidarRecebimentosNumerariosTributariosMatriz([
    { id: 'gps', numerarioTributarioMatriz: true, empresaMatrizNumerario: 'SM MATRIZ - 7524', chaveNumerarioTributario: chaveNumerarioAtivo, movimentos: [{ valor: 4615.65 }], total: 4615.65 },
    { id: 'fgts', numerarioTributarioMatriz: true, empresaMatrizNumerario: 'SM MATRIZ - 7524', chaveNumerarioTributario: chaveNumerarioAtivo, movimentos: [{ valor: 3489.06 }], total: 3489.06 },
    { id: 'comum', numerarioTributarioMatriz: false, movimentos: [{ valor: 25 }], total: 25 }
  ]);

  ({
    lancamentos: lancamentosGerados.map(item => ({
      debito: item.codDebito,
      credito: item.codCredito,
      valor: item.valorLiq,
      numerarioTributario: !!item.numerarioTributarioMatriz
    })),
    entradaReconhecida: movimentoEhEntradaNumerarioTributarioMatriz({
      valor: 4615.65,
      tipoConciliacao: 'Parcelas de Títulos',
      complemento: 'GPS (GUIA DA PREVIDÊNCIA SOCIAL)'
    }),
    entradaComumNaoReconhecida: movimentoEhEntradaNumerarioTributarioMatriz({
      valor: 300,
      tipoConciliacao: 'Parcelas de Títulos',
      complemento: 'DIVERSOS'
    }),
    contasPadraoCpSimone: {
      ativo: codigoNumerarioTributarioMatriz({}, 'SM MATRIZ - 7524', 'ATIVO'),
      passivo: codigoNumerarioTributarioMatriz({}, 'SM MATRIZ - 7524', 'PASSIVO')
    },
    foraCpSimoneNaoReconhece: (() => {
      const grupoAnterior = grupoAtivo;
      grupoAtivo = 'OUTRO GRUPO';
      configGrupos[grupoAtivo] = { modoImportacaoPagamentos: 'parcelas' };
      const reconheceu = pagamentoEhReembolsoTributarioMatriz(reembolsoGuia);
      grupoAtivo = grupoAnterior;
      return reconheceu;
    })(),
    recebimentosConsolidados: recebimentosConsolidados.map(item => ({ qtd: item.qtd, total: item.total, especial: !!item.numerarioTributarioMatriz })),
    conferencia: wb.sheets['Conferência Numerários'].data
  });
`, contexto);

if (resultado.lancamentos.length !== 6) {
  throw new Error(`Os títulos foram agrupados ou duplicados: ${JSON.stringify(resultado)}.`);
}
if (resultado.lancamentos[0].debito !== '199'
  || resultado.lancamentos[0].credito !== 'SMM - BANCO'
  || !resultado.lancamentos[0].numerarioTributario) {
  throw new Error(`O reembolso tributário não usou a conta transitória: ${JSON.stringify(resultado)}.`);
}
if (resultado.lancamentos[1].debito !== '111' || resultado.lancamentos[1].numerarioTributario) {
  throw new Error(`A parte própria da matriz foi alterada: ${JSON.stringify(resultado)}.`);
}
if (resultado.lancamentos[2].debito !== '194' || resultado.lancamentos[2].numerarioTributario) {
  throw new Error(`O reembolso comum foi alterado: ${JSON.stringify(resultado)}.`);
}
if (resultado.lancamentos[3].debito !== '555' || resultado.lancamentos[3].credito !== '194'
  || resultado.lancamentos[4].debito !== '194' || resultado.lancamentos[4].credito !== 'SMF - BANCO') {
  throw new Error(`A guia da filial não passou pelo Numerários Passivo: ${JSON.stringify(resultado)}.`);
}
if (resultado.lancamentos[5].debito !== '556' || resultado.lancamentos[5].credito !== 'SMF - BANCO') {
  throw new Error(`Uma guia sem reembolso correspondente foi classificada como numerário: ${JSON.stringify(resultado)}.`);
}
if (!resultado.entradaReconhecida || resultado.entradaComumNaoReconhecida) {
  throw new Error(`A identificação das entradas tributárias está incorreta: ${JSON.stringify(resultado)}.`);
}
if (resultado.contasPadraoCpSimone.ativo !== '63' || resultado.contasPadraoCpSimone.passivo !== '194') {
  throw new Error(`As contas de numerários da CP SIMONE não foram reaproveitadas: ${JSON.stringify(resultado)}.`);
}
if (resultado.foraCpSimoneNaoReconhece) {
  throw new Error(`A regra tributária vazou para outro grupo: ${JSON.stringify(resultado)}.`);
}
if (resultado.recebimentosConsolidados.length !== 2
  || resultado.recebimentosConsolidados[0].qtd !== 2
  || resultado.recebimentosConsolidados[0].total !== 8104.71) {
  throw new Error(`Os repasses da mesma matriz não foram consolidados em uma regra: ${JSON.stringify(resultado)}.`);
}

const linhaSm = resultado.conferencia.find(linha => linha[0] === 'SM MATRIZ - 7524');
const linhaSmf = resultado.conferencia.find(linha => linha[0] === 'SM FILIAL - 14247');
const linhaHfm = resultado.conferencia.find(linha => linha[0] === 'HFM - 7549');
if (!linhaSm || linhaSm[4] !== 0 || linhaSm[8] !== 0 || linhaSm[11] !== 'CONFERIDO') {
  throw new Error(`A matriz zerada não foi conferida: ${JSON.stringify(resultado.conferencia)}.`);
}
if (!linhaSmf || linhaSmf[4] !== 0 || linhaSmf[8] !== 0 || linhaSmf[11] !== 'CONFERIDO') {
  throw new Error(`A filial zerada não foi conferida: ${JSON.stringify(resultado.conferencia)}.`);
}
if (!linhaHfm || linhaHfm[4] !== -10 || linhaHfm[11] !== 'DIFERENÇA') {
  throw new Error(`A diferença por matriz não foi listada: ${JSON.stringify(resultado.conferencia)}.`);
}

console.log(JSON.stringify(resultado, null, 2));
