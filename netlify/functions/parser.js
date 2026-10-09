// ============================================================
// Parser client-side — porta de reconciliador/{loaders,validate,apontamentos}.py
// Lê os .xlsx no navegador (SheetJS), sem precisar de backend.
// ============================================================

const AppData = {
  extrato: [],
  saldoAnterior: null,
  pagar: [],
  receber: [],
  cartoes: [],
  apontamentos: [],
  validacaoTotais: null,
};

function normalizarEmpresa(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  let s = String(valor).trim().replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, " - ");
  return s.trim();
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  return String(valor).trim().replace(/\s+/g, " ");
}

function paraNumero(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function paraData(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  // serial do Excel
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtData(d) {
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function fmtMoeda(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lerPrimeiraAba(workbook, nomeAba) {
  const ws = workbook.Sheets[nomeAba] || workbook.Sheets[workbook.SheetNames[0]];
  return ws;
}

function sheetParaLinhas(ws, headerRowIndex) {
  // range: headerRowIndex -> primeira linha lida é o header
  const linhas = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex, defval: null, raw: true });
  return linhas;
}

// ---------------- EXTRATO ----------------
async function carregarExtrato(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = lerPrimeiraAba(wb, "Extratos");
  const linhas = sheetParaLinhas(ws, 1); // header na 2ª linha (igual pandas header=1)

  const mov = [];
  let saldoAnterior = null;
  let jaEncontrouSaldoAnterior = false;

  linhas.forEach((r, idx) => {
    const historico = normalizarTexto(r["Histórico"]);
    if (historico && historico.includes("Saldo anterior")) {
      // Pode haver mais de uma linha "Saldo anterior" no relatório (ex: uma
      // linha-trailer no fim indicando a abertura do próximo período) --
      // usamos só a PRIMEIRA como saldo de abertura real, igual ao loader Python.
      if (!jaEncontrouSaldoAnterior) {
        saldoAnterior = paraNumero(r["Saldo"]);
        jaEncontrouSaldoAnterior = true;
      }
      return; // nenhuma linha "Saldo anterior" é um movimento
    }
    mov.push({
      id_extrato: idx,
      data: paraData(r["Data"]),
      contaBanco: normalizarTexto(r["Conta"]),
      valor: paraNumero(r["Valor"]),
      historico,
      complemento: normalizarTexto(r["Complemento"]),
      documento: r["Documento"] !== null && r["Documento"] !== undefined ? String(r["Documento"]).trim() : null,
      empresa: normalizarEmpresa(r["Empresa"]),
      origem: normalizarTexto(r["Origem"]),
      saldo: paraNumero(r["Saldo"]),
      tipoConciliacaoDomino: normalizarTexto(r["Tipo de Conciliação"]),
    });
  });

  return { movimentos: mov, saldoAnterior };
}

// ---------------- TÍTULOS (pagar / receber) ----------------
async function carregarTitulos(file, tipo) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = lerPrimeiraAba(wb, "Parcelas de Títulos");
  const linhas = sheetParaLinhas(ws, 9); // header na linha 10 (pandas header=9)

  return linhas
    .filter(r => r["Tipo"] !== null && r["Tipo"] !== undefined)
    .map((r, idx) => {
      const numeroOriginal = r["Número"];
      const semNumero = numeroOriginal === null || numeroOriginal === undefined || numeroOriginal === "";
      return {
        tipoTitulo: normalizarTexto(r["Tipo"]),
        numeroTitulo: semNumero ? `SEM-NUMERO-${tipo}-${idx}` : String(numeroOriginal).trim(),
        numeroTituloSintetico: semNumero,
        parcela: normalizarTexto(r["Parcela"]),
        empresaTitulo: normalizarEmpresa(r["Empresa"]),
        fornecedorCliente: normalizarTexto(r["Cliente / Fornecedor"]),
        liquidacao: paraData(r["Liquidação"]),
        valorRateio: paraNumero(r["Valor Bruto"]),
        planoDeContas: normalizarTexto(r["Plano de Contas"]),
        centroDeCusto: normalizarEmpresa(r["Centro de Custos"]),
        contaBanco: normalizarTexto(r["Conta"]),
        meioPagamento: normalizarTexto(r["Meio de Pagamento"]),
        status: normalizarTexto(r["Status"]),
        origemArquivo: `titulo_${tipo}`,
      };
    });
}

// ---------------- CARTÕES ----------------
async function carregarCartoes(files) {
  let todas = [];
  for (const file of files) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = lerPrimeiraAba(wb, "Parcelas de Cartões");
    const linhas = sheetParaLinhas(ws, 0);
    todas = todas.concat(linhas);
  }

  return todas
    .filter(r => r["Tipo"] !== null && r["Tipo"] !== undefined)
    .map(r => ({
      tipoTitulo: normalizarTexto(r["Tipo"]),
      resOperacoes: r["Res. Operações"],
      numeroTitulo: r["Res. Operações"],
      empresaTitulo: normalizarEmpresa(r["Empresa"]),
      adquirente: normalizarTexto(r["Adquirente"]),
      fornecedorCliente: normalizarTexto(r["Adquirente"]),
      liquidacao: paraData(r["Dt. Liquidação"]),
      valorRateio: paraNumero(r["Valor Bruto"]),
      contaBanco: normalizarTexto(r["Conta"]),
      centroDeCusto: normalizarEmpresa(r["Centro de Custo"]),
      planoDeContas: normalizarTexto(r["Plano de Conta"]),
      conciliadoPdvTef: normalizarTexto(r["Conciliado com PDV/TEF"]),
      conciliadoExtratoDomino: normalizarTexto(r["Conciliado com Extrato"]),
      origemArquivo: "cartao",
    }));
}

