// O codigo financeiro completo identifica o estabelecimento; a familia e usada somente no ZIP.
const ESTABELECIMENTOS_ALVORAR = {
  MNN: ['3337','5312','7337','12090','12269','13215','14232','14514','21119','22829','23034'],
  PCA: ['14155','18228','19025','22094','21280','22967'],
  SERLOC: ['8016','14384','14518','910301','19123','19124','24503'],
  VALE: ['19024']
};
// Identificacoes da relacao Empresas_CNPJ, nunca pela posicao na lista de filiais.
const NOMES_UNIDADES_ALVORAR = Object.freeze({
  '8016':'SERLOC MATRIZ', '14384':'SERLOC 02', '14518':'SERLOC 03', '910301':'SERLOC 04',
  '19123':'SERLOC 05', '19124':'SERLOC 06', '24503':'SERLOC 07',
  '14155':'PCA MATRIZ', '18228':'PCA 02', '19025':'PCA 03', '22094':'PCA 04', '21280':'PCA 06', '22967':'PCA 08',
  '3337':'MNN MATRIZ', '5312':'MNN 02', '7337':'MNN 03', '12090':'MNN 04', '12269':'MNN 05',
  '13215':'MNN 06', '14232':'MNN 07', '14514':'MNN 08', '21119':'MNN 09', '22829':'MNN 10', '23034':'MNN 11',
  '19024':'VALE DOURADO MATRIZ'
});

function rotuloUnidadeAlvorar(valor) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return valor ?? '';
  const texto = String(valor ?? '');
  const codigo = texto.trim().match(/^(\d+)(?:\s*[-(]|$)/)?.[1];
  return NOMES_UNIDADES_ALVORAR[codigo] ? `${codigo} (${NOMES_UNIDADES_ALVORAR[codigo]})` : texto;
}

function rotuloContaFinanceiraAlvorar(valor) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return valor ?? '';
  const texto = String(valor ?? '');
  return texto.replace(/\b\d+\b(?!\s*\()/g, codigo => NOMES_UNIDADES_ALVORAR[codigo] ? rotuloUnidadeAlvorar(codigo) : codigo);
}
let recebimentosAlvorarTemp = [];
let infoRecebimentosAlvorarTemp = null;
let cacheRecebimentosAlvorar = null;
let visaoPendenciasAlvorarTemp = 'contas';
let cacheFaltasCaixaAlvorar = null;
let cicloCalculosExtratoAlvorar = null;
let regrasInternasPagamentosGeradosAlvorar = null;

function executarComCalculosExtratoAlvorar(calcular) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || cicloCalculosExtratoAlvorar) return calcular();
  // Reuso somente no ciclo sincrono atual; nenhuma regra fica em cache entre acoes.
  cicloCalculosExtratoAlvorar = {grupo:grupoAtivo, movimentos:extratoBancarioTemp, calculos:new Map()};
  try { return calcular(); }
  finally { cicloCalculosExtratoAlvorar = null; }
}

function cacheCalculoExtratoAlvorar(nome, movimentos = extratoBancarioTemp) {
  const ciclo = cicloCalculosExtratoAlvorar;
  if (modoImportacaoDoGrupo() !== 'alvorar' || !ciclo || ciclo.grupo !== grupoAtivo || ciclo.movimentos !== movimentos) return null;
  if (!ciclo.calculos.has(nome)) ciclo.calculos.set(nome, new Map());
  return ciclo.calculos.get(nome);
}

const CONTAS_CORRENTES_ALVORAR = Object.freeze({
  pagamentos: Object.freeze({ ATIVO: '604', PASSIVO: '618' }),
  recebimentos: Object.freeze({ ATIVO: '1924', PASSIVO: '1931' }),
  emprestimos: Object.freeze({ ATIVO: '1768', PASSIVO: '1775' }),
  transferencias: Object.freeze({ ATIVO: '597', PASSIVO: '611' })
});

function codigoContaCorrenteAlvorar(empresaBanco, empresaMovimento, natureza, origem = 'pagamentos') {
  if (modoImportacaoDoGrupo() !== 'alvorar' || grupoMapaCnpjContasImportadas !== grupoAtivo) return '';
  const banco = codigoEmpresaAlvorar(empresaBanco), empresa = codigoEmpresaAlvorar(empresaMovimento);
  if (!banco || !empresa || banco === empresa) return '';
  const cnpjBanco = normalizarCnpjConta(mapaCnpjEmpresasAlvorar[banco]);
  const cnpjEmpresa = normalizarCnpjConta(mapaCnpjEmpresasAlvorar[empresa]);
  if (!cnpjBanco || !cnpjEmpresa) return '';
  // A raiz define o vinculo matriz/filiais, nao a titularidade de uma transferencia.
  const categoria = cnpjBanco.slice(0, 8) === cnpjEmpresa.slice(0, 8) ? origem : 'emprestimos';
  return CONTAS_CORRENTES_ALVORAR[categoria]?.[natureza] || '';
}

function codigoContaCorrenteItemAlvorar(item) {
  if (item.movimento !== 'numerario-rateio') return '';
  return codigoContaCorrenteAlvorar(item.empresaBanco || item.empresaOrigem || item.empresa,
    item.centroCusto, item.naturezaNumerario, item.transferenciaContas ? 'pagamentos' : 'recebimentos');
}

function aplicarContasCorrentesFixasAlvorar(itens) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return;
  return executarComCalculosExtratoAlvorar(()=>aplicarContasCorrentesFixasAlvorarAtual(itens));
}

function aplicarContasCorrentesFixasAlvorarAtual(itens) {
  itens.forEach(item => {
    const recebimento = codigoRecebimentoInternoAlvorar(item);
    if (recebimento) codigosConciliacaoTemp[item.id] = recebimento;
    const codigo = codigoContrapartidaFixaCartoesAlvorar(item);
    if (codigo) codigosConciliacaoTemp[item.id] = codigo;
    if (item.movimento === 'recebimento' && item.movimentos?.length
      && item.movimentos.every(movimentoResgateXpAlvorar)) codigosConciliacaoTemp[item.id] = '4130';
    if (item.movimento === 'saida-pendente' && !codigosConciliacaoTemp[item.id]) {
      const mov = extratoBancarioTemp[item.idxOriginal];
      if (mov && mov.valor < 0 && tipoContaAlvorar(mov.conta) === 'Caixa'
        && normalizarTexto(mov.tipoConciliacao) === 'parcelas de titulos') {
        codigosConciliacaoTemp[item.id] = codigoDespesaCaixaSemTituloAlvorar(mov);
      }
    }
    if(item.movimento==='saida-pendente') {
      const mov=extratoBancarioTemp[item.idxOriginal];
      if(mov?.valor<0 && acertosEntreEmpresasAlvorar().movimentos.has(mov))codigosConciliacaoTemp[item.id]='1775';
    }
  });
  itens.filter(i => i.movimento === 'numerario-rateio').forEach(item => {
    codigosConciliacaoTemp[item.id] = codigoContaCorrenteItemAlvorar(item);
  });
}

function contraparteGrupoAlvorar(mov, empresaBanco = codigoEmpresaAlvorar(mov.conta)) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !familiaEmpresaAlvorar(empresaBanco)) return '';
  const propria = familiaEmpresaAlvorar(empresaBanco);
  const texto = normalizarTexto([mov.historico,mov.complemento].filter(Boolean).join(' '));
  const familias = new Set();
  const documentos = texto.match(/\b(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})\b/g) || [];
  documentos.forEach(doc=>Object.entries(mapaCnpjEmpresasAlvorar).forEach(([codigo,cnpj])=>{
    if (normalizarCnpjConta(doc)===normalizarCnpjConta(cnpj) && familiaEmpresaAlvorar(codigo)!==propria) familias.add(familiaEmpresaAlvorar(codigo));
  }));
  const nomes = {MNN:/\bm\s*de\s*n\s*n\b|\bmnn\b/,PCA:/\bpca\b/,SERLOC:/\bserloc\b/,VALE:/\bvale dourado\b/};
  Object.entries(nomes).forEach(([familia,regex])=>{if(familia!==propria && regex.test(texto))familias.add(familia);});
  return familias.size===1 ? [...familias][0] : '';
}

function codigoPagamentoInternoAlvorar(row) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return '';
  const cache = cacheCalculoExtratoAlvorar('codigos-pagamentos');
  if (cache?.has(row)) return cache.get(row);
  const codigo = codigoPagamentoInternoAlvorarAtual(row);
  if (cache) cache.set(row, codigo);
  return codigo;
}

function codigoPagamentoInternoAlvorarAtual(row) {
  if (normalizarTexto(row[COLS.PLANO])==='devolucao de ted (estorno)') return '2098';
  if (normalizarTexto(row[COLS.PLANO])==='falta de caixa'
    && normalizarTexto(row[COLS.FORNECEDOR])==='vendas dinheiro') return '1488';
  const conta=row[COLS.CONTA],empresa=codigoEmpresaAlvorar(conta);
  const contraparte=contraparteGrupoAlvorar({complemento:row[COLS.FORNECEDOR]},empresa);
  if (!contraparte) return '';
  const movimentos=extratoBancarioTemp.filter(m=>m.valor<0 && contaNormalizadaAlvorar(m.conta)===contaNormalizadaAlvorar(conta)
    && dataKey(m.data)===dataKey(row[COLS.LIQUIDACAO]) && contraparteGrupoAlvorar(m)===contraparte);
  if(!movimentos.length)return '';
  const acertos=acertosEntreEmpresasAlvorar().movimentos;
  return movimentos.some(m=>acertos.has(m)) ? '1775' : '';
}

function estadoRegrasInternasPagamentosAlvorar(dados = linhasImportadas) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return null;
  return {grupo:grupoAtivo, dados, codigos:dados.map(codigoPagamentoInternoAlvorar).join('|')};
}

function pagamentosAlvorarComRegrasInternasDesatualizadas() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return false;
  return executarComCalculosExtratoAlvorar(() => {
    const atual = estadoRegrasInternasPagamentosAlvorar();
    const gerado = regrasInternasPagamentosGeradosAlvorar;
    // O extrato chega depois dos titulos e pode confirmar ou desfazer a regra interna.
    return !gerado || gerado.grupo !== atual.grupo || gerado.dados !== atual.dados || gerado.codigos !== atual.codigos;
  });
}

function movimentoFolhaAlvorar(mov) {
  return /\b(salarios?|folha)\b/.test(normalizarTexto(mov.historico));
}

