// O codigo financeiro completo identifica o estabelecimento; a familia e usada somente no ZIP.
const ESTABELECIMENTOS_ALVORAR = {
  MNN: ['3337','5312','7337','12090','12269','13215','14232','14514','21119','22829','23034'],
  PCA: ['14155','18228','19025','22094','19158','21280','22967'],
  SERLOC: ['8016','14384','14518','910301','19123','19124','24503'],
  VALE: ['19024','19023','19157']
};
// CNPJ de cada estabelecimento (relacao ListaDeEmpresas). Usado quando o nome da conta do extrato
// nao traz o codigo da empresa e o CNPJ foi cadastrado em "Empresa das contas".
const CNPJS_ESTABELECIMENTOS_ALVORAR = Object.freeze({
  '8016':'01872967000126', '14384':'01872967000207', '14518':'01872967000398', '910301':'01872967000479',
  '19123':'01872967000550', '19124':'01872967000630', '24503':'01872967000711',
  '14155':'15392672000167', '18228':'15392672000248', '19025':'15392672000329', '22094':'15392672000400',
  '19158':'15392672000590', '21280':'15392672000671', '22967':'15392672000833',
  '3337':'23083975000126', '5312':'23083975000207', '7337':'23083975000398', '12090':'23083975000479',
  '12269':'23083975000550', '13215':'23083975000630', '14232':'23083975000711', '14514':'23083975000800',
  '21119':'23083975000983', '22829':'23083975001017', '23034':'23083975001106',
  '19024':'24961471000124', '19023':'24961471000205', '19157':'24961471000396'
});

// Codigo da empresa pela conta financeira usando o CNPJ cadastrado manualmente para ela.
function codigoEmpresaPorCnpjContaAlvorar(conta) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !conta) return '';
  const chave = normalizarTexto(limparTextoECD(conta));
  const cnpj = normalizarCnpjConta(configGrupos[grupoAtivo]?.cnpjContasFinanceiras?.[chave]);
  if (!cnpj) return '';
  const codigos = new Set(Object.keys(CNPJS_ESTABELECIMENTOS_ALVORAR).filter(c => CNPJS_ESTABELECIMENTOS_ALVORAR[c] === cnpj));
  Object.entries(typeof mapaCnpjEmpresasAlvorar === 'object' && mapaCnpjEmpresasAlvorar ? mapaCnpjEmpresasAlvorar : {})
    .forEach(([codigo, c]) => { if (c === cnpj) codigos.add(codigo); });
  return codigos.size === 1 ? [...codigos][0] : '';
}

// Codigo da empresa da conta: primeiro pelo numero no nome da conta, depois pelo CNPJ cadastrado.
function codigoEmpresaContaAlvorar(conta) {
  return codigoEmpresaAlvorar(conta) || codigoEmpresaPorCnpjContaAlvorar(conta);
}
// Identificacoes da relacao Empresas_CNPJ, nunca pela posicao na lista de filiais.
const NOMES_UNIDADES_ALVORAR = Object.freeze({
  '8016':'SERLOC MATRIZ', '14384':'SERLOC 02', '14518':'SERLOC 03', '910301':'SERLOC 04',
  '19123':'SERLOC 05', '19124':'SERLOC 06', '24503':'SERLOC 07',
  '14155':'PCA MATRIZ', '18228':'PCA 02', '19025':'PCA 03', '22094':'PCA 04', '21280':'PCA 06', '22967':'PCA 08',
  '3337':'MNN MATRIZ', '5312':'MNN 02', '7337':'MNN 03', '12090':'MNN 04', '12269':'MNN 05',
  '13215':'MNN 06', '14232':'MNN 07', '14514':'MNN 08', '21119':'MNN 09', '22829':'MNN 10', '23034':'MNN 11',
  '19158':'PCA 05',
  '19024':'VALE DOURADO MATRIZ', '19023':'VALE DOURADO 02', '19157':'VALE DOURADO 03'
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

function formatarUnidadesExcelAlvorar(ws, linhas, coluna = 7) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return;
  linhas.forEach((linha, idx) => {
    const nome = NOMES_UNIDADES_ALVORAR[String(linha[coluna] ?? '').trim()];
    if (!nome) return;
    const cell = ws[XLSX.utils.encode_cell({r:idx + 1,c:coluna})];
    if (!cell) return;
    // Apenas exibicao: preservar valor/tipo e a posicao das colunas do importador.
    const sufixo = `" (${nome})"`;
    cell.z = `0${sufixo};-0${sufixo};0${sufixo};@${sufixo}`;
    delete cell.w;
  });
  ws['!cols'] = ws['!cols'] || [];
  ws['!cols'][coluna] = {...ws['!cols'][coluna],wch:Math.max(36,ws['!cols'][coluna]?.wch || 0)};
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
const CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR = '51540';
const CODIGO_UME_ALVORAR = '51541';

function codigoContaCorrenteAlvorar(empresaBanco, empresaMovimento, natureza, origem = 'pagamentos') {
  if (modoImportacaoDoGrupo() !== 'alvorar' || grupoMapaCnpjContasImportadas !== grupoAtivo) return '';
  const banco = codigoEmpresaAlvorar(empresaBanco), empresa = codigoEmpresaAlvorar(empresaMovimento);
  if (!banco || !empresa || banco === empresa) return '';
  // CNPJ dos titulos do mes. So quando a unidade NAO tem titulo proprio no mes usa a lista fixa de estabelecimentos;
  // CNPJ conflitante nos titulos (valor vazio no mapa) continua bloqueando, sem reserva.
  const cnpjDe = codigo => Object.hasOwn(mapaCnpjEmpresasAlvorar, codigo)
    ? normalizarCnpjConta(mapaCnpjEmpresasAlvorar[codigo])
    : normalizarCnpjConta(typeof CNPJS_ESTABELECIMENTOS_ALVORAR === 'object' ? CNPJS_ESTABELECIMENTOS_ALVORAR[codigo] : '');
  const cnpjBanco = cnpjDe(banco);
  const cnpjEmpresa = cnpjDe(empresa);
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
    // 16/11/2026: rendimento de aplicacao identificado no extrato vai para a receita de rendimentos (211).
    if (item.movimento === 'recebimento' && item.naturezaAlvorar?.categoria === 'RENDIMENTO_APLICACAO'
      && !obterCodigoContaParaDominio(codigosConciliacaoTemp[item.id])) codigosConciliacaoTemp[item.id] = '211';
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
      else if (mov?.valor < 0 && movimentoEhTransferenciaEntreContas(mov)
        && !codigosConciliacaoTemp[item.id]) codigosConciliacaoTemp[item.id]=CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR;
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
  if (item.movimentos?.length && item.movimentos.every(m=>m.valor>0 && movimentoEhTransferenciaEntreContas(m)))
    return CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR;
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
    if (item.origem === 'cartoes'
      && /^ume$/.test(normalizarTexto(item.adquirente))) return CODIGO_UME_ALVORAR;
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
    // A venda permanece pelo valor bruto. A falta compoe a contrapartida da receita,
    // sem criar uma segunda saida na conta caixa que ja recebeu o valor liquido.
    const linha = linhaDominio(fmtDate(row[COLS.LIQUIDACAO]), '1488', codigoRecebimento, valor,
      'Falta de caixa ja descontada da entrada - ' + row[COLS.CONTA], item.centroCusto, 'PROPRIO');
    linha.tipoExtratoAlvorar = 'Caixa';
    linha.movimentoExportacaoAlvorar = 'Recebimentos';
    return linha;
  });
}

// 16/11/2026 (somente ALVORAR): no CAIXA, titulo "Liquidado" sem "(Conciliado)" no F360 e desconsiderado
// (recebimento e pagamento). Excecao: caixa sem NENHUM lancamento conciliado no mes (ex.: CAIXA LOJA - 5312)
// continua pela planilha inteira, com aviso na conferencia.
function statusNaoConciliadoAlvorar(status) {
  const s = normalizarTexto(status);
  return !!s && s.includes('liquidado') && !s.includes('conciliado');
}

function caixasSemConciliacaoAlvorar() {
  const comConciliado = new Set(), todas = new Set();
  const marcar = (conta, status) => {
    if (tipoContaAlvorar(conta) !== 'Caixa') return;
    const k = contaNormalizadaAlvorar(conta); todas.add(k);
    if (!statusNaoConciliadoAlvorar(status)) comConciliado.add(k);
  };
  recebimentosAlvorarTemp.forEach(r => { if (r.origem === 'titulos') marcar(r.conta, r.statusF360); });
  linhasImportadas.forEach(row => marcar(row?.[COLS.CONTA], row?.[COLS.STATUS]));
  return new Set([...todas].filter(k => !comConciliado.has(k)));
}

function desconsiderarCaixaNaoConciliadoAlvorar(conta, status, semConciliacao = caixasSemConciliacaoAlvorar()) {
  return modoImportacaoDoGrupo() === 'alvorar' && tipoContaAlvorar(conta) === 'Caixa'
    && statusNaoConciliadoAlvorar(status) && !semConciliacao.has(contaNormalizadaAlvorar(conta));
}

function resumoNaoConciliadosCaixaAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return null;
  const sem = caixasSemConciliacaoAlvorar();
  let rq = 0, rv = 0, pq = 0, pv = 0;
  recebimentosAlvorarTemp.forEach(r => { if (r.origem === 'titulos' && desconsiderarCaixaNaoConciliadoAlvorar(r.conta, r.statusF360, sem)) { rq++; rv += Number(r.valor) || 0; } });
  linhasImportadas.forEach(row => { if (desconsiderarCaixaNaoConciliadoAlvorar(row?.[COLS.CONTA], row?.[COLS.STATUS], sem)) { pq++; pv += Math.abs(numeroMoeda(row[COLS.VALOR_LIQ])); } });
  return { recebimentos: rq, valorRecebimentos: arredondarMoeda(rv), pagamentos: pq, valorPagamentos: arredondarMoeda(pv),
    caixasSemConciliacao: [...sem].map(k => (recebimentosAlvorarTemp.find(r => contaNormalizadaAlvorar(r.conta) === k)?.conta)
      || (linhasImportadas.find(row => contaNormalizadaAlvorar(row?.[COLS.CONTA]) === k)?.[COLS.CONTA]) || k) };
}

// 16/11/2026 (somente ALVORAR): titulo pago pelo CAIXA segue a planilha de pagamentos e e lancado
// mesmo sem movimento no extrato do caixa (o extrato do caixa serve so de confronto).
function tituloCaixaPelaPlanilhaAlvorar(s) {
  return modoImportacaoDoGrupo() === 'alvorar' && !!s && !s.mov
    && tipoContaAlvorar(s.pag?.conta || linhasImportadas[s.pag?.idx]?.[COLS.CONTA] || '') === 'Caixa';
}

