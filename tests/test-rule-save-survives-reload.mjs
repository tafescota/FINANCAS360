import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/i)[1].replace(/\n\/\/ Iniciar[\s\S]*$/u, '');
const storage = new Map();

function criarContexto(requisicoes, responderOk = true) {
  const elemento = {
    addEventListener() {}, appendChild() {}, insertAdjacentHTML() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector() { return null; }, querySelectorAll() { return []; }, remove() {},
    style: {}, value: '', textContent: '', innerHTML: '', className: '',
  };
  const contexto = vm.createContext({
    alert() {}, confirm() { return true; }, console, CSS: { escape: String },
    document: {
      hidden: false, cookie: '', addEventListener() {}, body: elemento,
      createElement() { return { ...elemento }; }, getElementById() { return { ...elemento }; },
      querySelector() { return null; }, querySelectorAll() { return []; },
    },
    fetch: async (url, options = {}) => {
      requisicoes.push({ url, options });
      return {
        ok: responderOk,
        json: async () => responderOk
          ? { updatedAt: new Date().toISOString(), syncToken: `token-${requisicoes.length}` }
          : {},
      };
    },
    localStorage: {
      getItem(chave) { return storage.get(chave) ?? null; },
      removeItem(chave) { storage.delete(chave); },
      setItem(chave, valor) { storage.set(chave, valor); },
    },
    sessionStorage: { clear() {} }, location: { hostname: 'site.test' },
    setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
    requestIdleCallback() {}, window: { addEventListener() {} },
  });
  vm.runInContext(script, contexto);
  return contexto;
}

const antesDoF5 = criarContexto([]);
vm.runInContext(`
  grupoAtivo = 'CP SIMONE - TITULOS';
  grupos = [grupoAtivo];
  baseRemotaDisponivel = true;
  depara = { [grupoAtivo]: { PAGAMENTO: '2114' } };
  deparaRecebimentos = { [grupoAtivo]: { RECEBIMENTO_ANTIGO: '1152' } };
  salvarStorage({ gruposAlterados: [grupoAtivo], camposAlterados: ['depara'] });
`, antesDoF5);

if (!storage.get('zip_depara_sync_pendente_v1')) {
  throw new Error('A alteração não ficou protegida para sobreviver ao F5.');
}

const requisicoesDepoisDoF5 = [];
const depoisDoF5 = criarContexto(requisicoesDepoisDoF5);
const recuperou = await vm.runInContext(`(async () => {
  const restaurada = restaurarEstadoSyncPendente();
  const salva = await salvarBaseCompartilhadaAgora();
  return { restaurada, salva };
})()`, depoisDoF5);

const primeiroEnvio = JSON.parse(requisicoesDepoisDoF5[0].options.body);
if (!recuperou.restaurada || !recuperou.salva) throw new Error('O F5 não retomou o salvamento pendente.');
if (primeiroEnvio.depara['CP SIMONE - TITULOS'].PAGAMENTO !== '2114') throw new Error('O pagamento pendente não foi reenviado.');
if (Object.keys(primeiroEnvio.deparaRecebimentos).length !== 0) throw new Error('Salvar pagamentos tentou substituir recebimentos.');
if (storage.has('zip_depara_sync_pendente_v1')) throw new Error('O marcador pendente não foi limpo após confirmação.');

await vm.runInContext(`(async () => {
  grupoAtivo = 'CP SIMONE - TITULOS';
  deparaRecebimentos[grupoAtivo].RECEBIMENTO_NOVO = '194';
  salvarStorage({ gruposAlterados: [grupoAtivo], camposAlterados: ['deparaRecebimentos'] });
  return salvarBaseCompartilhadaAgora();
})()`, depoisDoF5);
const segundoEnvio = JSON.parse(requisicoesDepoisDoF5[1].options.body);
if (segundoEnvio.deparaRecebimentos['CP SIMONE - TITULOS'].RECEBIMENTO_NOVO !== '194') throw new Error('O recebimento não foi salvo.');
if (Object.keys(segundoEnvio.depara).length !== 0) throw new Error('Salvar recebimentos tentou substituir pagamentos.');

await vm.runInContext(`(async () => {
  deparaRecebimentos[grupoAtivo] = {};
  salvarStorage({ gruposAlterados: [grupoAtivo], camposAlterados: ['deparaRecebimentos'] });
  return salvarBaseCompartilhadaAgora();
})()`, depoisDoF5);
const terceiroEnvio = JSON.parse(requisicoesDepoisDoF5[2].options.body);
if (!Object.hasOwn(terceiroEnvio.deparaRecebimentos, 'CP SIMONE - TITULOS')) {
  throw new Error('A exclusão de todas as regras não incluiu o grupo no envio.');
}
if (Object.keys(terceiroEnvio.deparaRecebimentos['CP SIMONE - TITULOS']).length !== 0) {
  throw new Error('A exclusão de todas as regras não enviou o grupo vazio.');
}

const contextoFalha = criarContexto([], false);
const falhouSemPerder = await vm.runInContext(`(async () => {
  grupoAtivo = 'CP SIMONE - TITULOS';
  grupos = [grupoAtivo];
  baseRemotaDisponivel = true;
  depara = { [grupoAtivo]: { PAGAMENTO_FALHA: '63' } };
  salvarStorage({ gruposAlterados: [grupoAtivo], camposAlterados: ['depara'] });
  return salvarBaseCompartilhadaAgora();
})()`, contextoFalha);
if (falhouSemPerder !== false || !storage.get('zip_depara_sync_pendente_v1')) {
  throw new Error('Uma falha do servidor descartou o salvamento pendente.');
}

console.log(JSON.stringify({
  sobreviveAoF5: true,
  pagamentosIsolados: true,
  recebimentosIsolados: true,
  exclusaoRecebimentosPersiste: true,
  falhaMantemPendencia: true,
}, null, 2));