function acertosEntreEmpresasAlvorar() {
  if(modoImportacaoDoGrupo()!=='alvorar')return {movimentos:new Map(),grupos:[]};
  const cache=cacheCalculoExtratoAlvorar('acertos-empresas');
  if(cache?.has('resultado'))return cache.get('resultado');
  const pareados=indicesTransferenciasPareadas(extratoBancarioTemp),transitos=movimentosTransitoParcelas(),grupos=new Map();
  extratoBancarioTemp.forEach((mov,idx)=>{
    if(!mov.valor || pareados.has(idx) || transitos.has(idx) || movimentoFolhaAlvorar(mov))return;
    const outra=contraparteGrupoAlvorar(mov),propria=familiaEmpresaAlvorar(codigoEmpresaAlvorar(mov.conta));
    if(!outra || !propria)return;
    const origem=mov.valor<0?propria:outra,destino=mov.valor<0?outra:propria;
    const chave=JSON.stringify([dataKey(mov.data),origem,destino]);
    if(!grupos.has(chave))grupos.set(chave,{data:dataKey(mov.data),origem,destino,entradas:[],saidas:[]});
    grupos.get(chave)[mov.valor<0?'saidas':'entradas'].push(mov);
  });
  const movimentos=new Map(),confirmados=[];
  const soma=rows=>rows.reduce((s,m)=>s+Math.round(Math.abs(m.valor)*100),0);
  grupos.forEach(g=>{
    // Confirmar as duas pontas em centavos; nao consolidar as linhas bancarias da exportacao.
    if(!g.saidas.length || !g.entradas.length || soma(g.saidas)!==soma(g.entradas))return;
    confirmados.push({...g,valor:soma(g.saidas)/100});
    g.saidas.forEach(m=>movimentos.set(m,g.destino));g.entradas.forEach(m=>movimentos.set(m,g.origem));
  });
  const resultado={movimentos,grupos:confirmados};
  if(cache)cache.set('resultado',resultado);
  return resultado;
}

function codigoRecebimentoInternoAlvorar(item) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || item.movimento!=='recebimento' || !(item.total>0)) return '';
  if (item.codigoInternoAlvorar) return item.codigoInternoAlvorar;
  if(!item.titularidadeAlvorar && item.movimentos?.length && item.movimentos.every(m=>m.valor>0 && acertosEntreEmpresasAlvorar().movimentos.has(m)))return '1768';
  if (item.origem==='cartoes' && normalizarTexto(item.adquirente)==='pix bancario') return '2098';
  const plano=normalizarTexto(item.plano),fornecedor=normalizarTexto(item.fornecedor);
  const texto=normalizarTexto([item.plano,item.historico].filter(Boolean).join(' '));
  if (plano==='vendas de mercadorias') return '2098';
  if (fornecedor==='vendas dinheiro' && plano==='sobra de caixa') return '2098';
  if (plano==='rendimento sobre aplicacao financeira') return '211';
  if (plano==='cartao presente a receber') return '1845';
  if (/\bmooz\b/.test(fornecedor)) {
    if (/reembolso de cancelamento/.test(texto)) return '2098';
    if (/devolucao de taxa de antecipacao|devolucao de juros|pagamento a maior|p[a]?g[a]?mento a maior|reembolso de cartoes|ajuste de conciliacao de conta \(receber\)/.test(texto)) return '1782';
  }
  if (plano==='devolucao de ted' || plano==='pagamento indevido' || plano==='estornos de creditos'
    || (plano==='ajuste de conciliacao de conta (receber)' && /erro de deposito/.test(texto))) {
    const correspondentes=linhasImportadas.filter(r=>normalizarTexto(r[COLS.PLANO])==='devolucao de ted (estorno)'
      && familiaEmpresaAlvorar(codigoEmpresaAlvorar(r[COLS.EMPRESA]))===familiaEmpresaAlvorar(item.centroCusto)
      && Math.round(Math.abs(numeroMoeda(r[COLS.VALOR_LIQ]))*100)===Math.round(item.total*100)
      && (normalizarTexto(r[COLS.FORNECEDOR])===fornecedor
        || (/erro de deposito/.test(texto) && /deposito.*conta errada/.test(normalizarTexto(r[COLS.HISTORICO]))
          && contaNormalizadaAlvorar(r[COLS.CONTA])===contaNormalizadaAlvorar(item.conta)
          && dataKey(r[COLS.LIQUIDACAO])===dataKey(item.data))));
    const contas=new Set(correspondentes.map(r=>codigoPagamentoInternoAlvorar(r) || obterCodigoContaParaDominio(encontrarCodigoRegra(depara[grupoAtivo] || {},
      limparTextoECD(r[COLS.FORNECEDOR]),limparTextoECD(r[COLS.PLANO]),limparTextoECD(r[COLS.TIPO_DOC]),
      separarNumeroDoHistorico(r[COLS.TIPO_DOC],r[COLS.NUMERO],r[COLS.HISTORICO]).historico,escopoRegraLinha(r)))).filter(Boolean));
    if(correspondentes.length===1 && contas.size===1)return [...contas][0];
  }
  return '';
}

function faltasSemExtratoCaixaAlvorar() {
  if(modoImportacaoDoGrupo()!=='alvorar')return [];
  const contas=new Set(extratoBancarioTemp.map(m=>contaNormalizadaAlvorar(m.conta)));
  return linhasImportadas.map((row,idx)=>({row,idx})).filter(({row})=>tipoContaAlvorar(row[COLS.CONTA])==='Caixa'
    && normalizarTexto(row[COLS.FORNECEDOR])==='vendas dinheiro' && normalizarTexto(row[COLS.PLANO])==='falta de caixa'
    && !contas.has(contaNormalizadaAlvorar(row[COLS.CONTA])) && numeroMoeda(row[COLS.VALOR_LIQ])>0);
}

function montarFaltasSemExtratoCaixaAlvorar() {
  return faltasSemExtratoCaixaAlvorar().map(({row})=>{
    const linha=linhaDominio(fmtDate(row[COLS.LIQUIDACAO]),'1488','2098',numeroMoeda(row[COLS.VALOR_LIQ]),
      'Falta de caixa sem extrato do caixa - '+row[COLS.CONTA],codigoEmpresaAlvorar(row[COLS.EMPRESA]),'PROPRIO');
    linha.tipoExtratoAlvorar='Caixa';linha.movimentoExportacaoAlvorar='Recebimentos';return linha;
  });
}

function movimentoResgateXpAlvorar(mov) {
  return modoImportacaoDoGrupo() === 'alvorar' && mov.valor > 0 && tipoContaAlvorar(mov.conta) === 'Banco'
    && /\bxp investimentos\b/.test(normalizarTexto(mov.complemento));
}

function codigoDespesaCaixaSemTituloAlvorar(mov) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return '';
  const fornecedor = normalizarTexto(mov.complemento);
  const codigos = new Set();
  Object.entries(depara[grupoAtivo] || {}).forEach(([chave,codigo]) => {
    const [nome,plano,tipo] = chaveRegraSemEscopoDeUnidade(chave).split(' | ');
    if (!fornecedor || normalizarTexto(nome) !== fornecedor || !plano
      || /^(desconto|acrescimo)/.test(normalizarTexto(tipo))) return;
    const conta = obterCodigoContaParaDominio(codigo);
    if (conta) codigos.add(conta);
  });
  // Nao escolher entre despesas conflitantes do mesmo fornecedor.
  return codigos.size === 1 ? [...codigos][0] : '51301';
}

function codigoContrapartidaFixaCartoesAlvorar(item) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return '';
  if (item.movimento === 'recebimento' && Number(item.total) > 0) {
    if (item.cartaoPeloExtratoAlvorar) return item.codigoCartaoExtratoAlvorar;
    if (item.titularidadeAlvorar && item.origem === 'cartoes'
      && /^mooz boleto$/.test(normalizarTexto(item.adquirente))) return '1783';
    if (item.titularidadeAlvorar && item.origem === 'cartoes'
      && /^mooz cartoes\s*\(hagana\)$/.test(normalizarTexto(item.adquirente))) return '1782';
    const movimentos = item.movimentos || [];
    if (movimentos.length && movimentos.every(m => Number(m.valor) > 0
      && normalizarTexto(m.tipoConciliacao) === 'parcelas de cartoes'
      && /^moozcartoeshagana\b/.test(normalizarTexto(m.complemento)))) return '1782';
    return '';
  }
  if (item.movimento !== 'saida-pendente') return '';
  const mov = extratoBancarioTemp[item.idxOriginal];
  if (!mov || !(Number(mov.valor) < 0) || tipoContaAlvorar(mov.conta) !== 'Banco'
    || normalizarTexto(mov.tipoConciliacao) !== 'parcelas de cartoes') return '';
  const complemento = normalizarTexto(mov.complemento);
  const moozPixIdentificado = complemento === 'pix pixsistemapagamentoinstantaneo'
    && /\b06\.?308\.?851\/?0001-?82\b/.test(String(mov.historico || ''));
  // Regra permanente: o sinal e a origem do extrato definem o ajuste, nao o historico ou o mes.
  return /^moozcartoeshagana\b/.test(complemento) || moozPixIdentificado ? '2098' : '';
}

function pagamentosAlvorarComContasCorrentesDesatualizadas() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return false;
  return lancamentosGerados.some(l => {
    if (!l.lancamentoNumerario || l.origemConciliacao) return false;
    const r = linhasImportadas[l.idx];
    if (!r || !parcelasNumerariosLinha(r)) return false;
    const banco = empresaOrigemLinha(r), empresa = centroCustoLinha(r);
    const ladoBanco = String(l.empresa) === String(banco);
    const lado = ladoBanco ? 'EMPRESA DO BANCO' : 'CENTRO DE CUSTO';
    const negativo = arredondarMoeda(r[COLS.VALOR_LIQ]) < 0;
    const esperado = codigoContaCorrenteAlvorar(banco, empresa, naturezaNumerarioPagamento(lado, negativo));
    const atual = ladoBanco !== negativo ? l.codDebito : l.codCredito;
    return String(atual || '') !== esperado;
  });
}

function chaveDiaCaixaAlvorar(data, conta) {
  return JSON.stringify([dataKey(data), contaNormalizadaAlvorar(conta)]);
}