// 16/11/2026 (somente ALVORAR): fechamento do CAIXA pelas planilhas, e nao pelo extrato do caixa.
// Entradas esperadas = RECEBIDAS CX liquidas das faltas comprovadamente embutidas + contas sem
// RECEBIDAS CX que so existem no extrato + transferencias que entraram no caixa (extrato);
// Saidas esperadas = titulos pagos pelo caixa (CONTAS PAGAS), sem os ajustes convertidos em
// recebimento, + saidas avulsas do extrato + depositos/transferencias que sairam do caixa.
function fechamentoCaixaPelasPlanilhasAlvorar(linhas = []) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return null;
  const chave = c => normalizarTexto(limparTextoExportacaoDominio(c || ''));
  const contas = new Set();
  recebimentosAlvorarTemp.forEach(r => { if (tipoContaAlvorar(r.conta) === 'Caixa') contas.add(chave(r.conta)); });
  linhasImportadas.forEach(row => { if (tipoContaAlvorar(row?.[COLS.CONTA]) === 'Caixa') contas.add(chave(row[COLS.CONTA])); });
  extratoBancarioTemp.forEach(m => { if (tipoContaAlvorar(m.conta) === 'Caixa') contas.add(chave(m.conta)); });
  const centavos = v => Math.round(Math.abs(Number(v) || 0) * 100);
  let planilhaEntradas = 0, planilhaSaidas = 0, dominioEntradas = 0, dominioSaidas = 0;
  const contasRecebimentos = new Set(recebimentosAlvorarTemp.filter(r => tipoContaAlvorar(r.conta) === 'Caixa').map(r => chave(r.conta)));
  const faltasLiquidas = apurarFaltasCaixaLiquidasAlvorar();
  const faltasSemExtrato = new Set(faltasSemExtratoCaixaAlvorar().map(f => f.idx));
  const semConciliacao = caixasSemConciliacaoAlvorar();
  recebimentosAlvorarTemp.forEach(r => { if (tipoContaAlvorar(r.conta) === 'Caixa' && !desconsiderarCaixaNaoConciliadoAlvorar(r.conta, r.statusF360, semConciliacao)) planilhaEntradas += Math.round((Number(r.valor) || 0) * 100); });
  faltasLiquidas.grupos.forEach(grupo => { planilhaEntradas -= grupo.faltaCentavos; });
  linhasImportadas.forEach((row, idx) => {
    if (tipoContaAlvorar(row?.[COLS.CONTA]) === 'Caixa' && normalizarTexto(row[COLS.TIPO]) === 'conta a pagar'
      && numeroMoeda(row[COLS.VALOR_LIQ]) > 0 && !desconsiderarCaixaNaoConciliadoAlvorar(row[COLS.CONTA], row[COLS.STATUS], semConciliacao)
      && !faltasLiquidas.indices.has(idx) && !faltasSemExtrato.has(idx)) planilhaSaidas += centavos(numeroMoeda(row[COLS.VALOR_LIQ]));
  });
  // Se a conta nao veio em RECEBIDAS CX, o proprio extrato do caixa e a unica base para as entradas.
  extratoBancarioTemp.forEach(m => {
    if (m.valor > 0 && tipoContaAlvorar(m.conta) === 'Caixa' && normalizarTexto(m.tipoConciliacao) === 'parcelas de titulos'
      && !contasRecebimentos.has(chave(m.conta))) planilhaEntradas += centavos(m.valor);
  });
  // Saidas avulsas sao movimentos do extrato sem titulo correspondente e entram no arquivo final.
  saidasAvulsasPagamentosAlvorar().forEach(item => {
    const mov = extratoBancarioTemp[item.idxOriginal];
    // Transferencias do caixa (ex.: para TESOURARIA) ja entram no bloco abaixo; aqui so as saidas de titulos sem titulo.
    if (mov && tipoContaAlvorar(mov.conta) === 'Caixa' && normalizarTexto(mov.tipoConciliacao) === 'parcelas de titulos') planilhaSaidas += centavos(mov.valor);
  });
  extratoBancarioTemp.forEach(m => {
    if (tipoContaAlvorar(m.conta) !== 'Caixa' || normalizarTexto(m.tipoConciliacao) === 'parcelas de titulos') return;
    if (m.valor > 0) planilhaEntradas += centavos(m.valor); else planilhaSaidas += centavos(m.valor);
  });
  // Depositos de caixas sem extrato: a saida da caixa vem do deposito que chegou no banco.
  const semExtrato = depositosCaixaSemExtratoAlvorar();
  semExtrato.gerados.forEach(d => { planilhaSaidas += centavos(d.mov.valor); });
  const linhasDepositosBase = montarLinhasDepositosCaixaBaseAlvorar();
  const residuais = baixasResiduaisCaixaSemExtratoAlvorar(linhasDepositosBase);
  residuais.gerados.forEach(d => { planilhaSaidas += centavos(d.valor); });
  linhas.forEach(l => {
    if (contas.has(chave(l[1]))) dominioEntradas += centavos(l[3]);
    if (contas.has(chave(l[2]))) dominioSaidas += centavos(l[3]);
  });
  const r = v => arredondarMoeda(v / 100);
  return { tipo: 'CAIXA (planilhas)', extratoEntradas: r(planilhaEntradas), dominioEntradas: r(dominioEntradas),
    extratoSaidas: r(planilhaSaidas), dominioSaidas: r(dominioSaidas),
    diferencaEntradas: r(dominioEntradas - planilhaEntradas), diferencaSaidas: r(dominioSaidas - planilhaSaidas),
    diferencaSaldo: r((dominioEntradas - dominioSaidas) - (planilhaEntradas - planilhaSaidas)),
    baixasPeloBanco: { qtd: semExtrato.gerados.length, valor: r(semExtrato.gerados.reduce((s, d) => s + centavos(d.mov.valor), 0)) },
    baixasPorSaldo51531: { qtd: residuais.gerados.length, valor: r(residuais.gerados.reduce((s, d) => s + centavos(d.valor), 0)),
      itens: residuais.gerados.map(d => `${d.familia}: ${d.conta} R$ ${fmtValor(d.valor)}`) },
    depositosSemCaixa: { qtd: semExtrato.semCaixa.length + residuais.pendentes.length,
      valor: r(semExtrato.semCaixa.reduce((s, d) => s + centavos(d.mov.valor), 0) + residuais.pendentes.reduce((s, d) => s + centavos(d.valor), 0)),
      itens: [...semExtrato.semCaixa.map(d => `${dataKey(d.mov.data)} ${d.mov.conta} R$ ${fmtValor(Math.abs(d.mov.valor))} - ${d.motivo}`),
        ...residuais.pendentes.map(d => `${d.familia} R$ ${fmtValor(d.valor)} - ${d.motivo}`)].slice(0, 20) } };
}

function resumoVinculosAlvorar() {
  const titulos = sugestoesParcelasExtratoTemp.filter(s => !s.mov && !tituloCaixaPelaPlanilhaAlvorar(s)
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
    const chaveRegra = item.titularidadeAlvorar && item.movimento === 'recebimento' ? item.naturezaAlvorar?.chave : '';
    if (!chaveRegra) { resultado.push(item); return; }
    const chaveDia = JSON.stringify([chaveRegra, dataKey(item.data), contaNormalizadaAlvorar(item.conta), item.empresaBanco, item.centroCusto]);
    if (!grupos.has(chaveDia)) {
      const grupo = { ...item, total: 0, qtd: 0, movimentos: [], diferencaClientesAlvorar: 0 };
      grupos.set(chaveDia, grupo);
      resultado.push(grupo);
    }
    const grupo = grupos.get(chaveDia);
    grupo.total = arredondarMoeda(grupo.total + item.total);
    grupo.qtd += item.qtd || 1;
    grupo.movimentos.push(...(item.movimentos?.length ? item.movimentos : [item]));
    grupo.diferencaClientesAlvorar = arredondarMoeda(grupo.diferencaClientesAlvorar + Number(item.diferencaClientesAlvorar || 0));
    grupo.data = dataKey(item.data);
  });
  return resultado;
}

// Tipo de recebimento (acumulador) para separar os lancamentos: cartao, boleto, PIX, dinheiro ou outros.
function tipoRecebimentoAlvorar(item = {}) {
  const adquirente = limparTextoECD(item.adquirente || '');
  const adqNorm = normalizarTexto(adquirente);
  if (item.origem === 'cartoes') {
    if (/boleto/.test(adqNorm)) return `BOLETO - ${adquirente}`;
    if (/\bpix\b/.test(adqNorm)) return `PIX - ${adquirente}`;
    return `CARTAO - ${adquirente || 'Cartoes'}`;
  }
  if (normalizarTexto(item.fornecedor) === 'vendas dinheiro') return `DINHEIRO - ${limparTextoECD(item.plano || 'Vendas')}`;
  return `OUTROS - ${limparTextoECD(item.plano || item.fornecedor || 'Recebimento')}`;
}