// ---------------- VALIDAÇÃO DE TOTAIS DO EXTRATO ----------------
function validarTotaisExtrato(movimentos, saldoAnterior) {
  let entradas = 0, saidas = 0, valoresNulos = 0;
  const chaves = new Map();

  movimentos.forEach(m => {
    if (m.valor === null) { valoresNulos++; return; }
    if (m.valor > 0) entradas += m.valor; else if (m.valor < 0) saidas += m.valor;
    const chave = [fmtData(m.data), m.valor, m.historico, m.documento].join("|");
    chaves.set(chave, (chaves.get(chave) || 0) + 1);
  });

  let duplicatas = 0;
  chaves.forEach(qtd => { if (qtd > 1) duplicatas += qtd; });

  const saldoFinalDeclarado = movimentos.length ? movimentos[movimentos.length - 1].saldo : null;
  const saldoCalculado = (saldoAnterior || 0) + entradas + saidas;
  const diferenca = Math.round((saldoCalculado - saldoFinalDeclarado) * 100) / 100;

  return {
    quantidadeMovimentos: movimentos.length,
    saldoAnterior,
    entradas: Math.round(entradas * 100) / 100,
    saidas: Math.round(saidas * 100) / 100,
    saldoFinalDeclarado: Math.round(saldoFinalDeclarado * 100) / 100,
    saldoCalculado: Math.round(saldoCalculado * 100) / 100,
    diferenca,
    bate: Math.abs(diferenca) <= 0.01,
    valoresNulos,
    qtdPossiveisDuplicatas: duplicatas,
  };
}

// ---------------- APONTAMENTOS ----------------
function gerarApontamentos(pagar, receber, cartoes) {
  const out = [];

  function apontarTitulos(lista, origem) {
    lista.forEach(t => {
      const ok = t.status && t.status.startsWith("Liquidado");
      if (!ok) {
        out.push({
          origem, tipoProblema: "TITULO_SEM_STATUS_LIQUIDADO",
          numeroTitulo: t.numeroTitulo, fornecedorCliente: t.fornecedorCliente,
          empresaTitulo: t.empresaTitulo, centroDeCusto: t.centroDeCusto,
          planoDeContas: t.planoDeContas, valor: t.valorRateio,
          detalhe: `Status = ${t.status || "(vazio)"}`,
        });
      }
    });
  }
  apontarTitulos(pagar, "titulo_pagar");
  apontarTitulos(receber, "titulo_receber");

  cartoes.forEach(c => {
    if (!c.conciliadoExtratoDomino) {
      out.push({
        origem: "cartao", tipoProblema: "CARTAO_NAO_CONCILIADO_COM_EXTRATO",
        numeroTitulo: c.numeroTitulo, fornecedorCliente: c.fornecedorCliente,
        empresaTitulo: c.empresaTitulo, centroDeCusto: c.centroDeCusto,
        planoDeContas: c.planoDeContas, valor: c.valorRateio,
        detalhe: `Adquirente: ${c.adquirente || ""}`,
      });
    }
  });

  out.sort((a, b) => Math.abs(b.valor || 0) - Math.abs(a.valor || 0));
  return out;
}