function apurarFaltasCaixaLiquidasAlvorar() {
  const vazio = { grupos: new Map(), indices: new Set() };
  if (modoImportacaoDoGrupo() !== 'alvorar' || !recebimentosAlvorarTemp.length || !extratoBancarioTemp.length) return vazio;
  if (cacheFaltasCaixaAlvorar?.pagamentos === linhasImportadas
    && cacheFaltasCaixaAlvorar.recebimentos === recebimentosAlvorarTemp
    && cacheFaltasCaixaAlvorar.extrato === extratoBancarioTemp
    && cacheFaltasCaixaAlvorar.quantidades === [linhasImportadas.length,recebimentosAlvorarTemp.length,extratoBancarioTemp.length].join('|')) return cacheFaltasCaixaAlvorar.resultado;
  const grupos = new Map();
  linhasImportadas.forEach((row, idx) => {
    const empresa = codigoPermitidoAlvorar(row[COLS.CONTA]);
    if (!empresa || empresa !== String(row[COLS.EMPRESA]) || tipoContaAlvorar(row[COLS.CONTA]) !== 'Caixa'
      || normalizarTexto(row[COLS.FORNECEDOR]) !== 'vendas dinheiro'
      || normalizarTexto(row[COLS.PLANO]) !== 'falta de caixa'
      || !normalizarTexto(row[COLS.HISTORICO]).includes('ajuste do fechamento de caixa')
      || arredondarMoeda(row[COLS.VALOR_LIQ]) <= 0 || arredondarMoeda(row[COLS.ACRESCIMO]) !== 0) return;
    const chave = chaveDiaCaixaAlvorar(row[COLS.LIQUIDACAO], row[COLS.CONTA]);
    if (!grupos.has(chave)) grupos.set(chave, { empresa, faltas: [], recebimentos: [], extratos: [] });
    grupos.get(chave).faltas.push({ row, idx, valor: arredondarMoeda(row[COLS.VALOR_LIQ]) });
  });
  recebimentosAlvorarTemp.forEach(r => {
    const grupo = grupos.get(chaveDiaCaixaAlvorar(r.data, r.conta));
    if (grupo && r.origem === 'titulos' && normalizarTexto(r.fornecedor) === 'vendas dinheiro') grupo.recebimentos.push(r);
  });
  extratoBancarioTemp.forEach(m => {
    const grupo = grupos.get(chaveDiaCaixaAlvorar(m.data, m.conta));
    if (grupo && normalizarTexto(m.tipoConciliacao) === 'parcelas de titulos'
      && normalizarTexto(m.complemento) === 'vendas dinheiro') grupo.extratos.push(m);
  });
  const resultado = { grupos: new Map(), indices: new Set() };
  const somar = lista => lista.reduce((s, r) => s + Math.round(r.valor * 100), 0);
  grupos.forEach((grupo, chave) => {
    const vendas = grupo.recebimentos.filter(r => normalizarTexto(r.plano) === 'vendas de mercadorias');
    const configuracoes = new Set(vendas.map(r => JSON.stringify([r.tipo,r.plano,r.centroCusto,r.empresaBanco])));
    if (!grupo.extratos.length || grupo.extratos.some(m => m.valor <= 0) || !vendas.length || configuracoes.size !== 1
      || grupo.recebimentos.some(r => r.valor <= 0 || r.empresaBanco !== grupo.empresa || r.centroCusto !== grupo.empresa
        || !['vendas de mercadorias','sobra de caixa'].includes(normalizarTexto(r.plano)))) return;
    const faltaCentavos = somar(grupo.faltas);
    // Exigir prova integral do fechamento, sem tolerancia nem rateio por aproximacao.
    if (somar(vendas) <= faltaCentavos || somar(grupo.recebimentos) - faltaCentavos !== somar(grupo.extratos)) return;
    resultado.grupos.set(chave, { ...grupo, faltaCentavos });
    grupo.faltas.forEach(f => resultado.indices.add(f.idx));
  });
  cacheFaltasCaixaAlvorar = { pagamentos: linhasImportadas, recebimentos: recebimentosAlvorarTemp,
    extrato: extratoBancarioTemp, quantidades: [linhasImportadas.length,recebimentosAlvorarTemp.length,extratoBancarioTemp.length].join('|'), resultado };
  return resultado;
}

function montarAjustesCaixaLiquidosAlvorar(item, codigoRecebimento) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return [];
  return (item.faltasCaixaLiquidasAlvorar || []).map(({ row, valor }) => {
    const linha = linhaDominio(fmtDate(row[COLS.LIQUIDACAO]), '1488', '2098', valor,
      'Falta de caixa ja descontada da entrada - ' + row[COLS.CONTA], item.centroCusto, 'PROPRIO');
    linha.tipoExtratoAlvorar = 'Caixa';
    linha.movimentoExportacaoAlvorar = 'Recebimentos';
    return linha;
  });
}

function resumoVinculosAlvorar() {
  const titulos = sugestoesParcelasExtratoTemp.filter(s => !s.mov
    && vinculosPagamentoConciliacaoTemp['pag-' + s.pag.idx] !== VINCULO_PAGAMENTO_SEM_EXTRATO);
  return { quantidade: titulos.length, valor: arredondarMoeda(titulos.reduce((s, t) => s + Math.abs(t.pag.valor), 0)) };
}

function filtrarVisaoPendenciasAlvorar(itens, visao = visaoPendenciasAlvorarTemp) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || visao === 'todas') return itens;
  return itens.filter(i => (i.movimento === 'pagamento-pendente') === (visao === 'vinculos'));
}

function agruparPendenciasRecebimentosAlvorar(itens) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return itens;
  const grupos = new Map(), resultado = [];
  itens.forEach(item => {
    const chave = item.titularidadeAlvorar && item.movimento === 'recebimento' ? item.naturezaAlvorar?.chave : '';
    if (!chave) { resultado.push(item); return; }
    if (!grupos.has(chave)) {
      const grupo = { ...item, total: 0, qtd: 0, datasAgrupadasAlvorar: new Set() };
      grupos.set(chave, grupo);
      resultado.push(grupo);
    }
    const grupo = grupos.get(chave);
    grupo.total = arredondarMoeda(grupo.total + item.total);
    grupo.qtd += item.qtd || 1;
    grupo.datasAgrupadasAlvorar.add(item.data);
    grupo.data = `${grupo.datasAgrupadasAlvorar.size} dia(s) / ${grupo.qtd} movimentos`;
  });
  return resultado;
}

function alterarVisaoPendenciasAlvorar(visao) {
  visaoPendenciasAlvorarTemp = visao;
  if (visao === 'vinculos') filtroNaturezaPendenciasAlvorarTemp = '';
  pendenciasConciliacaoSelecionadas.clear();
  abrirModalPendenciasConciliacao();
}

function htmlVinculosPagamentosAlvorar() {
  const resumo = resumoVinculosAlvorar();
  const saidas = conciliacaoItensTemp.filter(i => i.movimento === 'saida-pendente'
    && !obterCodigoContaParaDominio(codigosConciliacaoTemp[i.id]));
  const totalSaidas = arredondarMoeda(saidas.reduce((s, i) => s + i.total, 0));
  return `<div class="alert ${resumo.quantidade ? 'alert-warn' : 'alert-ok'} conciliacao-check-alert">
    <div class="conciliacao-check-head"><strong>Vinculos de pagamentos com o extrato</strong><span class="conciliacao-check-status ${resumo.quantidade ? 'warn' : 'ok'}">${resumo.quantidade ? 'Revisao pendente' : 'Vinculos conferem'}</span></div>
    <div class="conciliacao-check-totals"><span>Titulos sem vinculo: <strong>${resumo.quantidade} / R$ ${fmtValor(resumo.valor)}</strong></span><span>Saidas com contrapartida pendente: <strong>${saidas.length} / R$ ${fmtValor(totalSaidas)}</strong></span></div>
    <button class="btn btn-sm" onclick="alterarVisaoPendenciasAlvorar('vinculos')">Conferir titulos sem vinculo</button>
  </div>`;
}

function familiaEmpresaAlvorar(codigo) {
  return Object.keys(ESTABELECIMENTOS_ALVORAR).find(f => ESTABELECIMENTOS_ALVORAR[f].includes(String(codigo))) || '';
}

function codigoPermitidoAlvorar(valor) {
  const tokens = String(valor || '').match(/\d+/g) || [];
  const encontrados = [...new Set(tokens.filter(c => familiaEmpresaAlvorar(c)))];
  return encontrados.length === 1 ? encontrados[0] : '';
}

function contaNormalizadaAlvorar(conta) {
  return categoriaCartaoConciliacao(limparTextoExportacaoDominio(conta));
}

function categoriaRecebimentoAlvorar(valor) {
  return categoriaCartaoConciliacao(valor).replace(/pixsistemapagamentoinstantaneo/g, 'pix')
    .replace(/^pixbancario/, 'pix').replace(/naoinformada/g, 'none');
}

async function lerWorkbookAlvorarAsync(file) {
  if (typeof Worker === 'undefined' || !file.arrayBuffer || file.size < 2000000) return lerWorkbookArquivoAsync(file);
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker('alvorar-worker.js');
    worker.onmessage = ({data}) => {
      worker.terminate();
      if (data.erro) reject(new Error(`${file.name}: ${data.erro}`));
      else resolve({ alvorarRaw: data.raw });
    };
    worker.onerror = () => { worker.terminate(); reject(new Error(`${file.name}: falha na leitura em segundo plano.`)); };
    worker.postMessage(buffer,[buffer]);
  });
}

async function lerMovimentosAlvorarWorkbook(wb, arquivo) {
  const raw = wb.alvorarRaw || XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const linhaCabecalho = raw.slice(0, 40).findIndex(r => indiceColunaPorNomes(r || [], ['empresa']) >= 0
    && (indiceColunaPorNomes(r || [], ['adquirente']) >= 0 || indiceColunaPorNomes(r || [], ['cliente / fornecedor']) >= 0));
  if (linhaCabecalho < 0) throw new Error(`${arquivo}: cabecalho de titulos ou cartoes nao identificado.`);
  const h = raw[linhaCabecalho];
  const indices = new Map();
  const col = (...nomes) => {
    const chave = nomes.join('|');
    if (!indices.has(chave)) indices.set(chave, indiceColunaPorNomes(h, nomes));
    return indices.get(chave);
  };
  const cartoes = col('adquirente') >= 0;
  const colunasTitulos = !cartoes ? colunasF360Original(h) : null;
  const dados = [], pagamentos = [];
  let foraLista = 0;
  for (let i = linhaCabecalho + 1; i < raw.length; i++) {
    if (i % 2000 === 0) await aguardarPinturaInterface();
    const r = raw[i];
    const tipo = normalizarTexto(r?.[col('tipo')]);
    if (!cartoes && !['conta a pagar', 'conta a receber'].includes(tipo)) continue;
    if (cartoes && tipo !== 'a receber') continue;
    const empresa = String(r[col('empresa')] || '').trim();
    if (!familiaEmpresaAlvorar(empresa)) { foraLista++; continue; }
    if (!cartoes && tipo === 'conta a pagar') {
      const pagamento = normalizarLinhaTitulosF360Original(r,colunasTitulos);
      pagamento.__empresaCnpj = r[col('empresa (cnpj)')] || '';
      pagamentos.push(pagamento);
      continue;
    }
    const conta = limparTextoECD(r[col('conta')]);
    const empresaBanco = codigoPermitidoAlvorar(conta);
    const data = r[col('dt. liquidacao', 'liquidacao')];
    const valor = arredondarMoeda(r[col('valor liquido')]);
    if (!data || !valor) continue;
    if (!cartoes && !normalizarTexto(r[col('status')]).includes('liquidado')) continue;
    if (!empresaBanco) throw new Error(`${arquivo}, linha ${i + 1}: conta sem estabelecimento permitido (${conta}).`);
    const adquirente = cartoes ? limparTextoECD(r[col('adquirente')]) : '';
    const bandeira = cartoes ? limparTextoECD(r[col('bandeira')]) : '';
    const modalidade = cartoes ? limparTextoECD(r[col('modalidade')]) : '';
    const tipoLancamento = cartoes ? limparTextoECD(r[col('tipo de lancamento')]) : '';
    const fornecedor = cartoes ? '' : limparTextoECD(r[col('cliente / fornecedor')]);
    const plano = cartoes ? (normalizarTexto(adquirente).includes('boleto') ? 'Boletos recebidos' : 'Cartoes recebidos')
      : limparTextoECD(r[col('plano de contas', 'plano de conta')]);
    dados.push({ data, dataKey: dataKey(data), valor, conta, empresaBanco, centroCusto: empresa,
      adquirente, bandeira, modalidade, tipoLancamento, fornecedor, plano,
      numero: cartoes ? String(r[col('res. operacoes')] || '') : String(r[col('numero')] || ''),
      categoria: cartoes ? categoriaRecebimentoAlvorar(adquirente + bandeira) : '',
      tipo: cartoes ? [adquirente, bandeira, modalidade, tipoLancamento].filter(Boolean).join(' - ')
        : limparTextoECD(r[col('meio de pagamento')] || 'Titulo recebido'),
      historico: cartoes ? [adquirente, bandeira, modalidade, tipoLancamento].filter(Boolean).join(' - ')
        : [fornecedor, plano, r[col('historico')]].filter(Boolean).join(' - '),
      origem: cartoes ? 'cartoes' : 'titulos', arquivoOrigem: arquivo, linhaOrigem: i + 1,
      chaveFonte: JSON.stringify(r) });
  }
  return { pagamentos, recebimentos: dados, foraLista, cartoes };
}

