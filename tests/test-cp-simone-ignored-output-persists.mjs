import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error('Script principal não encontrado.');

const script = match[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
const storage = new Map();
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
  localStorage: {
    getItem(chave) { return storage.get(chave) ?? null; },
    removeItem(chave) { storage.delete(chave); },
    setItem(chave, valor) { storage.set(chave, String(valor)); },
  },
  setInterval() {}, setTimeout() {}, window: { addEventListener() {} },
});

vm.runInContext(script, contexto);
const resultado = vm.runInContext(`
  grupoAtivo = 'CP SIMONE - TITULOS';
  configGrupos[grupoAtivo] = { modoImportacaoPagamentos: 'cp_simone' };
  abrirModalPendenciasConciliacao = () => {};
  agendarSalvarBaseCompartilhada = () => {};

  const movimento = {
    data: new Date(2026, 7, 5), conta: 'MM - BANCO', valor: -722,
    complemento: 'MM - BANCO - Transferência entre Contas',
    tipoConciliacao: 'Transferência entre Contas'
  };
  const chave = chaveRegraSaidaExtrato(movimento);
  conciliacaoItensTemp = [{
    id: 'saida-0', movimento: 'saida-pendente', chaveRegraSaida: chave,
    idxOriginal: 0, tipo: movimento.tipoConciliacao, historico: movimento.complemento,
    total: 722, data: '05/08/2026', conta: movimento.conta
  }];

  revisarSaidaExtratoSemExportar('saida-0');
  const marcadorGravado = deparaSaidasExtrato[grupoAtivo][chave];
  const storageGravado = JSON.parse(localStorage.getItem(STORAGE_DEPARA_SAIDAS_EXTRATO) || '{}');

  saidasExtratoRevisadasConciliacaoTemp = {};
  codigosConciliacaoTemp = {};
  linhasImportadas = [];
  extratoBancarioTemp = [movimento];
  recebimentosRateioTemp = [];
  const resumo = renderSugestoesConciliacao([], 0, 1, [], [{ mov: movimento, idxOriginal: 0 }]);

  const grupoComum = 'OUTRO GRUPO';
  configGrupos[grupoComum] = { modoImportacaoPagamentos: 'parcelas' };
  deparaSaidasExtrato[grupoComum] = { [chave]: marcadorGravado };
  grupoAtivo = grupoComum;

  ({
    marcadorGravado,
    marcadorNoStorage: storageGravado['CP SIMONE - TITULOS'][chave],
    revisadaAposRecarregar: !!saidasExtratoRevisadasConciliacaoTemp['saida-0'],
    pendenciasAposRecarregar: resumo.qtdParaResolver,
    marcadorRestritoCpSimone: !regraSaidaExtratoMarcadaComoRepresentada(marcadorGravado)
  });
`, contexto);

if (resultado.marcadorGravado !== '__nao_exportar_saida_extrato__') throw new Error(`A decisão não foi gravada: ${JSON.stringify(resultado)}`);
if (resultado.marcadorNoStorage !== resultado.marcadorGravado) throw new Error(`A decisão não chegou ao armazenamento local: ${JSON.stringify(resultado)}`);
if (!resultado.revisadaAposRecarregar || resultado.pendenciasAposRecarregar !== 0) throw new Error(`A saída voltou depois do recarregamento: ${JSON.stringify(resultado)}`);
if (!resultado.marcadorRestritoCpSimone) throw new Error(`O marcador afetou outro grupo: ${JSON.stringify(resultado)}`);

console.log(JSON.stringify(resultado, null, 2));