function consolidarRecebimentosAlvorarPorDia(itens) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return itens;
  const grupos = new Map(), resultado = [];
  itens.forEach(item => {
    const codigoFixo = obterCodigoContaParaDominio(codigoRecebimentoInternoAlvorar(item)
      || codigoContrapartidaFixaCartoesAlvorar(item));
    const regraSegura = codigoFixo || item.naturezaAlvorar?.chave || '';
    if (!regraSegura || item.movimento !== 'recebimento') { resultado.push(item); return; }
    const chave = JSON.stringify([dataKey(item.data), contaNormalizadaAlvorar(item.conta), item.empresaBanco,
      item.centroCusto, item.origem, regraSegura, Math.sign(item.total || 0), !!item.intercompany,
      item.contraparteInterempresaAlvorar || '', tipoRecebimentoAlvorar(item)]);
    if (!grupos.has(chave)) {
      const grupo = { ...item, id: 'rec-alvorar-dia-' + encodeURIComponent(chave), total: 0, qtd: 0,
        movimentos: [], diferencaClientesAlvorar: 0, faltasCaixaLiquidasAlvorar: [], tipoRecebimentoAlvorar: tipoRecebimentoAlvorar(item) };
      grupos.set(chave, grupo);
      resultado.push(grupo);
    }
    const grupo = grupos.get(chave);
    grupo.total = arredondarMoeda(grupo.total + Number(item.total || 0));
    grupo.qtd += item.qtd || 1;
    grupo.movimentos.push(...(item.movimentos?.length ? item.movimentos : [item]));
    grupo.diferencaClientesAlvorar = arredondarMoeda(grupo.diferencaClientesAlvorar + Number(item.diferencaClientesAlvorar || 0));
    grupo.faltasCaixaLiquidasAlvorar.push(...(item.faltasCaixaLiquidasAlvorar || []));
    grupo.data = dataKey(item.data);
    if (grupo.qtd > 1) {
      grupo.tipo = grupo.tipoRecebimentoAlvorar;
      grupo.historico = `${grupo.qtd} recebimentos consolidados no dia`;
    }
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
      statusF360: cartoes ? '' : limparTextoECD(r[col('status')] || ''),
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

// 'MM/AAAA' -> 'DD/MM/AAAA' do ultimo dia do mes.
function ultimoDiaMesAlvorar(mes) {
  const [mm, aaaa] = String(mes || '').split('/').map(Number);
  if (!mm || !aaaa) return '';
  const dia = new Date(aaaa, mm, 0).getDate();
  return `${String(dia).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${aaaa}`;
}

// AJUSTE CARTAO DIFERENCA (somente ALVORAR): diferenca do mes entre extrato e planilha, por conta + tipo de cartao,
// lancada na 2098 contra o banco, no ultimo dia do mes, pela empresa dona da conta.
function montarAjustesMensaisCartoesAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return [];
  return (cacheRecebimentosAlvorar?.resultado?.ajustesMensaisCartoes || []).map(a => {
    const banco = codigoBancoConciliacao(a.conta);
    const clientes = obterCodigoContaParaDominio('2098') || '2098';
    const historico = `AJUSTE CARTAO DIFERENCA - ${limparTextoECD(a.conta)} - ${a.tipo || a.categoria} - ${a.mes}`;
    const valor = Math.abs(a.diferenca);
    const empresa = codigoEmpresaContaAlvorar(a.conta);
    const linha = a.diferenca > 0
      ? linhaDominio(a.data, banco, clientes, valor, historico, empresa, 'PROPRIO')
      : linhaDominio(a.data, clientes, banco, valor, historico, empresa, 'PROPRIO');
    linha.tipoExtratoAlvorar = tipoContaAlvorar(a.conta);
    linha.movimentoExportacaoAlvorar = 'Recebimentos';
    linha.ajusteCartaoDiferencaAlvorar = true;
    return linha;
  });
}

function conciliarRecebimentosCompletosAlvorar(entradas) {
  const vazio = { itens: [], usados: new Set(), divergencias: [], aceleracoesSemNovaEntrada: [], cartoesPeloExtrato: [],
    confrontoMensalCartoes: [], ajustesMensaisCartoes: [], caixaPelaPlanilha: [] };
  if (modoImportacaoDoGrupo() !== 'alvorar' || !recebimentosAlvorarTemp.length) return vazio;
  if (cacheRecebimentosAlvorar?.extrato === extratoBancarioTemp && cacheRecebimentosAlvorar.recebimentos === recebimentosAlvorarTemp
    && cacheRecebimentosAlvorar.pagamentos === linhasImportadas
    && cacheRecebimentosAlvorar.qtd === entradas.length) return cacheRecebimentosAlvorar.resultado;
  const resultado = { itens: [], usados: new Set(), divergencias: [], aceleracoesSemNovaEntrada: [], cartoesPeloExtrato: [],
    confrontoMensalCartoes: [], ajustesMensaisCartoes: [], caixaPelaPlanilha: [] };
  const titulosAceitos = new Set();
  const linhasAceitas = new Set();
  const divergentesDiaCartoes = [];
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
    rows.forEach(r => linhasAceitas.add(r));
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
        // Divergencias nao sao rateadas: a entrada pertence a dona da conta e mantem o total diario do banco.
        const codigo = /boleto/.test(categoriaRecebimentoAlvorar(g.extrato[0].complemento)) ? '1783' : '1782';
        const m = g.extrato[0], empresa = codigoEmpresaAlvorar(m.conta);
        const valorPlanilha = soma(g.planilha)/100, valorExtrato = soma(g.extrato)/100;
        const fonte = {data:m.data,dataKey:dataKey(m.data),conta:m.conta,empresaBanco:empresa,centroCusto:empresa,
          valor:valorExtrato,origem:'cartoes',tipo:m.complemento,plano:'Cartoes pelo extrato',
          historico:`${g.extrato.length} recebimento(s) consolidado(s) pelo extrato`, adquirente:m.complemento,
          cartaoPeloExtratoAlvorar:true,codigoCartaoExtratoAlvorar:codigo,
          diferencaClientesAlvorar:arredondarMoeda(valorPlanilha-valorExtrato),codigoDiferencaClientesAlvorar:'2098'};
        aceitar([fonte],g.extrato);
        resultado.cartoesPeloExtrato.push({chave:key,origem:'cartoes',conta:g.extrato[0].conta,data:dataKey(g.extrato[0].data),
          planilha:valorPlanilha,extrato:valorExtrato,codigo,registros:g.planilha});
      } else divergentesDiaCartoes.push({ key, g });
    }
  });
  const registrarDivergenciaCartoes = (key, g) => resultado.divergencias.push({ chave: key, origem: 'cartoes',
    conta: (g.planilha[0] || g.extrato[0]).conta, data: dataKey((g.planilha[0] || g.extrato[0]).data),
    planilha: soma(g.planilha)/100, extrato: soma(g.extrato)/100 });
  // 16/11/2026 (somente ALVORAR): entradas de cartao que nao fecham no dia sao confrontadas pelo total
  // do mes, por conta + tipo de cartao. O rateio entre unidades continua pela planilha (numerarios);
  // a diferenca do mes vira AJUSTE CARTAO DIFERENCA na 2098, no ultimo dia do mes.
  const meses = new Map();
  divergentesDiaCartoes.forEach(({ key, g }) => {
    const [dia, conta, categoria, sinal] = JSON.parse(key);
    const mes = /^\d{2}\/\d{2}\/\d{4}$/.test(String(dia)) ? String(dia).slice(3) : '';
    if (sinal <= 0 || !mes) { registrarDivergenciaCartoes(key, g); return; }
    const chaveMes = JSON.stringify([mes, conta, categoria]);
    if (!meses.has(chaveMes)) meses.set(chaveMes, { mes, categoria, dias: [], planilha: [], extrato: [] });
    const m = meses.get(chaveMes);
    m.dias.push({ key, g });
    m.planilha.push(...g.planilha);
    m.extrato.push(...g.extrato);
  });
  meses.forEach(m => {
    if (!m.planilha.length || !m.extrato.length || !m.extrato.every(x => x.valor > 0)) {
      m.dias.forEach(({ key, g }) => registrarDivergenciaCartoes(key, g));
      return;
    }
    aceitar(m.planilha, m.extrato);
    const centavos = soma(m.extrato) - soma(m.planilha);
    const registro = { mes: m.mes, conta: m.extrato[0].conta, categoria: m.categoria,
      tipo: limparTextoECD(m.extrato[0].complemento || m.planilha[0].adquirente || ''),
      planilha: soma(m.planilha)/100, extrato: soma(m.extrato)/100, diferenca: centavos/100,
      data: ultimoDiaMesAlvorar(m.mes), dias: m.dias.length };
    resultado.confrontoMensalCartoes.push(registro);
    if (centavos) resultado.ajustesMensaisCartoes.push(registro);
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
  // 16/11/2026 (somente ALVORAR): CAIXA segue a planilha de recebimentos, na data de cada venda
  // (acumulada por dia, unidade e tipo), com ou sem extrato do caixa. As entradas de titulos do extrato
  // do caixa nao sao lancadas de novo: servem so de confronto. Depositos/transferencias do caixa seguem o extrato.
  const ehCaixa = r => tipoContaAlvorar(r.conta) === 'Caixa';
  const semConciliacaoCaixa = caixasSemConciliacaoAlvorar();
  const linhasCaixa = recebimentosAlvorarTemp.filter(r => ehCaixa(r) && !linhasAceitas.has(r) && !titulosAceitos.has(r)
    && !desconsiderarCaixaNaoConciliadoAlvorar(r.conta, r.statusF360, semConciliacaoCaixa)
    && /^\d{2}\/\d{2}\/\d{4}$/.test(String(r.dataKey)));
  const contasCaixaPlanilha = new Set(recebimentosAlvorarTemp.filter(ehCaixa).map(r => contaNormalizadaAlvorar(r.conta)));
  resultado.divergencias = resultado.divergencias.filter(d => !(ehCaixa(d) && contasCaixaPlanilha.has(contaNormalizadaAlvorar(d.conta))));
  const resumoCaixa = new Map();
  const somarResumoCaixa = (conta, dataRef, campo, valor) => {
    const mes = String(dataRef).slice(3), chaveCaixa = JSON.stringify([mes, contaNormalizadaAlvorar(conta)]);
    if (!resumoCaixa.has(chaveCaixa)) resumoCaixa.set(chaveCaixa, { mes, conta, data: 'na data de cada venda', valor: 0, linhas: 0, extrato: 0 });
    const resumo = resumoCaixa.get(chaveCaixa);
    resumo[campo] = arredondarMoeda(resumo[campo] + valor);
    if (campo === 'valor') resumo.linhas++;
  };
  recebimentosAlvorarTemp.filter(ehCaixa).forEach(r => somarResumoCaixa(r.conta, r.dataKey, 'valor', r.valor));
  if (linhasCaixa.length) {
    aceitar(linhasCaixa.map(r => ({ ...r, caixaPelaPlanilhaAlvorar: true })), []);
    linhasCaixa.forEach(r => linhasAceitas.add(r));
  }
  entradas.filter(m => m.valor > 0 && ehCaixa(m) && normalizarTexto(m.tipoConciliacao) === 'parcelas de titulos'
    && contasCaixaPlanilha.has(contaNormalizadaAlvorar(m.conta))).forEach(m => {
      if (!resultado.usados.has(m)) somarResumoCaixa(m.conta, dataKey(m.data), 'extrato', m.valor);
      resultado.usados.add(m);
    });
  resultado.caixaPelaPlanilha.push(...resumoCaixa.values());
  // 16/11/2026 (somente ALVORAR): caixa SEM planilha RECEBIDAS CX. As entradas de titulos do extrato do caixa
  // vao para Clientes (2098), acumuladas por dia, em vez de virar uma pendencia por historico.
  const entradasCaixaSemPlanilha = entradas.filter(m => m.valor > 0 && ehCaixa(m)
    && normalizarTexto(m.tipoConciliacao) === 'parcelas de titulos'
    && !contasCaixaPlanilha.has(contaNormalizadaAlvorar(m.conta)) && !resultado.usados.has(m)
    && codigoEmpresaContaAlvorar(m.conta));
  entradasCaixaSemPlanilha.forEach(m => {
    const codigo = codigoEmpresaContaAlvorar(m.conta);
    aceitar([{ data: m.data, dataKey: dataKey(m.data), conta: m.conta, empresaBanco: codigo, centroCusto: codigo, valor: m.valor,
      origem: 'titulos', fornecedor: 'VENDAS DINHEIRO', plano: 'Vendas de Mercadorias',
      tipo: 'Recebimento no caixa (sem planilha RECEBIDAS CX)', historico: 'Recebimento no caixa sem planilha',
      caixaSemPlanilhaAlvorar: true }], [m]);
  });
  resultado.caixaSemPlanilha = entradasCaixaSemPlanilha.length;
  resultado.itens = consolidarRecebimentosAlvorarPorDia(resultado.itens);
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
    // 16/11/2026: deixa de travar. Os grupos nao confirmados NAO sao rateados (sem aproximacao):
    // a entrada do banco sai pela empresa dona da conta e, sem regra, com a contrapartida em branco.
    const seguir = confirm(`${conferencia.pendentes.length || 'Ha'} grupo(s) de recebimentos sem titularidade/valor confirmado com o extrato.${ausentes.length ? '\n\nExtratos ausentes ('+ausentes.length+'): '+ausentes.join(', ')+'.' : ''}\n\nOK = exportar mesmo assim. Esses recebimentos NAO serao rateados entre as unidades: o que esta no extrato sai pela empresa dona da conta, e o que nao tiver conta sai com a conta EM BRANCO para preencher depois. Caixas seguem a planilha de recebimentos e de pagamentos, na data de cada movimento; o extrato do caixa serve so de confronto (depositos seguem o extrato). Entradas de cartao que nao fecham no dia sao confrontadas pelo mes, e a diferenca vai para AJUSTE CARTAO DIFERENCA (2098).\n\nCancelar = voltar e exportar a conferencia para revisar.`);
    return !seguir;
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
    ${r.cartoesPeloExtrato?.length ? `<span>Cartoes pelo valor do extrato: ${r.cartoesPeloExtrato.length} grupos; diferencas identificadas como ajuste para Clientes (2098).</span>` : ''}
    ${faltas.indices.size ? `<span>Faltas ja refletidas na entrada liquida: ${faltas.indices.size} / R$ ${fmtValor(totalFaltas)}. Sem nova saida de caixa.</span>` : ''}
    <button class="btn btn-sm" onclick="exportarConferenciaRecebimentosAlvorar()">Exportar conferencia</button></div>`;
}

function criarConferenciaRecebimentosAlvorar() {
  const conferencia = conferenciaDivergenciasRecebimentosAlvorar();
  const rows = [...conferencia.pendentes.map(r=>({...r,situacao:'Pendente'})),
    ...conferencia.classificadas.map(r=>({...r,situacao:'Saida ja classificada'})),
    ...(cacheRecebimentosAlvorar?.resultado?.cartoesPeloExtrato || []).map(r=>({...r,situacao:'Valor do extrato; diferenca para Clientes (2098)'}))];
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
  const mensal = cacheRecebimentosAlvorar?.resultado?.confrontoMensalCartoes || [];
  if (mensal.length) {
    const dados = [['Mes','Conta','Tipo de cartao','Dias sem fechar','Planilha','Extrato','Diferenca (extrato - planilha)','Ajuste 2098','Data do ajuste'],
      ...mensal.map(m=>[m.mes,rotuloContaFinanceiraAlvorar(m.conta),m.tipo || m.categoria,m.dias,m.planilha,m.extrato,m.diferenca,
        m.diferenca ? 'AJUSTE CARTAO DIFERENCA' : 'Fecha no mes',m.diferenca ? m.data : ''])];
    const ws2 = XLSX.utils.aoa_to_sheet(dados);
    ws2['!cols']=[12,45,30,16,20,20,26,26,16].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,ws2,'Confronto mensal cartoes');
  }
  const caixas = cacheRecebimentosAlvorar?.resultado?.caixaPelaPlanilha || [];
  if (caixas.length) {
    const dados = [['Mes','Conta caixa','Linhas da planilha','Recebimentos pela planilha','Entradas no extrato do caixa (nao conciliadas)','Data do lancamento'],
      ...caixas.map(c=>[c.mes,rotuloContaFinanceiraAlvorar(c.conta),c.linhas,c.valor,c.extrato || 0,c.data])];
    const ws3 = XLSX.utils.aoa_to_sheet(dados);
    ws3['!cols']=[12,45,18,20,18].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,ws3,'Caixas pela planilha');
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

// 16/11/2026 (somente ALVORAR): deposito que chegou no banco vindo de uma caixa SEM extrato de caixa.
// A baixa da caixa (D 51531 / C caixa, ou 597/611 entre filial e matriz) e gerada pelo proprio deposito do banco.
function depositosCaixaSemExtratoAlvorar() {
  if (modoImportacaoDoGrupo() !== 'alvorar') return { gerados: [], semCaixa: [] };
  const contasComExtrato = new Set(extratoBancarioTemp.map(m => contaNormalizadaAlvorar(m.conta)));
  // So caixas com movimento nas planilhas do mes (vendas ou pagamentos): evita baixar de novo um deposito
  // cuja saida da caixa ja ocorreu no mes anterior.
  const contasCaixaPlanilhas = new Set([
    ...recebimentosAlvorarTemp.filter(r => tipoContaAlvorar(r.conta) === 'Caixa').map(r => contaNormalizadaAlvorar(r.conta)),
    ...linhasImportadas.filter(row => tipoContaAlvorar(row?.[COLS.CONTA]) === 'Caixa').map(row => contaNormalizadaAlvorar(row[COLS.CONTA]))]);
  const gerados = [], semCaixa = [];
  movimentosTransitoParcelas().forEach(deposito => {
    const { mov, outraConta } = deposito;
    if (!(mov.valor > 0) || tipoContaAlvorar(mov.conta) !== 'Banco') return;
    if (!outraConta || tipoContaAlvorar(outraConta) !== 'Caixa') { semCaixa.push({ mov, motivo: 'Caixa de origem nao identificada' }); return; }
    if (contasComExtrato.has(contaNormalizadaAlvorar(outraConta))) return;
    if (!contasCaixaPlanilhas.has(contaNormalizadaAlvorar(outraConta))) { semCaixa.push({ mov, motivo: 'Caixa ' + outraConta + ' sem extrato e sem movimento nas planilhas do mes' }); return; }
    const espelho = { mov: { ...mov, conta: outraConta, valor: -Math.abs(mov.valor), historico: mov.conta, baixaPeloBancoAlvorar: true }, outraConta: mov.conta };
    const titular = titularidadeDepositoCaixaAlvorar(espelho);
    if (titular.pendente) { semCaixa.push({ mov, motivo: 'Empresa da caixa ' + outraConta + ' nao identificada' }); return; }
    gerados.push(espelho);
  });
  return { gerados, semCaixa };
}

function montarLinhasDepositosCaixaBaseAlvorar() {
  const semExtrato = depositosCaixaSemExtratoAlvorar().gerados;
  return [...movimentosTransitoParcelas().values(), ...semExtrato].flatMap(deposito => {
    const {mov, outraConta} = deposito;
    const data = fmtDate(mov.data), valor = Math.abs(mov.valor);
    const conta = codigoBancoConciliacao(mov.conta);
    const historico = mov.baixaPeloBancoAlvorar
      ? `Deposito em transito (baixa da caixa pelo deposito no banco; caixa sem extrato) - ${mov.conta} / ${outraConta} - ${descricaoMovimentoExtrato(mov)}`
      : `Deposito em transito - ${mov.conta} / ${outraConta} - ${descricaoMovimentoExtrato(mov)}`;
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

// Quando o banco recebeu mais depositos do que os caixas identificados baixaram, a diferenca fica
// credora na 51531. Se houver uma unica caixa sem extrato dentro da mesma familia, a diferenca e a
// baixa dessa caixa. Mais de uma candidata permanece pendente para nao atribuir valores por chute.
function baixasResiduaisCaixaSemExtratoAlvorar(linhasBase = []) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return { gerados: [], pendentes: [] };
  const centavos = v => Math.round(Math.abs(Number(v) || 0) * 100);
  const saldos51531 = new Map();
  linhasBase.forEach(l => {
    const empresa = String(l[7] || '');
    if (!empresa) return;
    const atual = saldos51531.get(empresa) || 0;
    if (String(l[1]) === '51531') saldos51531.set(empresa, atual + centavos(l[3]));
    else if (String(l[2]) === '51531') saldos51531.set(empresa, atual - centavos(l[3]));
  });
  const ausentes = contasRecebimentosSemExtratoAlvorar().filter(conta => tipoContaAlvorar(conta) === 'Caixa');
  const gerados = [], pendentes = [];
  saldos51531.forEach((saldo, destino) => {
    if (saldo >= 0) return;
    const familia = familiaEmpresaAlvorar(destino);
    const candidatas = ausentes.filter(conta => familiaEmpresaAlvorar(codigoEmpresaAlvorar(conta)) === familia);
    const valor = arredondarMoeda(-saldo / 100);
    if (!familia || candidatas.length !== 1) {
      pendentes.push({ familia: familia || destino, valor,
        motivo: candidatas.length ? `${candidatas.length} caixas sem extrato; selecione a origem` : 'Caixa de origem nao identificada' });
      return;
    }
    const conta = candidatas[0], origem = codigoEmpresaAlvorar(conta);
    const movimentosConta = recebimentosAlvorarTemp.filter(r => contaNormalizadaAlvorar(r.conta) === contaNormalizadaAlvorar(conta));
    const disponivel = arredondarMoeda(movimentosConta.reduce((s, r) => s + Math.max(0, Number(r.valor) || 0), 0));
    const meses = [...new Set(movimentosConta.map(r => String(r.dataKey || dataKey(r.data)).slice(3)).filter(m => /^\d{2}\/\d{4}$/.test(m)))];
    if (!origem || valor > disponivel + 0.01 || meses.length !== 1) {
      pendentes.push({ familia, valor, motivo: !origem ? `Empresa da caixa ${conta} nao identificada`
        : valor > disponivel + 0.01 ? `Saldo 51531 maior que as entradas da caixa ${conta}` : `Mes da caixa ${conta} nao identificado` });
      return;
    }
    const data = ultimoDiaMesAlvorar(meses[0]);
    const historico = `Baixa residual de caixa sem extrato - saldo 51531 - ${conta} - ${familia}`;
    let linhas;
    if (origem === destino) {
      linhas = [linhaDominio(data, '51531', codigoBancoConciliacao(conta), valor, historico, origem, 'PROPRIO')];
    } else {
      linhas = [
        linhaDominio(data, CONTAS_CORRENTES_ALVORAR.transferencias.ATIVO, codigoBancoConciliacao(conta), valor,
          `Transferencia de caixa origem ${origem} destino ${destino} - ${historico}`, origem, 'TRANSFERENCIA DE NUMERARIOS'),
        linhaDominio(data, '51531', CONTAS_CORRENTES_ALVORAR.transferencias.PASSIVO, valor,
          `Transferencia de caixa origem ${origem} destino ${destino} - ${historico}`, destino, 'TRANSFERENCIA DE NUMERARIOS')
      ];
    }
    const id = `${familia}|${origem}|${destino}|${meses[0]}|${valor}`;
    linhas.forEach(l => { l.tipoExtratoAlvorar = 'Caixa'; l.baixaResidualCaixaAlvorar = id; });
    gerados.push({ familia, conta, origem, destino, data, valor, linhas });
  });
  return { gerados, pendentes };
}

function montarDepositosCaixaAlvorar() {
  const linhasBase = montarLinhasDepositosCaixaBaseAlvorar();
  const residuais = baixasResiduaisCaixaSemExtratoAlvorar(linhasBase);
  return [...linhasBase, ...residuais.gerados.flatMap(r => r.linhas)];
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

// Alternativa de importacao integral: um arquivo por familia/matriz, reunindo pagamentos,
// recebimentos e transferencias. Nao entra nas conferencias para nao duplicar os movimentos.
function consolidarExportacaoFinalPorMatrizAlvorar(linhas) {
  const arquivos = new Map();
  linhas.forEach(linha => {
    const familia = familiaEmpresaAlvorar(linha[7]);
    if (!familia) throw new Error(`Estabelecimento nao permitido na Importacao Final: ${linha[7]}`);
    const caminho = `Importacao Final/${familia}.xlsx`;
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
  const quadroPares = pares.length ? `<details class="conciliacao-diff-details" style="margin-top:10px" data-conferencia-pares-caixa-alvorar><summary>Ver transferências de caixa por par filial/matriz (597 x 611)</summary><div class="table-wrap"><table style="min-width:800px"><thead><tr><th>Filial de origem</th><th>Matriz destinataria</th><th>Saidas</th><th>D 597</th><th>C 611</th><th>Diferenca</th><th>Status</th></tr></thead><tbody>${pares.map(p=>`<tr><td>${escapeHtml(rotuloUnidadeAlvorar(p.origem || 'Pendente'))}</td><td>${escapeHtml(rotuloUnidadeAlvorar(p.destino || 'Pendente'))}</td><td>${p.saidas}</td><td class="col-value">${moeda(p.valores[0])}</td><td class="col-value">${moeda(p.valores[3])}</td><td class="col-value">${moeda(p.diferencaDebitos)}</td><td>${p.bate?'Conferido':'Revisar'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<section class="conciliacao-check-alert" style="margin-top:14px" data-conferencia-contas-correntes-alvorar>
    <div class="conciliacao-check-head"><div><strong>Conferencia de numerarios, emprestimos e transferencias</strong><span>${escapeHtml(escopo)}</span></div></div>
    <div class="table-wrap"><table style="min-width:1050px"><thead><tr><th>Natureza</th><th>Ativo / Passivo</th><th class="col-value">D ativo</th><th class="col-value">C passivo</th><th class="col-value">Diferenca</th><th class="col-value">C ativo</th><th class="col-value">D passivo</th><th class="col-value">Diferenca</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table></div>
    ${detalhes ? `<details class="conciliacao-diff-details" style="margin-top:10px"><summary>Ver saldos do movimento por empresa</summary><div class="table-wrap"><table><thead><tr><th>Natureza</th><th>Empresa / filial</th><th>Ativo / Passivo</th><th>Saldo devedor ativo</th><th>Saldo credor passivo</th></tr></thead><tbody>${detalhes}</tbody></table></div></details>` : ''}
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
  // Caixa segue a planilha: diferenca de caixa com o extrato e apenas informativa.
  return conferirParcelasPorContaDia(linhas, true).filter(d => tipoContaAlvorar(d.conta) !== 'Caixa' && (d.entradaDominio !== 0
    || d.saidaDominio !== (esperados.get(JSON.stringify([normalizarTexto(d.conta), d.data])) || 0)));
}

function montarExportacaoPagamentosAlvorar() {
  if (!extratoBancarioTemp.length) {
    alert('Importe os extratos para exportar os pagamentos conciliados da ALVORAR.');
    return null;
  }
  gerarSugestoesConciliacao({ redirecionarSeOk: false });
  const semVinculo = sugestoesParcelasExtratoTemp.filter(s => !s.mov && !tituloCaixaPelaPlanilhaAlvorar(s)
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
  // 16/11/2026: como no Dominio final, contas ainda nao preenchidas (titulo, banco ou numerario)
  // saem em branco, com confirmacao e listadas na planilha "Contas a preencher" do ZIP.
  linhas.filter(l => !l[1] || !l[2]).forEach(l => { l.contaPendenteTituloAlvorar = true; });
  const semEmpresa = [...new Set(linhas.filter(l => !codigoEmpresaAlvorar(l[7])).map(l => String(l[7] || '(vazio)')))];
  if (semEmpresa.length) {
    alert(`Exportacao interrompida: ${semEmpresa.length} empresa(s) sem codigo da ALVORAR identificado: ${semEmpresa.slice(0, 8).join(', ')}. Confira em "Empresa das contas".`);
    return null;
  }
  if (bloquearExportacaoPorEmpresaMatrizFilial(linhas)) return null;
  const diferencas = conferirSaidasExportacaoPagamentosAlvorar(linhas, avulsas);
  if (diferencas.length) {
    alert(`Exportacao interrompida: ${diferencas.length} diferenca(s) nas saidas dos pagamentos por conta/dia.`);
    return null;
  }
  if (!confirmarExportacaoTitulosSemContaAlvorar(linhas)) return null;
  return linhas;
}

// Durante a montagem da exportacao, guarda as mensagens de aviso para mostrar o motivo na janela
// (mesmo que o navegador esteja bloqueando as caixas de aviso deste site).
function montarComAvisosAlvorar(montar) {
  const alertOrig = window.alert, confirmOrig = window.confirm;
  const avisos = [];
  let bloqueado = false;
  window.alert = msg => { avisos.push(String(msg)); const t = performance.now(); alertOrig.call(window, msg); if (performance.now() - t < 3) bloqueado = true; };
  window.confirm = msg => { const t = performance.now(); const ok = confirmOrig.call(window, msg); if (!ok && performance.now() - t < 3) { bloqueado = true; avisos.push(String(msg)); } return ok; };
  try { return { linhas: montar(), avisos, bloqueado }; }
  finally { window.alert = alertOrig; window.confirm = confirmOrig; }
}

function motivoInterrupcaoAlvorar({ avisos, bloqueado }) {
  if (bloqueado) return 'O navegador está bloqueando as caixas de confirmação deste site, então a exportação foi cancelada automaticamente. Aperte F5 para recarregar a página (isso libera as caixas) e exporte de novo.'
    + (avisos.length ? `\n\nÚltimo aviso: ${avisos.at(-1)}` : '');
  return avisos.length ? avisos.at(-1) : '';
}

async function exportarPagamentosAlvorar() {
  if (!abrirProgressoExportacaoAlvorar('Gerando somente pagamentos (.zip)')) return;
  etapaProgressoExportacaoAlvorar(8, 'Conferindo pagamentos com o extrato...');
  await aguardarPinturaInterface();
  let resultado;
  try { resultado = montarComAvisosAlvorar(() => montarExportacaoPagamentosAlvorar()); }
  catch (err) { return erroProgressoExportacaoAlvorar('Erro ao montar os lancamentos: ' + err.message); }
  const linhas = resultado.linhas;
  if (!linhas) {
    // Se o modal de pendencias abriu, so fecha a janela; senao mostra o motivo, nunca some sem explicar.
    const pendenciasAbertas = !!document.getElementById('modal-pendencias-conciliacao');
    const motivo = motivoInterrupcaoAlvorar(resultado);
    if (motivo && (!pendenciasAbertas || resultado.bloqueado)) return erroProgressoExportacaoAlvorar('Exportação interrompida.\n' + motivo);
    if (!pendenciasAbertas && !motivo) return erroProgressoExportacaoAlvorar('Exportação interrompida sem mensagem. Abra as pendências e confira se há contas ou vínculos faltando.');
    return fecharProgressoExportacaoAlvorar();
  }
  return exportarZipAlvorar(linhas, { somentePagamentos: true });
}

// ---- Janela flutuante de progresso da exportacao (16/11/2026) ----
// Mostra em que etapa a geracao esta, para saber se esta carregando ou se travou.
let progressoExportacaoAlvorar = null;

function abrirProgressoExportacaoAlvorar(titulo, tipo = 'exportacao') {
  // So bloqueia um segundo clique de EXPORTACAO em andamento; janela de importacao nunca trava a exportacao.
  if (progressoExportacaoAlvorar?.ativo && tipo === 'exportacao' && progressoExportacaoAlvorar.tipo === 'exportacao') return false;
  let el = document.getElementById('progresso-exportacao-alvorar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'progresso-exportacao-alvorar';
    el.innerHTML = `<div class="pea-card" role="dialog" aria-live="polite">
      <div class="pea-topo"><span class="pea-spinner"></span><h3 class="pea-titulo"></h3></div>
      <div class="pea-etapa"></div>
      <div class="pea-trilho"><div class="pea-barra"></div></div>
      <div class="pea-rodape"><span class="pea-pct">0%</span><span class="pea-tempo">0s</span></div>
      <div class="pea-detalhe"></div>
      <button type="button" class="btn pea-fechar" onclick="fecharProgressoExportacaoAlvorar()">Fechar</button>
    </div>`;
    document.body.appendChild(el);
  }
  el.className = '';
  el.querySelector('.pea-titulo').textContent = titulo;
  el.querySelector('.pea-detalhe').textContent = '';
  el.style.display = 'flex';
  const inicio = Date.now();
  clearInterval(progressoExportacaoAlvorar?.timer);
  progressoExportacaoAlvorar = { ativo: true, el, inicio, tipo, ultimaEtapa: Date.now(),
    timer: setInterval(() => {
      el.querySelector('.pea-tempo').textContent = `${Math.round((Date.now() - inicio) / 1000)}s`;
      // Seguranca: se ficar 20s sem nenhuma etapa nova, libera o botao Fechar para a janela nunca prender a tela.
      if (Date.now() - progressoExportacaoAlvorar.ultimaEtapa > 20000) el.classList.add('pea-lento');
    }, 500) };
  etapaProgressoExportacaoAlvorar(2, 'Preparando...');
  return true;
}

function etapaProgressoExportacaoAlvorar(percentual, etapa, detalhe = '') {
  const el = progressoExportacaoAlvorar?.el;
  if (!el) return;
  const p = Math.max(0, Math.min(100, Math.round(percentual)));
  progressoExportacaoAlvorar.ultimaEtapa = Date.now();
  el.classList.remove('pea-lento');
  el.querySelector('.pea-barra').style.width = `${p}%`;
  el.querySelector('.pea-pct').textContent = `${p}%`;
  el.querySelector('.pea-etapa').textContent = etapa;
  el.querySelector('.pea-detalhe').textContent = detalhe;
}

function concluirProgressoExportacaoAlvorar(nomeArquivo) {
  const el = progressoExportacaoAlvorar?.el;
  if (!el) return;
  clearInterval(progressoExportacaoAlvorar.timer);
  progressoExportacaoAlvorar.ativo = false;
  etapaProgressoExportacaoAlvorar(100, 'Arquivo gerado. Download iniciado.',
    `${nomeArquivo}\nSe o download não apareceu, confira a barra de downloads do navegador.`);
  el.className = 'pea-ok';
}

// Importacao: mesma janela; ao concluir fica verde e fecha sozinha (a tela seguinte ja abre).
function concluirProgressoImportacaoOverlay(mensagem) {
  const el = progressoExportacaoAlvorar?.el;
  if (!el || !progressoExportacaoAlvorar.ativo) return;
  clearInterval(progressoExportacaoAlvorar.timer);
  progressoExportacaoAlvorar.ativo = false;
  etapaProgressoExportacaoAlvorar(100, 'Importação concluída', mensagem);
  el.className = 'pea-ok';
  el.querySelector('.pea-fechar').style.display = 'none';
  setTimeout(() => { if (!progressoExportacaoAlvorar?.ativo) { el.style.display = 'none'; el.querySelector('.pea-fechar').style.display = ''; } }, 1600);
}

function erroProgressoExportacaoAlvorar(mensagem) {
  const el = progressoExportacaoAlvorar?.el;
  if (!el) return alert(mensagem);
  clearInterval(progressoExportacaoAlvorar.timer);
  progressoExportacaoAlvorar.ativo = false;
  el.querySelector('.pea-etapa').textContent = 'Não foi possível gerar o arquivo.';
  el.querySelector('.pea-detalhe').textContent = mensagem;
  el.className = 'pea-erro';
}

function fecharProgressoExportacaoAlvorar() {
  if (!progressoExportacaoAlvorar) return;
  clearInterval(progressoExportacaoAlvorar.timer);
  progressoExportacaoAlvorar.ativo = false;
  progressoExportacaoAlvorar.el.style.display = 'none';
  progressoExportacaoAlvorar.el.classList.remove('pea-lento');
  if (typeof progressoImportacaoAtivo !== 'undefined') progressoImportacaoAtivo = false;
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
  return confirm(`${pendentes.length} linha(s) ainda sem conta contabil (titulos, recebimentos ou saidas do extrato). Exportar com essas contas em branco para preenchimento posterior? Os movimentos e valores serao mantidos. Preencha as contas antes de importar no Dominio. A lista estara na aba Contas pendentes de Conferencia_ALVORAR.xlsx.`);
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
  const conciliacao = montarLinhasDominioConciliacao({ permitirContasEmBrancoAlvorar: true });
  if (conciliacao === null) return null;
  const recebimentos = marcarMovimentoExportacaoAlvorar(montarLinhasRecebimentosImportadosParaFinal(), 'Recebimentos');
  const linhas = [...pagamentos, ...conciliacao, ...recebimentos];
  if (!linhas.length) { alert('Nenhum lancamento conciliado para exportar.'); return null; }
  // 16/11/2026: como nos pagamentos, contas ainda nao preenchidas (titulo, banco, numerario ou recebimento)
  // saem em branco, com confirmacao e listadas na aba "Contas pendentes" do ZIP.
  linhas.filter(l => !l[1] || !l[2]).forEach(l => { l.contaPendenteTituloAlvorar = true; });
  if (!validarExportacaoParcelasExtrato(linhas) || bloquearExportacaoPorEmpresaMatrizFilial(linhas)) return null;
  linhas.push(...montarResgatesAutomaticosAlvorar(linhas));
  return linhas;
}

// 16/11/2026 (somente ALVORAR): o F360 trata a aplicacao automatica como parte da conta (Itau AutMais, CDB Bradesco),
// mas o Dominio separa em outra conta. Como o banco, faz POR DIA, por conta e empresa: dia com saida liquida ->
// RESGATE (D banco / C aplicacao automatica); dia com entrada liquida -> APLICACAO (D aplicacao / C banco).
// A conta corrente fica parada e nunca negativa; nao entra na conferencia contra o extrato.
const APLICACAO_AUTOMATICA_ALVORAR = Object.freeze([
  { banco: /\bitau\b/, conta: '2034', nome: 'Itau AutMais' },
  { banco: /\bbradesco\b/, conta: '51279', nome: 'CDB Bradesco' }
]);

function montarResgatesAutomaticosAlvorar(linhas) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return [];
  const dias = new Map();
  linhas.forEach(l => [1, 2].forEach(col => {
    const conta = String(l[col] || '').trim();
    const data = String(l[0] || '');
    if (!conta || /^\d+$/.test(conta) || tipoContaAlvorar(conta) !== 'Banco' || !/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return;
    const regra = APLICACAO_AUTOMATICA_ALVORAR.find(r => r.banco.test(normalizarTexto(conta)));
    const empresa = String(l[7] || '');
    if (!regra || !empresa) return;
    const chave = JSON.stringify([normalizarTexto(conta), empresa, data]);
    if (!dias.has(chave)) dias.set(chave, { conta, empresa, data, regra, centavos: 0 });
    dias.get(chave).centavos += (col === 1 ? 1 : -1) * Math.round(Number(l[3] || 0) * 100);
  }));
  const ordenar = d => d.split('/').reverse().join('');
  const movimentos = [];
  [...dias.values()].sort((a, b) => ordenar(a.data).localeCompare(ordenar(b.data))).forEach(d => {
    if (!d.centavos) return;
    const valor = Math.abs(d.centavos) / 100;
    const resgate = d.centavos < 0;
    const linha = resgate
      ? linhaDominio(d.data, d.conta, d.regra.conta, valor, `Resgate automatico ${d.regra.nome} - ${d.conta}`, d.empresa, 'PROPRIO')
      : linhaDominio(d.data, d.regra.conta, d.conta, valor, `Aplicacao automatica ${d.regra.nome} - ${d.conta}`, d.empresa, 'PROPRIO');
    linha.tipoExtratoAlvorar = 'Banco';
    linha.movimentoExportacaoAlvorar = 'Transferencias';
    linha.resgateAutomaticoAlvorar = true;
    movimentos.push(linha);
  });
  return movimentos;
}

async function exportarDominioFinalAlvorar() {
  if (!abrirProgressoExportacaoAlvorar('Gerando Domínio final (.zip)')) return;
  etapaProgressoExportacaoAlvorar(8, 'Conferindo extratos, recebimentos e pendências...');
  await aguardarPinturaInterface();
  let resultado;
  try { resultado = montarComAvisosAlvorar(() => montarExportacaoFinalAlvorar()); }
  catch (err) { return erroProgressoExportacaoAlvorar('Erro ao montar os lancamentos: ' + err.message); }
  const linhas = resultado.linhas;
  if (!linhas) {
    // Se o modal de pendencias abriu, so fecha a janela; senao mostra o motivo, nunca some sem explicar.
    const pendenciasAbertas = !!document.getElementById('modal-pendencias-conciliacao');
    const motivo = motivoInterrupcaoAlvorar(resultado);
    if (motivo && (!pendenciasAbertas || resultado.bloqueado)) return erroProgressoExportacaoAlvorar('Exportação interrompida.\n' + motivo);
    if (!pendenciasAbertas && !motivo) return erroProgressoExportacaoAlvorar('Exportação interrompida sem mensagem. Abra as pendências e confira se há contas ou vínculos faltando.');
    return fecharProgressoExportacaoAlvorar();
  }
  return exportarZipAlvorar(linhas, { separarMovimentos: true });
}

function nomeContaConferenciaAlvorar(valor) {
  const codigo = String(valor ?? '').trim();
  if (!codigo) return '';
  const conta = encontrarContaPorValor(codigo);
  if (conta?.nome) return conta.nome;
  const fixas = {
    '51540': 'Transferência entre Contas', '51541': 'UME - Créditos à vista',
    '604': 'Conta corrente - Numerários', '618': 'Conta corrente - Numerários',
    '597': 'Conta Corrente - Transferencia (ativo)', '611': 'Conta Corrente - Transferencia (passivo)',
    '1924': 'Conta corrente - Clientes', '1931': 'Conta corrente - Clientes',
    '1768': 'Empréstimos entre unidades - Ativo', '1775': 'Empréstimos entre unidades - Passivo',
    '51531': 'Caixa - Depósitos em trânsito'
  };
  return fixas[codigo] || (/^\d+$/.test(codigo) ? 'Conta não localizada no plano de contas' : codigo);
}

function adicionarConferenciaContasAlvorar(wb, linhas, { nome = 'Conferencia - nao importar', origens = null } = {}) {
  const cabecalho = [CABECALHO_DOMINIO[0], CABECALHO_DOMINIO[1], 'Nome Conta Débito',
    CABECALHO_DOMINIO[2], 'Nome Conta Crédito', ...CABECALHO_DOMINIO.slice(3)];
  const dados = linhas.map(l => [l[0], l[1], nomeContaConferenciaAlvorar(l[1]),
    l[2], nomeContaConferenciaAlvorar(l[2]), ...l.slice(3,7), rotuloUnidadeAlvorar(l[7]), ...l.slice(8)]);
  const ws = XLSX.utils.aoa_to_sheet(origens
    ? [['Arquivo de lancamentos', ...cabecalho], ...dados.map((r,i) => [origens[i], ...r])]
    : [cabecalho, ...dados]);
  ws['!cols'] = [...(origens ? [52] : []),12,18,42,18,42,18,18,65,14,36,22,22,24].map(wch => ({ wch }));
  ws['!autofilter'] = { ref: `A1:${origens ? 'N' : 'M'}${dados.length + 1}` };
  dados.forEach((_, idx) => { const cell = ws[`${origens ? 'G' : 'F'}${idx + 2}`]; if (cell) cell.z = '#,##0.00'; });
  XLSX.utils.book_append_sheet(wb, ws, nome);
}

// Resumo da conferencia (16/11/2026): entradas e saidas por tipo de conta (Banco, Caixa, Aplicacoes) e por
// movimento (Pagamentos, Recebimentos, Transferencias). Conta financeira = conta exportada pelo NOME
// (o analista troca pelo codigo) ou aplicacao automatica (2034 AutMais / 51279 CDB).
function tipoContaFinanceiraResumoAlvorar(conta) {
  const c = String(conta || '').trim();
  if (!c) return '';
  if (/^\d+$/.test(c)) return APLICACAO_AUTOMATICA_ALVORAR.some(r => r.conta === c) ? 'Aplicacoes' : '';
  return normalizarTexto(c).includes('tesouraria') ? 'Caixa' : tipoContaAlvorar(c);
}

function quadroResumoMovimentosAlvorar(linhas, dias) {
  const tipos = ['Banco','Caixa','Aplicacoes'], movs = ['Pagamentos','Recebimentos','Transferencias'];
  const tot = new Map(), chave = (t, m) => `${t}|${m}`;
  const somar = (t, m, campo, v) => { const k = chave(t, m); if (!tot.has(k)) tot.set(k, { e: 0, s: 0 }); tot.get(k)[campo] += v; };
  linhas.forEach(l => {
    const v = Math.round(Number(l[3] || 0) * 100), m = movs.includes(l.movimentoExportacaoAlvorar) ? l.movimentoExportacaoAlvorar : 'Outros';
    const td = tipoContaFinanceiraResumoAlvorar(l[1]), tc = tipoContaFinanceiraResumoAlvorar(l[2]);
    if (td) somar(td, m, 'e', v);
    if (tc) somar(tc, m, 's', v);
  });
  const rows = [[], ['MOVIMENTO DO ARQUIVO POR TIPO DE CONTA'], ['Tipo de conta','Movimento','Entradas','Saidas','Liquido (entradas - saidas)']];
  let ge = 0, gs = 0;
  tipos.forEach(t => {
    let te = 0, ts = 0;
    [...movs, 'Outros'].forEach(m => {
      const x = tot.get(chave(t, m)); if (!x) return;
      te += x.e; ts += x.s;
      rows.push([t, m, x.e / 100, x.s / 100, (x.e - x.s) / 100]);
    });
    if (te || ts) rows.push([`Total ${t}`, '', te / 100, ts / 100, (te - ts) / 100]);
    ge += te; gs += ts;
  });
  rows.push(['TOTAL GERAL', '', ge / 100, gs / 100, (ge - gs) / 100]);
  if (dias?.length) {
    rows.push([], ['ARQUIVO x EXTRATOS (sem resgate/aplicacao automatica)'],
      ['Tipo de conta','Entradas extrato','Entradas arquivo','Saidas extrato','Saidas arquivo','Situacao']);
    tipos.forEach(t => {
      const ds = dias.filter(d => tipoContaAlvorar(d.conta) === t); if (!ds.length) return;
      const s = k => ds.reduce((a, d) => a + (d[k] || 0), 0);
      const [ee, ed, se, sd] = ['entradaExtrato','entradaDominio','saidaExtrato','saidaDominio'].map(s);
      rows.push([t, ee / 100, ed / 100, se / 100, sd / 100, ee === ed && se === sd ? 'Confere'
        : t === 'Caixa' ? 'Caixa segue as planilhas (ver aba Fechamento)' : `Diferenca de R$ ${fmtValor((ed - sd - ee + se) / 100)}`]);
    });
  }
  return rows;
}

function criarConferenciaUnicaAlvorar(linhas, arquivos, { somentePagamentos = false, somenteRecebimentos = false } = {}) {
  const wb = XLSX.utils.book_new(), abas = [], usados = new Set(['Resumo']);
  const resumo = XLSX.utils.aoa_to_sheet([
    ['Conferencia ALVORAR'],
    ['Escopo', somentePagamentos ? 'Somente pagamentos' : somenteRecebimentos ? 'Somente recebimentos' : 'Arquivo final'],
    ['Uso', 'Somente conferencia. Nao importar este arquivo no Dominio.'],
    ['Contas dos titulos em branco', linhas.filter(l=>!l[1] || !l[2]).length],
    ['Observacao', somentePagamentos
      ? 'Nao inclui recebimentos nem transferencias dos extratos. O espelhamento completo entre empresas deve ser conferido no arquivo final.'
      : somenteRecebimentos
      ? 'Nao inclui pagamentos nem transferencias dos extratos. O fechamento completo do banco deve ser conferido no arquivo final.'
      : 'Inclui os lancamentos do conjunto exportado, sem duplicar pagamentos, recebimentos ou transferencias.'],
    [],['Aba','Conteudo','Linhas']
  ]);
  XLSX.utils.book_append_sheet(wb,resumo,'Resumo');
  let diasResumo = null;
  if(!somentePagamentos && !somenteRecebimentos && extratoBancarioTemp.length) {
    const dias = conferirParcelasPorContaDia(linhas,true);
    diasResumo = dias;
    const rows = [['Tipo','Unidade','Conta financeira','Data','Entradas extrato','Entradas arquivo','Dif. entradas',
      'Saidas extrato','Saidas arquivo','Dif. saidas','Dif. saldo','Situacao'],
      ...dias.map(d=>[tipoContaAlvorar(d.conta),rotuloUnidadeAlvorar(codigoEmpresaAlvorar(d.conta)),rotuloContaFinanceiraAlvorar(d.conta),d.data,
        d.entradaExtrato/100,d.entradaDominio/100,(d.entradaDominio-d.entradaExtrato)/100,
        d.saidaExtrato/100,d.saidaDominio/100,(d.saidaDominio-d.saidaExtrato)/100,
        (d.entradaDominio-d.saidaDominio-d.entradaExtrato+d.saidaExtrato)/100,
        d.entradaExtrato===d.entradaDominio && d.saidaExtrato===d.saidaDominio ? 'Movimentos conferem' : 'Diferenca'])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [18,36,55,16,22,22,22,22,22,22,22,26].map(wch=>({wch}));
    ws['!autofilter'] = {ref:`A1:L${rows.length}`};
    dias.forEach((_,i)=>{for(let c=4;c<=10;c++){const cell=ws[XLSX.utils.encode_cell({r:i+1,c})];if(cell)cell.z='#,##0.00';}});
    XLSX.utils.book_append_sheet(wb,ws,'Fechamento');
    usados.add('Fechamento');
    abas.push(['Fechamento','Entradas e saidas do arquivo versus extratos, por conta e dia.',dias.length]);
  }
  for (const tipo of ['Banco','Caixa','Aplicacoes']) {
    const dados = [], origens = [];
    arquivos.forEach((rows,caminho)=>{
      if(caminho.split('/').at(-2)!==tipo)return;
      rows.forEach(r=>{dados.push(r);origens.push(caminho);});
    });
    if(!dados.length)continue;
    adicionarConferenciaContasAlvorar(wb,dados,{nome:tipo,origens});
    usados.add(tipo);
    abas.push([tipo,'Lancamentos com nome das contas e identificacao das unidades; arquivo de origem na primeira coluna.',dados.length]);
  }
  const juntar = (origem, nomes, conteudos) => {
    origem.SheetNames.forEach(anterior=>{
      const nome = nomeAbaExcelSeguro(nomes[anterior] || anterior,usados);
      XLSX.utils.book_append_sheet(wb,origem.Sheets[anterior],nome);
      abas.push([nome,conteudos[anterior] || 'Detalhamento da conferencia.','']);
    });
  };
  const numerarios = XLSX.utils.book_new();
  adicionarConferenciaNumerariosAlvorar(numerarios,linhas);
  juntar(numerarios,{'Numerarios ALVORAR':'Numerarios','Conferencia por natureza':'Por natureza','Transferencias caixa - pares':'Caixa - pares'},
    {'Numerarios ALVORAR':'Movimentacao de contas correntes por unidade.','Conferencia por natureza':'Pagamentos, recebimentos, emprestimos e transferencias, com os espelhamentos.','Transferencias caixa - pares':'597/611 por filial e matriz.'});
  if(!somentePagamentos && cacheRecebimentosAlvorar?.resultado) {
    juntar(criarConferenciaRecebimentosAlvorar(),{'Divergencias':'Ajustes de recebimentos','Aceleracoes sem nova entrada':'Aceleracoes'},
      {'Divergencias':'Divergencias e ajustes identificados nos recebimentos.','Aceleracoes sem nova entrada':'Aceleracoes que nao geram nova entrada no banco.',
       'Confronto mensal cartoes':'Planilha x extrato pelo total do mes, por conta e tipo de cartao, com o AJUSTE CARTAO DIFERENCA (2098).',
       'Caixas pela planilha':'Caixas sem extrato lancadas pela planilha de recebimentos no ultimo dia do mes.'});
  }
  const pendentes = criarConferenciaContasPendentesTitulosAlvorar(linhas);
  if(pendentes)juntar(pendentes,{'Contas a preencher':'Contas pendentes'},
    {'Contas a preencher':'Contas dos titulos que devem ser preenchidas antes da importacao no Dominio.'});
  const quadro = quadroResumoMovimentosAlvorar(linhas, diasResumo);
  // Quadro logo apos o cabecalho (antes da lista de abas), para ser a primeira coisa vista.
  const cabecalhoResumo = XLSX.utils.sheet_to_json(resumo,{header:1,defval:''});
  const inicioQuadro = cabecalhoResumo.length - 2;
  const linhasResumo = [...cabecalhoResumo.slice(0, inicioQuadro),...quadro,...cabecalhoResumo.slice(inicioQuadro),...abas];
  const ws = XLSX.utils.aoa_to_sheet(linhasResumo);
  for (let r = inicioQuadro; r < inicioQuadro + quadro.length; r++) for (let c = 1; c <= 4; c++) {
    const cell = ws[XLSX.utils.encode_cell({r,c})]; if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
  }
  ws['!cols'] = [34,105,18,18,18,40].map(wch=>({wch}));
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:2}}];
  wb.Sheets.Resumo = ws;
  return wb;
}

// Somente recebimentos (16/11/2026): mesmas conferencias do Dominio final, exportando apenas os
// lancamentos de recebimentos, separados por Banco/Caixa/Aplicacoes e por familia (matriz e filiais).
function montarExportacaoRecebimentosAlvorar() {
  const linhas = montarExportacaoFinalAlvorar();
  if (!linhas) return null;
  const recebimentos = linhas.filter(l => l.movimentoExportacaoAlvorar === 'Recebimentos');
  if (!recebimentos.length) { alert('Nenhum recebimento conciliado para exportar.'); return null; }
  return recebimentos;
}

async function exportarRecebimentosAlvorar() {
  if (!abrirProgressoExportacaoAlvorar('Gerando somente recebimentos (.zip)')) return;
  etapaProgressoExportacaoAlvorar(8, 'Conferindo extratos, recebimentos e pendências...');
  await aguardarPinturaInterface();
  let resultado;
  try { resultado = montarComAvisosAlvorar(() => montarExportacaoRecebimentosAlvorar()); }
  catch (err) { return erroProgressoExportacaoAlvorar('Erro ao montar os lancamentos: ' + err.message); }
  const linhas = resultado.linhas;
  if (!linhas) {
    const pendenciasAbertas = !!document.getElementById('modal-pendencias-conciliacao');
    const motivo = motivoInterrupcaoAlvorar(resultado);
    if (motivo && (!pendenciasAbertas || resultado.bloqueado)) return erroProgressoExportacaoAlvorar('Exportação interrompida.\n' + motivo);
    if (!pendenciasAbertas && !motivo) return erroProgressoExportacaoAlvorar('Exportação interrompida sem mensagem. Abra as pendências e confira se há contas ou vínculos faltando.');
    return fecharProgressoExportacaoAlvorar();
  }
  return exportarZipAlvorar(linhas, { somenteRecebimentos: true });
}

async function exportarZipAlvorar(linhas, { somentePagamentos = false, somenteRecebimentos = false, separarMovimentos = false } = {}) {
  try {
    etapaProgressoExportacaoAlvorar(30, `Separando ${linhas.length.toLocaleString('pt-BR')} lançamentos por pasta e empresa...`);
    await aguardarPinturaInterface();
    const arquivos = particionarExportacaoAlvorar(linhas, { separarMovimentos });
    const consolidados = separarMovimentos ? consolidarExportacaoFinalPorMatrizAlvorar(linhas) : new Map();
    // Exportacao final: Pagamentos/Recebimentos/Transferencias ficam dentro de "Separado por tipo".
    const arquivosSeparados = separarMovimentos
      ? new Map([...arquivos].map(([caminho, dados]) => [`Separado por tipo/${caminho}`, dados])) : arquivos;
    const arquivosZip = new Map([...arquivosSeparados, ...consolidados]);
    const zip = XLSX.CFB.utils.cfb_new();
    let nArquivo = 0;
    for (const [caminho, dados] of arquivosZip) {
      nArquivo++;
      etapaProgressoExportacaoAlvorar(35 + 45 * nArquivo / Math.max(1, arquivosZip.size),
        `Gerando planilhas do Domínio (${nArquivo}/${arquivosZip.size})...`, caminho);
      const wb = XLSX.utils.book_new();
      dados[0][6] = 1;
      // Um unico conjunto importavel por arquivo; filiais permanecem no Codigo Matriz/Filial.
      adicionarAbaDominio(wb, 'Lancamentos Dominio', dados, new Set());
      XLSX.CFB.utils.cfb_add(zip, caminho, new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})));
      await aguardarPinturaInterface();
    }
    etapaProgressoExportacaoAlvorar(84, 'Montando Conferencia_ALVORAR.xlsx...');
    await aguardarPinturaInterface();
    const conferencia = criarConferenciaUnicaAlvorar(linhas,arquivosSeparados,{somentePagamentos,somenteRecebimentos});
    XLSX.CFB.utils.cfb_add(zip,'Conferencia_ALVORAR.xlsx',new Uint8Array(XLSX.write(conferencia,{type:'array',bookType:'xlsx'})));
    const pendenciasTitulos = conferencia.SheetNames.includes('Contas pendentes');
    const texto = somenteRecebimentos
      ? 'SOMENTE RECEBIMENTOS DA ALVORAR.\nContem as entradas dos extratos e da planilha de recebimentos: cartoes e titulos recebidos com o rateio por unidade (numerarios entre matriz e filiais), AJUSTE CARTAO DIFERENCA (2098) no ultimo dia do mes e caixas sem extrato lancadas pela planilha no ultimo dia do mes.\nNao contem pagamentos nem transferencias, aplicacoes, resgates ou depositos caixa/banco.\nBanco, Caixa e Aplicacoes indicam a origem do recebimento; cada familia agrupa matriz e filiais na coluna Codigo Matriz/Filial. Pastas sem recebimentos nao sao geradas.\nConferencia_ALVORAR.xlsx nao deve ser importado no Dominio. Este arquivo e parcial. Nao importar junto com a exportacao completa do mesmo periodo, para nao duplicar recebimentos.\n'
      : somentePagamentos
      ? 'SOMENTE PAGAMENTOS CONCILIADOS DA ALVORAR.\nContem titulos pagos vinculados aos extratos, com descontos, acrescimos e numerarios vinculados, e saidas avulsas do extrato com contrapartida preenchida, uma unica vez. Inclui ajustes negativos de cartoes que estejam classificados como saidas avulsas.\nNao contem entradas de recebimentos, depositos caixa/banco nem transferencias, aplicacoes ou resgates gerados pela conciliacao dos extratos. Saidas expressamente marcadas para nao exportar permanecem excluidas.\nBanco, Caixa e Aplicacoes indicam a origem do pagamento; cada familia agrupa matriz e filiais na coluna Codigo Matriz/Filial. Pastas sem pagamentos nao sao geradas.\nConferencia_ALVORAR.xlsx nao deve ser importado no Dominio. Este arquivo e parcial: nao representa o fechamento completo de entradas e saidas. Nao importar junto com a exportacao completa do mesmo periodo, para nao duplicar pagamentos.\n'
      : 'Depositos caixa/banco: saida D 51531 / C caixa na pasta Caixa; entrada D banco / C 51531 na pasta Banco. Cada ponta usa a data do proprio extrato, sem pareamento. O saldo em transito pode passar de um mes para outro.\nDemais transferencias: um unico lancamento. Banco tem prioridade sobre Caixa e Aplicacoes; Caixa tem prioridade sobre Aplicacoes.\nFiliais: coluna Codigo Matriz/Filial. Conferencia_ALVORAR.xlsx nao deve ser importado no Dominio.\nExcluir uma pasta nao remove as contrapartidas de transferencias diretas incluidas em outra. Confira o que ja foi importado pela analista antes de importar arquivos parciais.\n';
    XLSX.CFB.utils.cfb_add(zip,'LEIA-ME.txt',new TextEncoder().encode(texto
      + (pendenciasTitulos ? '\nATENCAO: existem contas de titulos em branco para preenchimento posterior. Os movimentos foram preservados, sem inventar contas. Consulte a aba Contas pendentes de Conferencia_ALVORAR.xlsx e preencha os arquivos de lancamentos antes de importar no Dominio. Fechamento financeiro conferido nao significa classificacao contabil completa.\n' : '')
      + (separarMovimentos ? '\nEXPORTACAO FINAL SEPARADA (pasta "Separado por tipo"): Pagamentos, Recebimentos e Transferencias. Dentro de cada pasta, Banco/Caixa/Aplicacoes e os arquivos de MNN, PCA, SERLOC e VALE, incluindo filiais. Transferencias proprias, aplicacoes/resgates e depositos em transito ficam somente em Transferencias. Numerarios e ajustes acompanham o pagamento ou recebimento que os originou. Pastas sem movimento nao sao geradas.\n\nIMPORTACAO FINAL: alternativa consolidada, com um arquivo por familia/matriz (MNN, PCA, SERLOC e VALE) reunindo todos os pagamentos, recebimentos e transferencias daquela familia. Importe OU a pasta Importacao Final OU as pastas separadas. Nunca importe os dois conjuntos, pois possuem os mesmos lancamentos e causariam duplicidade.\n' : '')
      + '\nConferencia_ALVORAR.xlsx: arquivo unico de revisao. Comece pela aba Resumo. Banco, Caixa e Aplicacoes reunem os lancamentos com nomes das contas e unidades, e o caminho do arquivo de origem. As demais abas detalham numerarios, espelhamentos, ajustes e contas pendentes quando existirem. Nao importar este arquivo no Dominio. Os arquivos de lancamentos mantem o layout original de importacao.\n'));
    etapaProgressoExportacaoAlvorar(93, 'Compactando o arquivo .zip...');
    await aguardarPinturaInterface();
    const blob = new Blob([XLSX.CFB.write(zip,{type:'array',fileType:'zip',compression:true})],{type:'application/zip'});
    const url = URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=`Dominio_ALVORAR_${somentePagamentos ? 'Somente_Pagamentos_' : somenteRecebimentos ? 'Somente_Recebimentos_' : separarMovimentos ? 'Final_Separado_' : ''}${new Date().toISOString().slice(0,10)}.zip`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    concluirProgressoExportacaoAlvorar(a.download);
  } catch (err) { erroProgressoExportacaoAlvorar('Nao foi possivel exportar ALVORAR: '+err.message); }
}

// ---- Ver os lancamentos do extrato de uma pendencia (16/11/2026) ----
// Na tela de pendencias, cada linha agrupada ganha o botao "Ver lancamentos do extrato",
// que abre uma janela com os movimentos que formam aquela pendencia (data, conta, historico, valor).
const itensPendenciaMovimentosAlvorar = new Map();

function movimentosDaPendenciaAlvorar(item = {}) {
  if (item.movimentos?.length) return item.movimentos;
  const mov = Number.isInteger(item.idxOriginal) ? extratoBancarioTemp[item.idxOriginal] : null;
  if (mov) return [mov];
  // Transferencia entre contas: as duas pontas do extrato.
  if (item.transferenciaContas) {
    return [item.idxSaidaTransferencia, item.idxEntradaTransferencia]
      .map(i => Number.isInteger(i) ? extratoBancarioTemp[i] : null).filter(Boolean);
  }
  // Numerarios de recebimentos: os recebimentos entre as mesmas empresas que geraram a conta de numerarios.
  if (item.movimento === 'numerario-rateio' && item.empresaBanco && item.centroCusto) {
    const mesmo = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
    return conciliacaoItensTemp.filter(i => i.rateioRecebimento && i.intercompany
      && mesmo(i.empresaBanco, item.empresaBanco) && mesmo(i.centroCusto, item.centroCusto))
      .flatMap(i => i.movimentos || []);
  }
  // Pagamento sem vinculo: nao ha movimento no extrato; mostra o titulo do F360.
  if (item.movimento === 'pagamento-pendente' && item.id) {
    const idx = Number(String(item.id).replace('pag-', ''));
    const row = linhasImportadas[idx];
    if (row) return [{ data: item.data || row[COLS.LIQUIDACAO], conta: row[COLS.CONTA], historico: item.plano || row[COLS.PLANO] || '',
      complemento: item.fornecedor || row[COLS.FORNECEDOR] || '', documento: item.numero || '', tipoConciliacao: 'Titulo do F360 (sem movimento no extrato)',
      valor: -Math.abs(Number(item.total || 0)) }];
  }
  return [];
}

function botaoMovimentosPendenciaAlvorar(item) {
  if (modoImportacaoDoGrupo() !== 'alvorar') return '';
  const movs = movimentosDaPendenciaAlvorar(item);
  if (!movs.length) return '';
  itensPendenciaMovimentosAlvorar.set(String(item.id), item);
  return `<button type="button" class="pendencia-ver-movimentos" data-item-id="${escapeAttr(item.id)}"
    onclick="abrirMovimentosPendenciaAlvorar(this.dataset.itemId)">🔍 ${item.movimento === 'pagamento-pendente' ? 'Ver o título do F360'
      : item.movimento === 'numerario-rateio' && !item.transferenciaContas ? `Ver ${movs.length === 1 ? 'o recebimento' : `os ${movs.length} recebimentos`} de origem`
      : `Ver ${movs.length === 1 ? 'o lançamento' : `os ${movs.length} lançamentos`} do extrato`}</button>`;
}

function linhasMovimentosPendenciaAlvorar(item) {
  return movimentosDaPendenciaAlvorar(item)
    .map(m => ({
      chaveData: String(dataKey(m.data || m.dataKey || item.data) || ''),
      data: String(fmtDate(m.data || m.dataKey || item.data)).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1'),
      conta: rotuloContaFinanceiraAlvorar(m.conta || item.conta || ''),
      historico: limparTextoECD(m.historico || ''),
      complemento: limparTextoECD(m.complemento || m.fornecedor || ''),
      documento: String(m.documento || m.numero || ''),
      tipo: limparTextoECD(m.tipoConciliacao || m.tipo || ''),
      origem: m.arquivoOrigem ? `${m.arquivoOrigem}${m.linhaOrigem ? ' (linha ' + m.linhaOrigem + ')' : ''}` : 'Extrato',
      valor: arredondarMoeda(Number(m.valor || 0))
    }))
    .sort((a, b) => a.chaveData.localeCompare(b.chaveData));
}

function abrirMovimentosPendenciaAlvorar(id) {
  const item = itensPendenciaMovimentosAlvorar.get(String(id));
  if (!item) return;
  const linhas = linhasMovimentosPendenciaAlvorar(item);
  const total = arredondarMoeda(linhas.reduce((s, l) => s + l.valor, 0));
  let el = document.getElementById('modal-movimentos-pendencia-alvorar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'modal-movimentos-pendencia-alvorar';
    el.addEventListener('click', e => { if (e.target === el) fecharMovimentosPendenciaAlvorar(); });
    document.body.appendChild(el);
  }
  const mostrarOrigem = linhas.some(l => l.origem !== 'Extrato');
  el.innerHTML = `<div class="mpa-card" role="dialog">
    <div class="mpa-topo">
      <div><h3>${item.movimento === 'pagamento-pendente' ? 'Título do F360' : item.movimento === 'numerario-rateio' && !item.transferenciaContas ? 'Recebimentos que geram estes numerários' : 'Lançamentos do extrato'}</h3>
        <div class="mpa-sub">${escapeHtml(rotuloUnidadeAlvorar(item.empresaBanco || item.centroCusto || ''))} · ${escapeHtml(item.naturezaAlvorar?.label || item.tipo || '')} · ${linhas.length} movimento${linhas.length !== 1 ? 's' : ''} · <strong>R$ ${fmtValor(total)}</strong></div></div>
      <div class="mpa-acoes">
        <button type="button" class="btn btn-sm" onclick="exportarMovimentosPendenciaAlvorar('${escapeAttr(String(id)).replace(/'/g, "\\'")}')">Exportar Excel</button>
        <button type="button" class="btn btn-sm" onclick="fecharMovimentosPendenciaAlvorar()">Fechar</button>
      </div>
    </div>
    <div class="mpa-tabela"><table>
      <thead><tr><th>Data</th><th>Conta</th><th>Histórico</th><th>Complemento</th><th>Documento</th><th>Tipo</th>${mostrarOrigem ? '<th>Origem</th>' : ''}<th class="mpa-valor">Valor</th></tr></thead>
      <tbody>${linhas.slice(0, 500).map(l => `<tr><td>${escapeHtml(l.data)}</td><td>${escapeHtml(l.conta)}</td><td>${escapeHtml(l.historico)}</td>
        <td>${escapeHtml(l.complemento)}</td><td>${escapeHtml(l.documento)}</td><td>${escapeHtml(l.tipo)}</td>
        ${mostrarOrigem ? `<td>${escapeHtml(l.origem)}</td>` : ''}<td class="mpa-valor ${l.valor < 0 ? 'mpa-neg' : ''}">R$ ${fmtValor(l.valor)}</td></tr>`).join('')}</tbody>
      ${linhas.length > 500 ? `<tr><td colspan="${mostrarOrigem ? 8 : 7}" class="mpa-aviso">Mostrando 500 de ${linhas.length.toLocaleString('pt-BR')} lançamentos. Use Exportar Excel para ver todos.</td></tr>` : ''}
      <tfoot><tr><td colspan="${mostrarOrigem ? 7 : 6}">Total</td><td class="mpa-valor">R$ ${fmtValor(total)}</td></tr></tfoot>
    </table></div>
  </div>`;
  el.style.display = 'flex';
}

function fecharMovimentosPendenciaAlvorar() {
  const el = document.getElementById('modal-movimentos-pendencia-alvorar');
  if (el) el.style.display = 'none';
}

function exportarMovimentosPendenciaAlvorar(id) {
  const item = itensPendenciaMovimentosAlvorar.get(String(id));
  if (!item) return;
  const linhas = linhasMovimentosPendenciaAlvorar(item);
  const ws = XLSX.utils.aoa_to_sheet([['Data','Conta','Historico','Complemento','Documento','Tipo','Origem','Valor'],
    ...linhas.map(l => [l.data, l.conta, l.historico, l.complemento, l.documento, l.tipo, l.origem, l.valor])]);
  ws['!cols'] = [12,40,45,45,16,24,30,16].map(wch => ({wch}));
  linhas.forEach((_, i) => { const c = ws[`H${i + 2}`]; if (c) c.z = '#,##0.00'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos');
  XLSX.writeFile(wb, `Lancamentos_pendencia_ALVORAR_${new Date().toISOString().slice(0,10)}.xlsx`);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMovimentosPendenciaAlvorar(); });

// ---- Botao "Abrir pendencias" na tela Lancamentos gerados (16/11/2026) ----
function abrirPendenciasResultadoAlvorar() {
  if (!extratoBancarioTemp.length) {
    alert('Importe os extratos para ver as pendencias da conciliacao.');
    return;
  }
  origemModalPendencias = 'conciliacao';
  gerarSugestoesConciliacao({ redirecionarSeOk: false });
  filtroNaturezaPendenciasAlvorarTemp = '';
  alterarVisaoPendenciasAlvorar('contas');
}

// ---- Outra ponta da transferencia para conta SEM extrato importado (16/11/2026, somente ALVORAR) ----
// Ex.: caixa -> TESOURARIA, banco -> APLI. Alem de D 51540 / C origem, cria D destino / C 51540 (ou o inverso
// na entrada), para a 51540 zerar. Nao cria quando o destino tem extrato importado (o banco ficaria diferente
// do extrato) nem quando o destino e de outra empresa (nao inventa empresa).
function outraPontaTransferenciaAlvorar(mov, contaContrapartida, linhaBase) {
  if (modoImportacaoDoGrupo() !== 'alvorar' || !mov || !linhaBase) return [];
  const contra = String(obterCodigoContaParaDominio(contaContrapartida) || contaContrapartida || '').trim();
  if (contra !== CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR || !movimentoEhTransferenciaEntreContas(mov)) return [];
  const importadas = new Set(extratoBancarioTemp.map(m => contaNormalizadaAlvorar(m.conta)));
  const propria = contaNormalizadaAlvorar(mov.conta);
  const destino = [mov.complemento, mov.historico].map(v => limparTextoECD(v || '')).find(v => v
    && contaNormalizadaAlvorar(v) !== propria
    && /\b(tesouraria|caixa|apli|aplicacao|banco|itau|sicoob|sicred|sicredi|bradesco|santander|basa|cef|xp)\b/.test(normalizarTexto(v)));
  if (!destino || importadas.has(contaNormalizadaAlvorar(destino))) return [];
  const empresa = String(linhaBase[7] || '');
  const codigoDestino = codigoEmpresaAlvorar(destino);
  if (!empresa || (codigoDestino && codigoDestino !== empresa)) return [];
  // Historico igual ao da primeira ponta (vai para o Dominio; nada de texto tecnico).
  const historico = String(linhaBase[5] || '').trim() || `Transferencia ${limparTextoECD(mov.conta)} / ${destino}`;
  const contaDestino = codigoBancoConciliacao(destino);
  const linha = Number(mov.valor) < 0
    ? linhaDominio(linhaBase[0], contaDestino, CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR, linhaBase[3], historico, empresa, '')
    : linhaDominio(linhaBase[0], CODIGO_TRANSFERENCIA_ENTRE_CONTAS_ALVORAR, contaDestino, linhaBase[3], historico, empresa, '');
  linha.tipoExtratoAlvorar = linhaBase.tipoExtratoAlvorar || tipoContaAlvorar(mov.conta);
  linha.movimentoExportacaoAlvorar = 'Transferencias';
  linha.outraPontaTransferenciaAlvorar = true;
  return [linha];
}

// ---- Menu "Exportar ▾" da tela de lancamentos gerados (16/11/2026) ----
function alternarMenuExportacaoResultado(evento) {
  evento?.stopPropagation?.();
  document.getElementById('menu-exportacao-resultado')?.classList.toggle('aberto');
}

function fecharMenuExportacaoResultado() {
  document.getElementById('menu-exportacao-resultado')?.classList.remove('aberto');
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', evento => {
    if (!evento?.target?.closest?.('.resultado-export-wrap')) fecharMenuExportacaoResultado();
  });
}