async function processarImportacaoCompletaAlvorar(files) {
  const grupo = grupoAtivo;
  const pagamentos = [], recebimentos = [];
  let foraLista = 0;
  const ocorrencias = new Map();
  recebimentosAlvorarTemp.forEach(r => ocorrencias.set(r.chaveFonte, (ocorrencias.get(r.chaveFonte) || 0) + 1));
  try {
    for (let i = 0; i < files.length; i++) {
      atualizarProgressoImportacao(i / files.length * 85, `Lendo movimentos ALVORAR (${i + 1}/${files.length})...`, files[i].name);
      await aguardarPinturaInterface();
      const wb = await lerWorkbookAlvorarAsync(files[i]);
      const leitura = await lerMovimentosAlvorarWorkbook(wb, files[i].name);
      if (!leitura.pagamentos.length && !leitura.recebimentos.length && !leitura.foraLista) throw new Error(`${files[i].name}: nenhum movimento identificado.`);
      pagamentos.push(...leitura.pagamentos);
      foraLista += leitura.foraLista;
      const noArquivo = new Map();
      leitura.recebimentos.forEach(r => {
        const qtd = (noArquivo.get(r.chaveFonte) || 0) + 1;
        noArquivo.set(r.chaveFonte, qtd);
        if (qtd > (ocorrencias.get(r.chaveFonte) || 0)) recebimentos.push(r);
      });
      noArquivo.forEach((n, chave) => ocorrencias.set(chave, Math.max(n, ocorrencias.get(chave) || 0)));
    }
    if (grupoAtivo !== grupo || modoImportacaoDoGrupo() !== 'alvorar') throw new Error('Grupo alterado durante a leitura. Nada foi aplicado.');
    if (pagamentos.length) {
      linhasImportadasModo = 'alvorar';
      prepararPagamentosImportados(pagamentos, true);
    }
    recebimentosAlvorarTemp = [...recebimentosAlvorarTemp, ...recebimentos];
    cacheRecebimentosAlvorar = null;
    infoRecebimentosAlvorarTemp = { arquivos: [...new Set([...(infoRecebimentosAlvorarTemp?.arquivos || []), ...files.map(f => f.name)])], foraLista };
    renderResumoImportacaoAlvorar();
    if (extratoBancarioTemp.length && linhasImportadas.length) gerarSugestoesConciliacao({redirecionarSeOk:false});
    finalizarProgressoImportacao(`${pagamentos.length} pagamentos, ${recebimentos.length} recebimentos novos. ${foraLista} linhas de outras empresas ignoradas.`);
  } catch (err) {
    alert('Erro na importacao ALVORAR: ' + err.message);
    erroProgressoImportacao(err.message);
  }
}

function renderResumoImportacaoAlvorar() {
  const el = document.getElementById('resumo-importacao-alvorar');
  if (!el) return;
  el.style.display = modoImportacaoDoGrupo() === 'alvorar' ? '' : 'none';
  el.textContent = `${recebimentosAlvorarTemp.length.toLocaleString('pt-BR')} recebimentos carregados · ${infoRecebimentosAlvorarTemp?.foraLista || 0} linhas fora da listagem`;
}

function conciliarRecebimentosCompletosAlvorar(entradas) {
  const vazio = { itens: [], usados: new Set(), divergencias: [], aceleracoesSemNovaEntrada: [], cartoesPeloExtrato: [] };
  if (modoImportacaoDoGrupo() !== 'alvorar' || !recebimentosAlvorarTemp.length) return vazio;
  if (cacheRecebimentosAlvorar?.extrato === extratoBancarioTemp && cacheRecebimentosAlvorar.recebimentos === recebimentosAlvorarTemp
    && cacheRecebimentosAlvorar.pagamentos === linhasImportadas
    && cacheRecebimentosAlvorar.qtd === entradas.length) return cacheRecebimentosAlvorar.resultado;
  const resultado = { itens: [], usados: new Set(), divergencias: [], aceleracoesSemNovaEntrada: [], cartoesPeloExtrato: [] };
  const titulosAceitos = new Set();
  const faltasLiquidas = apurarFaltasCaixaLiquidasAlvorar();
  const grupos = new Map();
  const chave = (data, conta, categoria, sinal = 1) => JSON.stringify([dataKey(data), contaNormalizadaAlvorar(conta), categoria, sinal]);
  const adicionar = (key, lado, valor) => {
    if (!grupos.has(key)) grupos.set(key, { planilha: [], extrato: [] });
    grupos.get(key)[lado].push(valor);
  };
  recebimentosAlvorarTemp.filter(r => r.origem === 'cartoes').forEach(r => adicionar(chave(r.data, r.conta, r.categoria, Math.sign(r.valor)), 'planilha', r));
  entradas.filter(m => normalizarTexto(m.tipoConciliacao) === 'parcelas de cartoes')
    .forEach(m => adicionar(chave(m.data, m.conta, categoriaRecebimentoAlvorar(m.complemento), Math.sign(m.valor)), 'extrato', m));
  const soma = lista => lista.reduce((s, r) => s + Math.round(r.valor * 100), 0);
  const aceitar = (rows, moves) => {
    moves.forEach(m => resultado.usados.add(m));
    rows.filter(r => r.origem === 'titulos').forEach(r => titulosAceitos.add(r));
    const rateios = new Map();
    const acertos = acertosEntreEmpresasAlvorar().movimentos;
    const contrapartes = new Set(moves.map(m=>acertos.get(m)).filter(Boolean));
    rows.forEach(r => {
      const contraparte = r.origem==='titulos' && contrapartes.size===1 && moves.every(m=>acertos.has(m)) ? [...contrapartes][0] : '';
      const codigoInterno = contraparte ? '1768' : codigoRecebimentoInternoAlvorar({...r,movimento:'recebimento',total:r.valor});
      const identidade = [r.dataKey, contaNormalizadaAlvorar(r.conta), r.centroCusto, r.origem, r.tipo, r.plano, Math.sign(r.valor)];
      const chaveRegra = [contaNormalizadaAlvorar(r.conta), r.empresaBanco, r.centroCusto, r.origem, r.tipo, r.plano, Math.sign(r.valor)];
      if(codigoInterno || contraparte) {identidade.push(codigoInterno,contraparte);chaveRegra.push(codigoInterno,contraparte);}
      const id = JSON.stringify(identidade);
      if (!rateios.has(id)) rateios.set(id, { id: 'rec-alvorar-titular-' + encodeURIComponent(id),
        movimento: 'recebimento', rateioRecebimento: true, titularidadeAlvorar: true,
        ...r, codigoInternoAlvorar:codigoInterno, contraparteInterempresaAlvorar:contraparte,
        data: r.dataKey, total: 0, qtd: 0, movimentos: [], intercompany: r.empresaBanco !== r.centroCusto,
        naturezaAlvorar: { categoria: r.origem === 'cartoes' ? 'CARTOES' : 'OUTROS_RECEBIMENTOS',
          label: r.origem === 'cartoes' ? 'Cartoes com titularidade' : 'Titulo recebido', contaEsperada: 'Conta do recebimento da empresa dona da venda',
          chave: 'ALVORAR RECEBIMENTO | ' + JSON.stringify(chaveRegra) } });
      const item = rateios.get(id);
      item.total = arredondarMoeda(item.total + r.valor);
      item.qtd++;
      item.movimentos.push(r);
    });
    resultado.itens.push(...rateios.values());
    return [...rateios.values()];
  };
  grupos.forEach((g, key) => {
    if (g.planilha.length && g.extrato.length && soma(g.planilha) === soma(g.extrato)) aceitar(g.planilha, g.extrato);
    else {
      const vendas = g.planilha.filter(r=>normalizarTexto(r.tipoLancamento)==='venda' && r.valor>0);
      const aceleracoes = g.planilha.filter(r=>normalizarTexto(r.tipoLancamento)==='aceleracao de parcelas' && r.valor>0);
      // Sem tolerancia: somente vendas identificadas que fecham integralmente com a entrada.
      if (vendas.length && aceleracoes.length && vendas.length+aceleracoes.length===g.planilha.length
        && g.extrato.length && g.extrato.every(m=>m.valor>0) && soma(vendas)===soma(g.extrato)) {
        aceitar(vendas,g.extrato);
        resultado.aceleracoesSemNovaEntrada.push({chave:key, conta:g.extrato[0].conta,
          data:dataKey(g.extrato[0].data), valor:soma(aceleracoes)/100, registros:aceleracoes});
      } else if (g.extrato.length && g.extrato.every(m=>m.valor>0)
        && g.extrato.every(m=>codigoPermitidoAlvorar(m.conta))
        && /^mooz(cartoes|boleto)/.test(categoriaRecebimentoAlvorar(g.extrato[0].complemento))) {
        // Divergencias nao sao rateadas: cada entrada pertence a dona da conta e mantem o valor do banco.
        const codigo = /boleto/.test(categoriaRecebimentoAlvorar(g.extrato[0].complemento)) ? '1783' : '1782';
        g.extrato.forEach(m=>{
          const empresa = codigoEmpresaAlvorar(m.conta);
          const fonte = {data:m.data,dataKey:dataKey(m.data),conta:m.conta,empresaBanco:empresa,centroCusto:empresa,
            valor:m.valor,origem:'cartoes',tipo:m.complemento,plano:'Cartoes pelo extrato',historico:descricaoMovimentoExtrato(m),
            adquirente:m.complemento,cartaoPeloExtratoAlvorar:true,codigoCartaoExtratoAlvorar:codigo};
          aceitar([fonte],[m]);
        });
        resultado.cartoesPeloExtrato.push({chave:key,origem:'cartoes',conta:g.extrato[0].conta,data:dataKey(g.extrato[0].data),
          planilha:soma(g.planilha)/100,extrato:soma(g.extrato)/100,codigo,registros:g.planilha});
      } else resultado.divergencias.push({ chave: key, origem: 'cartoes', conta: (g.planilha[0] || g.extrato[0]).conta,
        data: dataKey((g.planilha[0] || g.extrato[0]).data), planilha: soma(g.planilha)/100, extrato: soma(g.extrato)/100 });
    }
  });
  // Titulos: documento/fornecedor + data + conta + valor, sem aceitar apenas coincidencia de valor.
  const porDiaConta = new Map();
  entradas.filter(m => !resultado.usados.has(m) && normalizarTexto(m.tipoConciliacao) !== 'parcelas de cartoes').forEach(m => {
    const k = chave(m.data, m.conta, 'titulos');
    if (!porDiaConta.has(k)) porDiaConta.set(k, []);
    porDiaConta.get(k).push(m);
  });
  const titulos = recebimentosAlvorarTemp.filter(r => r.origem === 'titulos');
  faltasLiquidas.grupos.forEach(grupo => {
    const itens = aceitar(grupo.recebimentos, grupo.extratos);
    const principal = itens.find(i => normalizarTexto(i.plano) === 'vendas de mercadorias');
    principal.total = arredondarMoeda(principal.total - grupo.faltaCentavos / 100);
    principal.faltasCaixaLiquidasAlvorar = grupo.faltas;
  });
  const propostas = titulos.filter(r => !titulosAceitos.has(r)).map(r => ({ r, candidatas: (porDiaConta.get(chave(r.data, r.conta, 'titulos')) || []).filter(m => !resultado.usados.has(m) &&
    Math.round(m.valor*100) === Math.round(r.valor*100) && ((r.numero && String(m.documento || '').split(/\s+/).includes(r.numero))
      || (r.fornecedor && normalizarTexto(m.complemento) === normalizarTexto(r.fornecedor)))) }));
  const disputas = new Map();
  propostas.forEach(p => p.candidatas.forEach(m => disputas.set(m, (disputas.get(m) || 0) + 1)));
  propostas.forEach(({r,candidatas}) => {
    if (candidatas.length === 1 && disputas.get(candidatas[0]) === 1) aceitar([r], candidatas);
  });
  const gruposTitulos = new Map();
  titulos.filter(r => !titulosAceitos.has(r)).forEach(r => {
    const key = JSON.stringify([chave(r.data,r.conta,'titulos'),normalizarTexto(r.fornecedor)]);
    if (!gruposTitulos.has(key)) gruposTitulos.set(key,[]);
    gruposTitulos.get(key).push(r);
  });
  gruposTitulos.forEach(rows => {
    const r = rows[0];
    const moves = (porDiaConta.get(chave(r.data,r.conta,'titulos')) || []).filter(m => !resultado.usados.has(m)
      && normalizarTexto(m.complemento) === normalizarTexto(r.fornecedor));
    if (moves.length && soma(rows) === soma(moves)) aceitar(rows,moves);
    else resultado.divergencias.push({origem:'titulos',data:r.dataKey,conta:r.conta,planilha:soma(rows)/100,
      extrato:soma(moves)/100,fornecedor:r.fornecedor});
  });
  cacheRecebimentosAlvorar = { extrato: extratoBancarioTemp, recebimentos: recebimentosAlvorarTemp, pagamentos: linhasImportadas, qtd: entradas.length, resultado };
  return resultado;
}

function conferenciaDivergenciasRecebimentosAlvorar() {
  const divergencias = cacheRecebimentosAlvorar?.resultado?.divergencias || [];
  const itensPorMovimento = new Map(conciliacaoItensTemp.filter(i=>i.movimento==='saida-pendente').map(i=>[i.idxOriginal,i]));
  const saidas = new Map();
  extratoBancarioTemp.forEach((m,idx)=>{
    if (!(m.valor<0) || normalizarTexto(m.tipoConciliacao)!=='parcelas de cartoes') return;
    const chave = JSON.stringify([dataKey(m.data),contaNormalizadaAlvorar(m.conta),categoriaRecebimentoAlvorar(m.complemento),-1]);
    if (!saidas.has(chave)) saidas.set(chave,{total:0,completas:true});
    const grupo=saidas.get(chave), item=itensPorMovimento.get(idx);
    grupo.total+=Math.round(m.valor*100);
    grupo.completas=grupo.completas && !!item && !saidasExtratoRevisadasConciliacaoTemp[item.id]
      && Math.round(item.total*100)===Math.round(Math.abs(m.valor)*100)
      && !!obterCodigoContaParaDominio(codigosConciliacaoTemp[item.id]);
  });
  const classificadas=[], pendentes=[];
  divergencias.forEach(d=>{
    const grupo=d.origem==='cartoes' && d.planilha===0 && d.extrato<0 ? saidas.get(d.chave) : null;
    if (grupo?.completas && grupo.total===Math.round(d.extrato*100)) classificadas.push(d);
    else pendentes.push(d);
  });
  return {pendentes,classificadas};
}

function contasRecebimentosSemExtratoAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return [];
  const presentes = new Set(extratoBancarioTemp.map(m=>contaNormalizadaAlvorar(m.conta)));
  const contas = new Map(recebimentosAlvorarTemp.map(r=>[contaNormalizadaAlvorar(r.conta),r.conta]));
  return [...contas].filter(([chave])=>!presentes.has(chave)).map(([,conta])=>conta).sort();
}

function bloquearRecebimentosAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return false;
  if (!recebimentosAlvorarTemp.length) {
    if (extratoBancarioTemp.some(m => normalizarTexto(m.tipoConciliacao) === 'parcelas de cartoes')) {
      alert('Importe os recebimentos da ALVORAR para identificar a empresa dona das vendas antes de exportar.');
      return true;
    }
    return false;
  }
  const resumo = cacheRecebimentosAlvorar?.resultado;
  const conferencia = conferenciaDivergenciasRecebimentosAlvorar();
  const ausentes = contasRecebimentosSemExtratoAlvorar();
  if (!resumo || conferencia.pendentes.length) {
    alert(`A exportacao ALVORAR foi pausada: ${conferencia.pendentes.length || 'ha'} grupos de recebimentos sem titularidade/valor confirmado com o extrato.${ausentes.length ? ' Extratos ausentes: '+ausentes.join(', ')+'.' : ''} Exporte a conferencia para revisar. Nenhum valor sera rateado por aproximacao.`);
    return true;
  }
  return false;
}

function htmlConferenciaRecebimentosAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !recebimentosAlvorarTemp.length) return '';
  const r = cacheRecebimentosAlvorar?.resultado;
  if (!r) return '';
  const faltas = apurarFaltasCaixaLiquidasAlvorar();
  const totalFaltas = [...faltas.grupos.values()].reduce((s, g) => s + g.faltaCentavos, 0) / 100;
  const conferencia = conferenciaDivergenciasRecebimentosAlvorar();
  const ausentes = contasRecebimentosSemExtratoAlvorar();
  return `<div class="alert ${conferencia.pendentes.length ? 'alert-warn' : 'alert-ok'}" style="display:block">Recebimentos ALVORAR: ${r.itens.length} parcelas de rateio identificadas · ${conferencia.pendentes.length} divergencias de origem/valor.
    ${ausentes.length ? `<div><strong>Extratos ausentes:</strong> ${ausentes.map(c=>escapeHtml(rotuloContaFinanceiraAlvorar(c))).join(', ')}</div>` : ''}
    ${conferencia.classificadas.length ? `<span>Saidas de cartoes ja classificadas: ${conferencia.classificadas.length} grupos.</span>` : ''}
    ${r.aceleracoesSemNovaEntrada?.length ? `<span>Aceleracoes sem nova entrada: ${r.aceleracoesSemNovaEntrada.length} grupos.</span>` : ''}
    ${r.cartoesPeloExtrato?.length ? `<span>Cartoes pelo valor do extrato: ${r.cartoesPeloExtrato.length} grupos; diferencas do relatorio apenas para conferencia.</span>` : ''}
    ${faltas.indices.size ? `<span>Faltas ja refletidas na entrada liquida: ${faltas.indices.size} / R$ ${fmtValor(totalFaltas)}. Sem nova saida de caixa.</span>` : ''}
    <button class="btn btn-sm" onclick="exportarConferenciaRecebimentosAlvorar()">Exportar conferencia</button></div>`;
}

function criarConferenciaRecebimentosAlvorar() {
  const conferencia = conferenciaDivergenciasRecebimentosAlvorar();
  const rows = [...conferencia.pendentes.map(r=>({...r,situacao:'Pendente'})),
    ...conferencia.classificadas.map(r=>({...r,situacao:'Saida ja classificada'})),
    ...(cacheRecebimentosAlvorar?.resultado?.cartoesPeloExtrato || []).map(r=>({...r,situacao:'Valor do extrato; diferenca sem lancamento'}))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Origem','Data','Conta','Planilha','Extrato','Diferenca','Fornecedor','Situacao'],
    ...rows.map(r => [r.origem,r.data,rotuloContaFinanceiraAlvorar(r.conta),r.planilha,r.extrato,arredondarMoeda(r.planilha-r.extrato),r.fornecedor || '',r.situacao])]);
  ws['!cols'] = [18,16,45,20,20,20,45,30].map(wch => ({wch}));
  XLSX.utils.book_append_sheet(wb,ws,'Divergencias');
  const aceleracoes = cacheRecebimentosAlvorar?.resultado?.aceleracoesSemNovaEntrada || [];
  if (aceleracoes.length) {
    const dados = [['Data','Conta','Empresa da venda','Valor','Tipo','Arquivo origem','Linha origem'],
      ...aceleracoes.flatMap(g=>g.registros.map(r=>[g.data,rotuloContaFinanceiraAlvorar(g.conta),rotuloUnidadeAlvorar(r.centroCusto),r.valor,r.tipoLancamento,r.arquivoOrigem,r.linhaOrigem]))];
    const revisao = XLSX.utils.aoa_to_sheet(dados);
    revisao['!cols']=[16,45,24,20,30,35,18].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,revisao,'Aceleracoes sem nova entrada');
  }
  return wb;
}

function exportarConferenciaRecebimentosAlvorar() {
  XLSX.writeFile(criarConferenciaRecebimentosAlvorar(),'Conferencia_Recebimentos_ALVORAR.xlsx');
}

function tipoContaAlvorar(conta) {
  const n = normalizarTexto(conta);
  return /\bcaixa\b/.test(n) ? 'Caixa' : /\bapli\b|aplicacao/.test(n) ? 'Aplicacoes' : 'Banco';
}

function movimentoDepositoCaixaBancoAlvorar(mov) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !codigoPermitidoAlvorar(mov.conta)) return null;
  const tipo = tipoContaAlvorar(mov.conta);
  if (!((tipo === 'Caixa' && mov.valor < 0) || (tipo === 'Banco' && mov.valor > 0))) return null;
  if (tipo === 'Caixa' && !movimentoEhTransferenciaEntreContas(mov)) return null;
  const referencias = (tipo === 'Caixa' ? [mov.historico] : [mov.complemento, mov.historico]).filter(Boolean);
  const candidatas = referencias.filter(conta => {
    if (!codigoPermitidoAlvorar(conta)) return false;
    const nome = normalizarTexto(conta);
    const caixaLoja = /\bcaixa\s+loja\b|\bconta\s+caixa\b/.test(nome);
    if (tipo === 'Banco') return caixaLoja;
    return !caixaLoja && tipoContaAlvorar(conta) !== 'Aplicacoes'
      && /\bbanco\b|\bitau\b|\bsicoob\b|\bbradesco\b|\bsantander\b|\bsicredi\b|\bcef\b/.test(nome);
  });
  if (!candidatas.length) {
    if (tipo === 'Caixa' && codigoPermitidoAlvorar(mov.complemento)
      && /\bbanco\b|\bitau\b|\bsicoob\b|\bbradesco\b|\bsantander\b|\bsicredi\b|\bcef\b/.test(normalizarTexto(mov.complemento))) {
      return {mov, cnpj:cnpjContaFinanceira(mov.conta) || codigoPermitidoAlvorar(mov.conta), outraConta:''};
    }
    return null;
  }
  return { mov, cnpj: cnpjContaFinanceira(mov.conta) || codigoPermitidoAlvorar(mov.conta), outraConta: candidatas[0] };
}

function titularidadeDepositoCaixaAlvorar(deposito) {
  const origem = codigoEmpresaAlvorar(deposito.mov.conta);
  const destino = codigoEmpresaAlvorar(deposito.outraConta);
  if (!origem || !destino) return {pendente:true, origem, destino};
  const cnpjOrigem = cnpjContaFinanceira(deposito.mov.conta);
  const cnpjDestino = cnpjContaFinanceira(deposito.outraConta);
  if (origem === destino) return {origem, destino, proprio:true};
  if (!cnpjOrigem || !cnpjDestino) return {pendente:true, origem, destino};
  if (cnpjOrigem === cnpjDestino) return {origem, destino, proprio:true};
  const contas = cnpjOrigem.slice(0,8) === cnpjDestino.slice(0,8)
    ? CONTAS_CORRENTES_ALVORAR.transferencias : CONTAS_CORRENTES_ALVORAR.emprestimos;
  return {origem, destino, cnpjOrigem, cnpjDestino, contas};
}

function montarDepositosCaixaAlvorar() {
  return [...movimentosTransitoParcelas().values()].flatMap(deposito => {
    const {mov, outraConta} = deposito;
    const data = fmtDate(mov.data), valor = Math.abs(mov.valor);
    const conta = codigoBancoConciliacao(mov.conta);
    const historico = `Deposito em transito - ${mov.conta} / ${outraConta} - ${descricaoMovimentoExtrato(mov)}`;
    if (mov.valor > 0) {
      const linha = linhaDominio(data, conta, '51531', valor, historico, codigoEmpresaAlvorar(mov.conta), 'PROPRIO');
      linha.tipoExtratoAlvorar = 'Banco';
      return [linha];
    }
    const titular = titularidadeDepositoCaixaAlvorar(deposito);
    if (titular.pendente) return [];
    if (titular.proprio) {
      const linha = linhaDominio(data, '51531', conta, valor, historico, titular.origem, 'PROPRIO');
      linha.tipoExtratoAlvorar = 'Caixa';
      return [linha];
    }
    // A matriz assume o transito na retirada; a entrada bancaria nao identifica a filial.
    const complemento = `Transferencia de caixa origem ${titular.origem} destino ${titular.destino} - ${historico}`;
    const linhas = [
      linhaDominio(data, titular.contas.ATIVO, conta, valor, complemento, titular.origem, 'TRANSFERENCIA DE NUMERARIOS'),
      linhaDominio(data, '51531', titular.contas.PASSIVO, valor, complemento, titular.destino, 'TRANSFERENCIA DE NUMERARIOS')
    ];
    linhas.forEach(l => { l.tipoExtratoAlvorar = 'Caixa'; });
    return linhas;
  });
}

function conferenciaParesTransferenciasCaixaAlvorar(linhas) {
  const pares = new Map();
  linhas.forEach(l => {
    if (![l[1],l[2]].some(c=>['597','611'].includes(String(c)))) return;
    const match = String(l[5] || '').match(/^Transferencia de caixa origem (\d+) destino (\d+) -/);
    const origem = match?.[1] || '', destino = match?.[2] || '';
    const key = `${origem}|${destino}`;
    if (!pares.has(key)) pares.set(key, {origem,destino,valores:[0,0,0,0],saidas:0,identificado:!!match});
    const par = pares.get(key), valor = Math.round(Number(l[3] || 0)*100);
    if (String(l[1])==='597') { par.valores[0]+=valor; par.saidas++; if (String(l[7])!==origem) par.identificado=false; }
    if (String(l[2])==='597') par.valores[1]+=valor;
    if (String(l[1])==='611') par.valores[2]+=valor;
    if (String(l[2])==='611') { par.valores[3]+=valor; if (String(l[7])!==destino) par.identificado=false; }
  });
  return [...pares.values()].sort((a,b)=>Number(a.destino)-Number(b.destino)||Number(a.origem)-Number(b.origem)).map(p=>({
    ...p, diferencaDebitos:p.valores[0]-p.valores[3], diferencaCreditos:p.valores[1]-p.valores[2],
    bate:p.identificado && !!familiaEmpresaAlvorar(p.origem) && !!familiaEmpresaAlvorar(p.destino)
      && p.valores[0]===p.valores[3] && p.valores[1]===p.valores[2]
  }));
}

function marcarMovimentoExportacaoAlvorar(linhas, movimento) {
  if (modoImportacaoDoGrupo() === 'alvorar') linhas.forEach(l => { l.movimentoExportacaoAlvorar = movimento; });
  return linhas;
}

function particionarExportacaoAlvorar(linhas, { separarMovimentos = false } = {}) {
  const contas = new Map();
  extratoBancarioTemp.forEach(m => [m.conta, codigoBancoConciliacao(m.conta)].forEach(c => {
    const k = `${codigoPermitidoAlvorar(m.conta)}|${contaNormalizadaAlvorar(c)}`;
    if (!contas.has(k)) contas.set(k,new Set());
    contas.get(k).add(tipoContaAlvorar(m.conta));
  }));
  const arquivos = new Map();
  linhas.forEach(linha => {
    const familia = familiaEmpresaAlvorar(linha[7]);
    if (!familia) throw new Error(`Estabelecimento nao permitido no ZIP: ${linha[7]}`);
    const tipos = [...new Set([...(contas.get(`${linha[7]}|${contaNormalizadaAlvorar(linha[1])}`) || []), ...(contas.get(`${linha[7]}|${contaNormalizadaAlvorar(linha[2])}`) || [])])];
    const tipo = linha.tipoExtratoAlvorar || (tipos.includes('Banco') ? 'Banco' : tipos.includes('Caixa') ? 'Caixa' : tipos.includes('Aplicacoes') ? 'Aplicacoes' : '');
    if (!tipo) throw new Error(`Lancamento sem origem de extrato identificada: ${linha[5]}`);
    const movimento = linha.movimentoExportacaoAlvorar;
    if (separarMovimentos && !['Pagamentos','Recebimentos','Transferencias'].includes(movimento)) {
      throw new Error(`Lancamento sem origem de pagamento, recebimento ou transferencia: ${linha[5]}`);
    }
    const caminho = `${separarMovimentos ? movimento + '/' : ''}${tipo}/${familia}.xlsx`;
    if (!arquivos.has(caminho)) arquivos.set(caminho, []);
    arquivos.get(caminho).push(linha.slice());
  });
  return arquivos;
}

function calcularConferenciaContasCorrentesAlvorar(linhas) {
  const grupos = Object.entries(CONTAS_CORRENTES_ALVORAR).map(([categoria, contas]) => ({
    categoria, contas, valores: [0,0,0,0], empresas: new Map()
  }));
  linhas.forEach(linha => {
    const empresa = String(linha[7] || '');
    grupos.forEach(grupo => {
      const {ATIVO, PASSIVO} = grupo.contas;
      const valor = Math.round(Number(linha[3] || 0) * 100);
      const parcelas = [String(linha[1]) === ATIVO, String(linha[2]) === ATIVO,
        String(linha[1]) === PASSIVO, String(linha[2]) === PASSIVO].map(usa => usa ? valor : 0);
      if (!parcelas.some(Boolean)) return;
      if (!grupo.empresas.has(empresa)) grupo.empresas.set(empresa, [0,0,0,0]);
      parcelas.forEach((v,i) => { grupo.valores[i] += v; grupo.empresas.get(empresa)[i] += v; });
    });
  });
  return grupos.map(grupo => {
    const [debitoAtivo, creditoAtivo, debitoPassivo, creditoPassivo] = grupo.valores;
    const diferencaDebitos = debitoAtivo - creditoPassivo;
    const diferencaCreditos = creditoAtivo - debitoPassivo;
    const empresas = [...grupo.empresas].sort(([a],[b]) => Number(a)-Number(b)).map(([empresa, valores]) => ({empresa, valores}));
    const pares = grupo.categoria === 'transferencias' ? conferenciaParesTransferenciasCaixaAlvorar(linhas) : [];
    return {...grupo, empresas, pares, diferencaDebitos, diferencaCreditos,
      saldoAtivo:debitoAtivo-creditoAtivo, saldoPassivo:creditoPassivo-debitoPassivo,
      bate:diferencaDebitos===0 && diferencaCreditos===0 && empresas.every(e=>!!familiaEmpresaAlvorar(e.empresa)) && pares.every(p=>p.bate),
      temMovimento:empresas.length>0};
  });
}

function htmlConferenciaContasCorrentesAlvorar(resumo, escopo = 'Arquivo final projetado') {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !resumo) return '';
  const labels = {pagamentos:'Pagamentos',recebimentos:'Recebimentos',emprestimos:'Emprestimos sem vinculo',transferencias:'Transferencias de caixa'};
  const moeda = centavos => `R$ ${fmtValor(centavos/100)}`;
  const status = g => !g.temMovimento ? 'Sem movimento' : g.bate ? 'Espelhamento confere' : 'Diferenca';
  const linhas = resumo.map(g => `<tr><td>${labels[g.categoria]}</td><td>${g.contas.ATIVO} / ${g.contas.PASSIVO}</td>
    <td class="col-value">${moeda(g.valores[0])}</td><td class="col-value">${moeda(g.valores[3])}</td><td class="col-value">${moeda(g.diferencaDebitos)}</td>
    <td class="col-value">${moeda(g.valores[1])}</td><td class="col-value">${moeda(g.valores[2])}</td><td class="col-value">${moeda(g.diferencaCreditos)}</td>
    <td>${status(g)}</td></tr>`).join('');
  const detalhes = resumo.flatMap(g => g.empresas.map(({empresa,valores:v}) => `<tr><td>${labels[g.categoria]}</td><td>${escapeHtml(rotuloUnidadeAlvorar(empresa || 'Empresa pendente'))}</td>
    <td>${g.contas.ATIVO} / ${g.contas.PASSIVO}</td><td class="col-value">${moeda(v[0]-v[1])}</td><td class="col-value">${moeda(v[3]-v[2])}</td></tr>`)).join('');
  const pares = resumo.find(g=>g.categoria==='transferencias')?.pares || [];
  const quadroPares = pares.length ? `<details class="conciliacao-diff-details" style="margin-top:10px" data-conferencia-pares-caixa-alvorar><summary>Transferencias de caixa por par filial/matriz (597 x 611)</summary><div class="table-wrap"><table style="min-width:800px"><thead><tr><th>Filial de origem</th><th>Matriz destinataria</th><th>Saidas</th><th>D 597</th><th>C 611</th><th>Diferenca</th><th>Status</th></tr></thead><tbody>${pares.map(p=>`<tr><td>${escapeHtml(rotuloUnidadeAlvorar(p.origem || 'Pendente'))}</td><td>${escapeHtml(rotuloUnidadeAlvorar(p.destino || 'Pendente'))}</td><td>${p.saidas}</td><td class="col-value">${moeda(p.valores[0])}</td><td class="col-value">${moeda(p.valores[3])}</td><td class="col-value">${moeda(p.diferencaDebitos)}</td><td>${p.bate?'Conferido':'Revisar'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<section class="conciliacao-check-alert" style="margin-top:14px" data-conferencia-contas-correntes-alvorar>
    <div class="conciliacao-check-head"><div><strong>Conferencia de numerarios, emprestimos e transferencias</strong><span>${escapeHtml(escopo)}</span></div></div>
    <div class="table-wrap"><table style="min-width:1050px"><thead><tr><th>Natureza</th><th>Ativo / Passivo</th><th>D ativo</th><th>C passivo</th><th>Diferenca</th><th>C ativo</th><th>D passivo</th><th>Diferenca</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table></div>
    ${detalhes ? `<details class="conciliacao-diff-details" style="margin-top:10px"><summary>Saldos do movimento por empresa</summary><div class="table-wrap"><table><thead><tr><th>Natureza</th><th>Empresa / filial</th><th>Ativo / Passivo</th><th>Saldo devedor ativo</th><th>Saldo credor passivo</th></tr></thead><tbody>${detalhes}</tbody></table></div></details>` : ''}
    ${quadroPares}
  </section>`;
}

function adicionarConferenciaNumerariosAlvorar(wb, linhas) {
  const empresas = new Map();
  const naturezas = new Map(Object.values(CONTAS_CORRENTES_ALVORAR).flatMap(contas =>
    Object.entries(contas).map(([natureza, codigo]) => [codigo, natureza])));
  linhas.forEach(linha => {
    const empresa = String(linha[7]);
    if (!familiaEmpresaAlvorar(empresa)) return;
    [linha[1], linha[2]].forEach(codigo => {
      const natureza = naturezas.get(String(codigo));
      if (!natureza) return;
      if (!empresas.has(empresa)) empresas.set(empresa,{ATIVO:new Set(),PASSIVO:new Set()});
      empresas.get(empresa)[natureza].add(String(codigo));
    });
  });
  if (!empresas.size) return;
  const totals = [0,0,0,0];
  const dados = [...empresas].sort(([a],[b])=>Number(a)-Number(b)).map(([empresa,contas]) => {
    const valores = [0,0,0,0];
    linhas.filter(l=>String(l[7])===empresa).forEach(l=>{
      const valor = Math.round(l[3]*100);
      if(contas.ATIVO.has(String(l[1]))) valores[0]+=valor;
      if(contas.ATIVO.has(String(l[2]))) valores[1]+=valor;
      if(contas.PASSIVO.has(String(l[1]))) valores[2]+=valor;
      if(contas.PASSIVO.has(String(l[2]))) valores[3]+=valor;
    });
    valores.forEach((v,i)=>totals[i]+=v);
    return [rotuloUnidadeAlvorar(empresa),[...contas.ATIVO].join(', '),valores[0]/100,valores[1]/100,(valores[0]-valores[1])/100,
      [...contas.PASSIVO].join(', '),valores[2]/100,valores[3]/100,(valores[2]-valores[3])/100];
  });
  dados.push(['TOTAL','',totals[0]/100,totals[1]/100,(totals[0]-totals[1])/100,'',totals[2]/100,totals[3]/100,(totals[2]-totals[3])/100]);
  const ws = XLSX.utils.aoa_to_sheet([['Estabelecimento','Contas ativo','Debitos ativo','Creditos ativo','Saldo ativo','Contas passivo','Debitos passivo','Creditos passivo','Saldo passivo'],...dados,
    [],['Espelhamento D ativo x C passivo',(totals[0]-totals[3])/100],['Espelhamento C ativo x D passivo',(totals[1]-totals[2])/100]]);
  ws['!cols']=[36,25,20,20,20,25,20,20,20].map(wch=>({wch}));
  XLSX.utils.book_append_sheet(wb,ws,'Numerarios ALVORAR');
  const conferencia = calcularConferenciaContasCorrentesAlvorar(linhas);
  const labels = {pagamentos:'Pagamentos',recebimentos:'Recebimentos',emprestimos:'Emprestimos entre empresas sem vinculo',transferencias:'Transferencias de caixa'};
  const rows = [['Natureza','Estabelecimento','Conta ativo','Conta passivo','Debitos ativo','Creditos ativo','Saldo devedor ativo','Debitos passivo','Creditos passivo','Saldo credor passivo','Dif. D ativo x C passivo','Dif. C ativo x D passivo','Status']];
  conferencia.forEach(g => {
    g.empresas.forEach(({empresa,valores:v}) => rows.push([labels[g.categoria],rotuloUnidadeAlvorar(empresa),g.contas.ATIVO,g.contas.PASSIVO,
      v[0]/100,v[1]/100,(v[0]-v[1])/100,v[2]/100,v[3]/100,(v[3]-v[2])/100,'','','Saldo do movimento']));
    const v=g.valores;
    rows.push([labels[g.categoria],'TOTAL',g.contas.ATIVO,g.contas.PASSIVO,v[0]/100,v[1]/100,g.saldoAtivo/100,
      v[2]/100,v[3]/100,g.saldoPassivo/100,g.diferencaDebitos/100,g.diferencaCreditos/100,
      !g.temMovimento?'SEM MOVIMENTO':g.bate?'CONFERIDO':'DIFERENCA']);
  });
  const separado = XLSX.utils.aoa_to_sheet(rows);
  separado['!cols']=[40,36,18,18,20,20,22,20,20,22,26,26,24].map(wch=>({wch}));
  XLSX.utils.book_append_sheet(wb,separado,'Conferencia por natureza');
  const pares = conferencia.find(g=>g.categoria==='transferencias').pares;
  if (pares.length) {
    const dadosPares = [['Filial origem','Matriz destino','Saidas de caixa','Debitos 597','Creditos 611','Diferenca','Status'],
      ...pares.map(p=>[rotuloUnidadeAlvorar(p.origem),rotuloUnidadeAlvorar(p.destino),p.saidas,p.valores[0]/100,p.valores[3]/100,p.diferencaDebitos/100,p.bate?'CONFERIDO':'DIFERENCA'])];
    const wsPares = XLSX.utils.aoa_to_sheet(dadosPares);
    wsPares['!cols']=[36,36,20,22,22,22,20].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,wsPares,'Transferencias caixa - pares');
  }
}

function saidasAvulsasPagamentosAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return [];
  const vinculados = new Set(sugestoesParcelasExtratoTemp.flatMap(s => s.mov ? (s.movs || [s.mov]) : []));
  const pareados = indicesTransferenciasPareadas(extratoBancarioTemp);
  const transitos = movimentosTransitoParcelas();
  const vistos = new Set();
  return conciliacaoItensTemp.filter(item => {
    if (item.movimento !== 'saida-pendente' || saidasExtratoRevisadasConciliacaoTemp[item.id]) return false;
    const idx = item.idxOriginal;
    const mov = extratoBancarioTemp[idx];
    if (!mov || mov.valor >= 0 || vinculados.has(mov) || pareados.has(idx) || transitos.has(idx) || vistos.has(idx)) return false;
    vistos.add(idx);
    return true;
  });
}

function conferirSaidasExportacaoPagamentosAlvorar(linhas, avulsas) {
  const movimentos = new Set(sugestoesParcelasExtratoTemp.flatMap(s => s.mov ? (s.movs || [s.mov]) : []));
  avulsas.forEach(item => movimentos.add(extratoBancarioTemp[item.idxOriginal]));
  const esperados = new Map();
  movimentos.forEach(m => {
    const chave = JSON.stringify([normalizarTexto(m.conta), dataKey(m.data)]);
    esperados.set(chave, (esperados.get(chave) || 0) + Math.round(Math.abs(m.valor) * 100));
  });
  return conferirParcelasPorContaDia(linhas, true).filter(d => d.entradaDominio !== 0
    || d.saidaDominio !== (esperados.get(JSON.stringify([normalizarTexto(d.conta), d.data])) || 0));
}

function montarExportacaoPagamentosAlvorar() {
  if (!extratoBancarioTemp.length) {
    alert('Importe os extratos para exportar os pagamentos conciliados da ALVORAR.');
    return null;
  }
  gerarSugestoesConciliacao({ redirecionarSeOk: false });
  const semVinculo = sugestoesParcelasExtratoTemp.filter(s => !s.mov
    && vinculosPagamentoConciliacaoTemp['pag-' + s.pag.idx] !== VINCULO_PAGAMENTO_SEM_EXTRATO);
  if (semVinculo.length) {
    alert(`${semVinculo.length} titulo(s) de pagamento sem vinculo com o extrato. Revise antes de exportar.`);
    alterarVisaoPendenciasAlvorar('vinculos');
    return null;
  }
  const avulsas = saidasAvulsasPagamentosAlvorar();
  if (avulsas.some(item => !obterCodigoContaParaDominio(codigosConciliacaoTemp[item.id]))) {
    alert('Preencha a contrapartida das saidas avulsas do extrato antes de exportar os pagamentos.');
    alterarVisaoPendenciasAlvorar('contas');
    return null;
  }
  const linhas = montarPagamentosConciliadosParcelas();
  avulsas.forEach(item => {
    const mov = extratoBancarioTemp[item.idxOriginal];
    const linha = linhaDominio(fmtDate(mov.data), obterCodigoContaParaDominio(codigosConciliacaoTemp[item.id]),
      codigoBancoConciliacao(mov.conta), Math.abs(mov.valor), descricaoMovimentoExtrato(mov) || item.historico,
      empresaBancoConciliacao(item, mov), '');
    linha.tipoExtratoAlvorar = tipoContaAlvorar(mov.conta);
    linha.movimentoExportacaoAlvorar = 'Pagamentos';
    linhas.push(linha);
  });
  if (!linhas.length) {
    alert('Nenhum pagamento conciliado para exportar.');
    return null;
  }
  if (!contasPendentesTitulosExportaveisAlvorar(linhas)) {
    alert('Preencha as contas do banco e dos numerarios vinculados antes de exportar.');
    return null;
  }
  if (linhas.some(l => !codigoEmpresaAlvorar(l[7])) || bloquearExportacaoPorEmpresaMatrizFilial(linhas)) return null;
  const diferencas = conferirSaidasExportacaoPagamentosAlvorar(linhas, avulsas);
  if (diferencas.length) {
    alert(`Exportacao interrompida: ${diferencas.length} diferenca(s) nas saidas dos pagamentos por conta/dia.`);
    return null;
  }
  if (!confirmarExportacaoTitulosSemContaAlvorar(linhas)) return null;
  return linhas;
}

function exportarPagamentosAlvorar() {
  const linhas = montarExportacaoPagamentosAlvorar();
  if (linhas) return exportarZipAlvorar(linhas, { somentePagamentos: true });
}

function contaPendenteDeTituloAlvorar(lancamento) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !lancamento || lancamento.origemConciliacao) return false;
  const row = linhasImportadas[lancamento.idx];
  if (!row || (lancamento.codDebito && lancamento.codCredito)) return false;
  const empresa = linhaEhParcelasNumerarios(row) ? centroCustoLinha(row) : empresaLancamentoLinha(row);
  if (String(lancamento.empresa) !== String(empresa)) return false;
  if (lancamento.tipoAjuste) return true;
  // So adiar a conta principal; banco e numerarios continuam obrigatorios.
  if (codigoPagamentoInternoAlvorar(row)) return false;
  return lancamento.rateioNegativo
    ? !!lancamento.codDebito && !lancamento.codCredito
    : !lancamento.codDebito && !!lancamento.codCredito;
}

function contasPendentesTitulosExportaveisAlvorar(linhas) {
  return modoImportacaoDoGrupo() === 'alvorar'
    && linhas.filter(l => !l[1] || !l[2]).every(l => l.contaPendenteTituloAlvorar === true);
}

function confirmarExportacaoTitulosSemContaAlvorar(linhas) {
  const pendentes = linhas.filter(l => !l[1] || !l[2]);
  if (!pendentes.length) return true;
  if (!contasPendentesTitulosExportaveisAlvorar(linhas)) return false;
  return confirm(`${pendentes.length} linha(s) de titulos ainda sem conta contabil. Exportar com essas contas em branco para preenchimento posterior? Os movimentos e valores serao mantidos. Preencha as contas antes de importar no Dominio. A lista estara em Conferencias/Contas_pendentes_titulos.xlsx.`);
}

function criarConferenciaContasPendentesTitulosAlvorar(linhas) {
  const pendentes = linhas.filter(l => l.contaPendenteTituloAlvorar && (!l[1] || !l[2]));
  if (!pendentes.length) return null;
  const wb = XLSX.utils.book_new();
  const rows = [['Data','Empresa / unidade','Conta debito','Conta credito','Valor','Historico','Preenchimento pendente'],
    ...pendentes.map(l => [l[0],rotuloUnidadeAlvorar(l[7]),l[1],l[2],l[3],l[5],
      [!l[1]?'Debito':'',!l[2]?'Credito':''].filter(Boolean).join(' e ')])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [16,36,22,22,20,90,26].map(wch => ({wch}));
  ws['!autofilter'] = {ref:`A1:G${rows.length}`};
  pendentes.forEach((_,i)=>{const cell=ws[`E${i+2}`];if(cell)cell.z='#,##0.00';});
  XLSX.utils.book_append_sheet(wb,ws,'Contas a preencher');
  return wb;
}

function montarExportacaoFinalAlvorar() {
  if (!extratoBancarioTemp.length) {
    alert('Importe os extratos antes de exportar o arquivo final conciliado da ALVORAR.');
    return null;
  }
  origemModalPendencias = 'conciliacao';
  gerarSugestoesConciliacao({ redirecionarSeOk: false });
  if (bloquearRecebimentosAlvorar()) return null;
  const pagamentos = montarPagamentosConciliadosParcelas();
  const conciliacao = montarLinhasDominioConciliacao();
  if (conciliacao === null) return null;
  const recebimentos = marcarMovimentoExportacaoAlvorar(montarLinhasRecebimentosImportadosParaFinal(), 'Recebimentos');
  const linhas = [...pagamentos, ...conciliacao, ...recebimentos];
  if (!linhas.length) { alert('Nenhum lancamento conciliado para exportar.'); return null; }
  if (!validarExportacaoParcelasExtrato(linhas) || bloquearExportacaoPorEmpresaMatrizFilial(linhas)) return null;
  return linhas;
}

function exportarDominioFinalAlvorar() {
  const linhas = montarExportacaoFinalAlvorar();
  if (linhas) return exportarZipAlvorar(linhas, { separarMovimentos: true });
}

function nomeContaConferenciaAlvorar(valor) {
  const codigo = String(valor ?? '').trim();
  if (!codigo) return '';
  const conta = encontrarContaPorValor(codigo);
  if (conta?.nome) return conta.nome;
  const fixas = {
    '604': 'Conta corrente - Numerários', '618': 'Conta corrente - Numerários',
    '597': 'Conta Corrente - Transferencia (ativo)', '611': 'Conta Corrente - Transferencia (passivo)',
    '1924': 'Conta corrente - Clientes', '1931': 'Conta corrente - Clientes',
    '1768': 'Empréstimos entre unidades - Ativo', '1775': 'Empréstimos entre unidades - Passivo',
    '51531': 'Caixa - Depósitos em trânsito'
  };
  return fixas[codigo] || (/^\d+$/.test(codigo) ? 'Conta não localizada no plano de contas' : codigo);
}

function adicionarConferenciaContasAlvorar(wb, linhas) {
  const cabecalho = [CABECALHO_DOMINIO[0], CABECALHO_DOMINIO[1], 'Nome Conta Débito',
    CABECALHO_DOMINIO[2], 'Nome Conta Crédito', ...CABECALHO_DOMINIO.slice(3)];
  const dados = linhas.map(l => [l[0], l[1], nomeContaConferenciaAlvorar(l[1]),
    l[2], nomeContaConferenciaAlvorar(l[2]), ...l.slice(3,7), rotuloUnidadeAlvorar(l[7]), ...l.slice(8)]);
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...dados]);
  ws['!cols'] = [12,18,42,18,42,18,18,65,14,36,22,22,24].map(wch => ({ wch }));
  ws['!autofilter'] = { ref: `A1:M${dados.length + 1}` };
  dados.forEach((_, idx) => { const cell = ws[`F${idx + 2}`]; if (cell) cell.z = '#,##0.00'; });
  XLSX.utils.book_append_sheet(wb, ws, 'Conferencia - nao importar');
}

async function exportarZipAlvorar(linhas, { somentePagamentos = false, separarMovimentos = false } = {}) {
  try {
    const arquivos = particionarExportacaoAlvorar(linhas, { separarMovimentos });
    const zip = XLSX.CFB.utils.cfb_new();
    for (const [caminho, dados] of arquivos) {
      const wb = XLSX.utils.book_new();
      dados[0][6] = 1;
      // Um unico conjunto importavel por arquivo; filiais permanecem no Codigo Matriz/Filial.
      adicionarAbaDominio(wb, 'Lancamentos Dominio', dados, new Set());
      XLSX.CFB.utils.cfb_add(zip, caminho, new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
      const revisao = XLSX.utils.book_new();
      adicionarConferenciaContasAlvorar(revisao, dados);
      XLSX.CFB.utils.cfb_add(zip, `Conferencias/Contas/${caminho}`, new Uint8Array(XLSX.write(revisao,{type:'array',bookType:'xlsx'})));
      await aguardarPinturaInterface();
    }
    const conferencia = XLSX.utils.book_new();
    adicionarConferenciaNumerariosAlvorar(conferencia,linhas);
    if (conferencia.SheetNames.length) XLSX.CFB.utils.cfb_add(zip,'Conferencias/Numerarios.xlsx',new Uint8Array(XLSX.write(conferencia,{type:'array',bookType:'xlsx'})));
    const pendenciasTitulos = criarConferenciaContasPendentesTitulosAlvorar(linhas);
    if (pendenciasTitulos) XLSX.CFB.utils.cfb_add(zip,'Conferencias/Contas_pendentes_titulos.xlsx',new Uint8Array(XLSX.write(pendenciasTitulos,{type:'array',bookType:'xlsx'})));
    if (!somentePagamentos && cacheRecebimentosAlvorar?.resultado) {
      const recebimentos = criarConferenciaRecebimentosAlvorar();
      XLSX.CFB.utils.cfb_add(zip,'Conferencias/Recebimentos.xlsx',new Uint8Array(XLSX.write(recebimentos,{type:'array',bookType:'xlsx'})));
    }
    const texto = somentePagamentos
      ? 'SOMENTE PAGAMENTOS CONCILIADOS DA ALVORAR.\nContem titulos pagos vinculados aos extratos, com descontos, acrescimos e numerarios vinculados, e saidas avulsas do extrato com contrapartida preenchida, uma unica vez. Inclui ajustes negativos de cartoes que estejam classificados como saidas avulsas.\nNao contem entradas de recebimentos, depositos caixa/banco nem transferencias, aplicacoes ou resgates gerados pela conciliacao dos extratos. Saidas expressamente marcadas para nao exportar permanecem excluidas.\nBanco, Caixa e Aplicacoes indicam a origem do pagamento; cada familia agrupa matriz e filiais na coluna Codigo Matriz/Filial. Pastas sem pagamentos nao sao geradas.\nA pasta Conferencias nao deve ser importada no Dominio. Este arquivo e parcial: nao representa o fechamento completo de entradas e saidas. Nao importar junto com a exportacao completa do mesmo periodo, para nao duplicar pagamentos.\n'
      : 'Depositos caixa/banco: saida D 51531 / C caixa na pasta Caixa; entrada D banco / C 51531 na pasta Banco. Cada ponta usa a data do proprio extrato, sem pareamento. O saldo em transito pode passar de um mes para outro.\nDemais transferencias: um unico lancamento. Banco tem prioridade sobre Caixa e Aplicacoes; Caixa tem prioridade sobre Aplicacoes.\nFiliais: coluna Codigo Matriz/Filial. A pasta Conferencias nao deve ser importada no Dominio.\nExcluir uma pasta nao remove as contrapartidas de transferencias diretas incluidas em outra. Confira o que ja foi importado pela analista antes de importar arquivos parciais.\n';
    XLSX.CFB.utils.cfb_add(zip,'LEIA-ME.txt',new TextEncoder().encode(texto
      + (pendenciasTitulos ? '\nATENCAO: existem contas de titulos em branco para preenchimento posterior. Os movimentos foram preservados, sem inventar contas. Consulte Conferencias/Contas_pendentes_titulos.xlsx e preencha os arquivos de lancamentos antes de importar no Dominio. Fechamento financeiro conferido nao significa classificacao contabil completa.\n' : '')
      + (separarMovimentos ? '\nEXPORTACAO FINAL SEPARADA: Pagamentos, Recebimentos e Transferencias. Dentro de cada pasta, Banco/Caixa/Aplicacoes e os arquivos de MNN, PCA, SERLOC e VALE, incluindo filiais. Transferencias proprias, aplicacoes/resgates e depositos em transito ficam somente em Transferencias. Numerarios e ajustes acompanham o pagamento ou recebimento que os originou. Pastas sem movimento nao sao geradas. Importar o conjunto completo para reproduzir o fechamento de todos os extratos; importar apenas uma pasta nao reproduz o fechamento integral.\n' : '')
      + '\nConferencias/Contas: copias para revisao, com os nomes ao lado dos codigos de debito e credito. Nao importar estes arquivos no Dominio. Os arquivos de Banco, Caixa e Aplicacoes mantem o layout original de importacao. Contas numericas ausentes do plano sao sinalizadas; os nomes das contas internas fixas sao usados quando disponiveis.\n'));
    const blob = new Blob([XLSX.CFB.write(zip,{type:'array',fileType:'zip',compression:true})],{type:'application/zip'});
    const url = URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=`Dominio_ALVORAR_${somentePagamentos ? 'Somente_Pagamentos_' : separarMovimentos ? 'Final_Separado_' : ''}${new Date().toISOString().slice(0,10)}.zip`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch (err) { alert('Nao foi possivel exportar ALVORAR: '+err.message); }
}
