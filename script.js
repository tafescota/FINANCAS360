// ============================================================
// Conciliador de Rateio — esqueleto de navegação
// Nenhuma lógica de processamento real ainda: só estrutura das
// 9 telas do item 19 da spec, com estado "aguardando processamento".
// ============================================================

// ---------- Navegação entre telas ----------
const navItems = document.querySelectorAll(".nav-item");
const screens = document.querySelectorAll(".screen");

function irParaTela(id) {
  screens.forEach(s => s.classList.toggle("active", s.id === id));
  navItems.forEach(n => n.classList.toggle("active", n.dataset.screen === id));
  window.location.hash = id;
}

navItems.forEach(item => {
  item.addEventListener("click", () => irParaTela(item.dataset.screen));
});

const telaInicial = (window.location.hash || "#tela1").replace("#", "");
irParaTela(document.getElementById(telaInicial) ? telaInicial : "tela1");

// ---------- Status rail (item 20 da spec, resumido) ----------
// status possíveis: "pendente" | "ok" | "alerta" | "bloqueio"
const STATUS_RAIL_ITEMS = [
  { label: "Extrato",     status: "pendente" },
  { label: "Rateios",     status: "pendente" },
  { label: "Folha",       status: "pendente" },
  { label: "Numerários",  status: "pendente" },
  { label: "De-Para",     status: "pendente" },
  { label: "Liberação",   status: "pendente" },
];

const railEl = document.getElementById("statusRail");
railEl.innerHTML = STATUS_RAIL_ITEMS.map(item => `
  <div class="seg">
    <span class="dot ${item.status}"></span>
    <span>${item.label}</span>
  </div>
`).join("");

// ---------- Tela 8 — Painel de validação (item 20 da spec) ----------
// status: "pendente" (cinza, ainda não rodou) | "ok" | "alerta" | "bloqueio"
const VALIDACOES = [
  { titulo: "Quantidade do extrato",       regra: "100% das linhas tratadas",                  status: "pendente" },
  { titulo: "Duplicidades",                regra: "Nenhuma não justificada",                    status: "pendente" },
  { titulo: "Saldo anterior",              regra: "Informado",                                  status: "pendente" },
  { titulo: "Entradas",                    regra: "Igual ao extrato",                            status: "pendente" },
  { titulo: "Saídas",                      regra: "Igual ao extrato",                            status: "pendente" },
  { titulo: "Saldo final",                 regra: "Igual ao extrato",                            status: "pendente" },
  { titulo: "Rateios",                     regra: "Soma igual ao título (tolerância R$ 0,01)",   status: "pendente" },
  { titulo: "Folha",                       regra: "Líquido igual ao banco",                      status: "pendente" },
  { titulo: "Valores negativos",           regra: "Zero",                                        status: "pendente" },
  { titulo: "Débito 63 × Crédito 1239",    regra: "Diferença zero",                              status: "pendente" },
  { titulo: "Crédito 63 × Débito 1239",    regra: "Diferença zero",                              status: "pendente" },
  { titulo: "Contas estruturais",          regra: "Protegidas contra sobrescrita do De-Para",     status: "pendente" },
  { titulo: "Empresas",                    regra: "Preenchidas em todas as linhas",               status: "pendente" },
  { titulo: "De-Para",                     regra: "Sem conflitos bloqueantes",                    status: "pendente" },
  { titulo: "Linhas descartadas",          regra: "Zero — o extrato é soberano",                  status: "pendente" },
];

const LABEL_STATUS = { pendente: "Aguardando", ok: "Aprovado", alerta: "Revisar", bloqueio: "Bloqueado" };

function renderValidacoes() {
  const el = document.getElementById("listaValidacoes");
  el.innerHTML = VALIDACOES.map(v => `
    <div class="valid-row">
      <span class="semaforo ${v.status}"></span>
      <div>
        <div class="titulo">${v.titulo}</div>
        <div class="regra">${v.regra}</div>
      </div>
      <span class="badge-status ${v.status === 'pendente' ? '' : v.status}">
        <span class="dot"></span>${LABEL_STATUS[v.status]}
      </span>
      <span></span>
    </div>
  `).join("");
}
renderValidacoes();

// ---------- Tela 9 — Exportação (item 19 / Tela 9 da spec) ----------
const EXPORTACOES = [
  { idx: "01", titulo: "Recebimentos",           desc: "Cartões, PIX, clientes e demais entradas do Motor 1." },
  { idx: "02", titulo: "Pagamentos sem rateio",   desc: "Fornecedor único, tarifas, boletos e despesas próprias." },
  { idx: "03", titulo: "Pagamentos rateados",     desc: "Títulos divididos entre centros de custo, com numerário." },
  { idx: "04", titulo: "Folha líquida",           desc: "Somente o valor líquido pago no banco, agrupado por funcionário." },
  { idx: "05", titulo: "Importação completa",     desc: "Layout final pronto para o Domínio — todos os motores juntos." },
  { idx: "06", titulo: "Relatório de auditoria",  desc: "Todo lançamento com origem, regra aplicada e usuário responsável." },
];

function renderExportacao() {
  const el = document.getElementById("gridExportacao");
  el.innerHTML = EXPORTACOES.map(e => `
    <div class="card export-card">
      <div>
        <div class="idx">${e.idx}</div>
        <h4>${e.titulo}</h4>
        <p>${e.desc}</p>
      </div>
      <button class="btn-secondary" disabled title="Disponível após todas as validações ficarem verdes">Exportar</button>
    </div>
  `).join("");
}
renderExportacao();

// ---------- Tela 1 — Mapeamento conta → empresa titular ----------
// Detectado a partir da aba "Filtros" do extrato real + padrão já usado no
// Finanças 360 (empresaBancoRateioPorConta). Editável: são só sugestões.
const EMPRESAS_GRUPO = [
  "14463 - CACHOEIRA - LOJA",
  "14474 - MURITIBA - LOJA",
  "14509 - CACHOEIRA - VD",
  "14459 - ADM CENTRAL - ESCRITÓRIO",
];

let CONTAS_MAPEAMENTO = [
  { conta: "BRADESCO",               empresa: "14463 - CACHOEIRA - LOJA",       contaContabil: "8" },
  { conta: "CAIXA LOJA CACHOEIRA",   empresa: "14463 - CACHOEIRA - LOJA",       contaContabil: "" },
  { conta: "CAIXA LOJA MURITIBA",    empresa: "14474 - MURITIBA - LOJA",        contaContabil: "" },
  { conta: "CAIXA VD CACHOEIRA",     empresa: "14509 - CACHOEIRA - VD",         contaContabil: "" },
  { conta: "CONTA COFRE ESCRITÓRIO", empresa: "14459 - ADM CENTRAL - ESCRITÓRIO", contaContabil: "" },
  { conta: "APLICAÇÃO BRADESCO",     empresa: "14463 - CACHOEIRA - LOJA",       contaContabil: "" },
];

function renderContasMapeamento() {
  const el = document.getElementById("tabelaContasMapeamento");
  el.innerHTML = CONTAS_MAPEAMENTO.map((c, i) => `
    <tr>
      <td><input data-idx="${i}" class="inp-conta-nome" type="text" value="${c.conta}" style="border:1px solid var(--border-strong);border-radius:4px;padding:5px 6px;font-size:12.5px;width:100%;font-weight:600;"></td>
      <td>
        <select data-idx="${i}" class="sel-empresa" style="border:1px solid var(--border-strong);border-radius:4px;padding:5px 6px;font-size:12.5px;width:100%;">
          ${EMPRESAS_GRUPO.map(e => `<option ${e === c.empresa ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </td>
      <td><input data-idx="${i}" class="inp-conta-contabil" type="text" value="${c.contaContabil}" placeholder="ex: 8" style="border:1px solid var(--border-strong);border-radius:4px;padding:5px 6px;font-size:12.5px;width:80px;font-family:var(--font-mono);"></td>
      <td><input type="text" placeholder="R$ 0,00" style="border:1px solid var(--border-strong);border-radius:4px;padding:5px 6px;font-size:12.5px;width:100px;font-family:var(--font-mono);"></td>
      <td><button class="btn-ghost" data-idx="${i}" data-action="remover">Remover</button></td>
    </tr>
  `).join("");

  el.querySelectorAll(".sel-empresa").forEach(sel => {
    sel.addEventListener("change", e => {
      CONTAS_MAPEAMENTO[e.target.dataset.idx].empresa = e.target.value;
    });
  });
  el.querySelectorAll('[data-action="remover"]').forEach(btn => {
    btn.addEventListener("click", () => {
      CONTAS_MAPEAMENTO.splice(btn.dataset.idx, 1);
      renderContasMapeamento();
    });
  });
}
renderContasMapeamento();

document.getElementById("btnAddConta").addEventListener("click", () => {
  CONTAS_MAPEAMENTO.push({ conta: "Nova conta", empresa: EMPRESAS_GRUPO[0], contaContabil: "" });
  renderContasMapeamento();
});

// ---------- Tela 1 — Upload real dos arquivos ----------
const arquivosSelecionados = { extrato: null, pagar: null, receber: null, cartoes: [], folha: null, empresas: null };

document.querySelectorAll(".dropzone[data-tipo]").forEach(zone => {
  const tipo = zone.dataset.tipo;
  const input = zone.querySelector("input[type=file]");
  input.addEventListener("change", () => {
    if (!input.files.length) return;
    if (tipo === "cartoes") {
      arquivosSelecionados.cartoes = Array.from(input.files);
      document.getElementById("status-cartoes").textContent =
        `${input.files.length} arquivo(s): ` + Array.from(input.files).map(f => f.name).join(", ");
    } else {
      arquivosSelecionados[tipo] = input.files[0];
      document.getElementById(`status-${tipo}`).textContent = input.files[0].name;
    }
    zone.classList.add("attached");
  });
});

document.getElementById("btnProcessar").addEventListener("click", async () => {
  const msg = document.getElementById("msgProcessamento");
  if (!arquivosSelecionados.extrato) {
    msg.textContent = "Envie ao menos o extrato bancário para processar.";
    msg.style.color = "var(--danger)";
    return;
  }
  msg.style.color = "var(--ink-soft)";
  msg.textContent = "Lendo arquivos…";

  try {
    const { movimentos, saldoAnterior } = await carregarExtrato(arquivosSelecionados.extrato);
    AppData.extrato = movimentos;
    AppData.saldoAnterior = saldoAnterior;
    AppData.validacaoTotais = validarTotaisExtrato(movimentos, saldoAnterior);

    if (arquivosSelecionados.pagar) AppData.pagar = await carregarTitulos(arquivosSelecionados.pagar, "pagar");
    if (arquivosSelecionados.receber) AppData.receber = await carregarTitulos(arquivosSelecionados.receber, "receber");
    if (arquivosSelecionados.cartoes.length) AppData.cartoes = await carregarCartoes(arquivosSelecionados.cartoes);

    AppData.apontamentos = gerarApontamentos(AppData.pagar, AppData.receber, AppData.cartoes);

    msg.style.color = "var(--ok)";
    msg.textContent = `Processado: ${movimentos.length.toLocaleString("pt-BR")} movimentos de extrato, ` +
      `${AppData.pagar.length.toLocaleString("pt-BR")} linhas a pagar, ${AppData.receber.length.toLocaleString("pt-BR")} a receber, ` +
      `${AppData.cartoes.length.toLocaleString("pt-BR")} linhas de cartão. Veja as Telas 02 e 03.`;

    atualizarTela2();
    atualizarTela3();
    atualizarStatusRail();
  } catch (err) {
    console.error(err);
    msg.style.color = "var(--danger)";
    msg.textContent = "Erro ao ler os arquivos: " + err.message + " — confira se o formato bate com o esperado.";
  }
});

// ---------- Tela 2 ----------
function atualizarTela2() {
  const v = AppData.validacaoTotais;
  if (!v) return;
  document.getElementById("card-movimentos").textContent = v.quantidadeMovimentos.toLocaleString("pt-BR");
  document.getElementById("card-movimentos").classList.remove("muted");
  document.getElementById("foot-movimentos").textContent = v.valoresNulos > 0 ? `${v.valoresNulos} com valor nulo` : "todos com valor preenchido";
  document.getElementById("card-entradas").textContent = fmtMoeda(v.entradas);
  document.getElementById("card-entradas").classList.remove("muted");
  document.getElementById("card-saidas").textContent = fmtMoeda(v.saidas);
  document.getElementById("card-saidas").classList.remove("muted");
  document.getElementById("card-saldo-final").textContent = fmtMoeda(v.saldoFinalDeclarado);
  document.getElementById("card-saldo-final").classList.remove("muted");
  document.getElementById("card-saldo-anterior").textContent = fmtMoeda(v.saldoAnterior);
  document.getElementById("card-saldo-anterior").classList.remove("muted");
  document.getElementById("card-duplicidades").textContent = v.qtdPossiveisDuplicatas.toLocaleString("pt-BR");
  document.getElementById("card-duplicidades").classList.remove("muted");

  const cardDif = document.getElementById("card-diferenca");
  cardDif.textContent = fmtMoeda(v.diferenca);
  cardDif.classList.remove("muted");
  cardDif.style.color = v.bate ? "var(--ok)" : "var(--danger)";
  document.getElementById("foot-diferenca").textContent = v.bate
    ? "bate exato — dentro da tolerância de R$ 0,01"
    : "NÃO bate — revisar antes de liberar";

  document.getElementById("tela2-resumo").outerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tipo de conciliação (tag do Domínio)</th><th class="num">Quantidade</th><th class="num">Soma (R$)</th></tr></thead>
        <tbody>${resumoPorTag()}</tbody>
      </table>
    </div>`;
}

function resumoPorTag() {
  const grupos = {};
  AppData.extrato.forEach(m => {
    const tag = m.tipoConciliacaoDomino || "(sem tag)";
    if (!grupos[tag]) grupos[tag] = { qtd: 0, soma: 0 };
    grupos[tag].qtd++;
    grupos[tag].soma += m.valor || 0;
  });
  return Object.entries(grupos)
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .map(([tag, g]) => `<tr><td>${tag}</td><td class="num">${g.qtd.toLocaleString("pt-BR")}</td><td class="num">${fmtMoeda(g.soma)}</td></tr>`)
    .join("");
}

// ---------- Tela 3 ----------
let filtroAtivoConciliacao = "Todos";

function atualizarTela3() {
  renderTabelaConciliacao();
  renderTabelaApontamentos();
}

document.querySelectorAll("#chipsConciliacao .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#chipsConciliacao .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    filtroAtivoConciliacao = chip.dataset.filtro;
    renderTabelaConciliacao();
  });
});

function renderTabelaConciliacao() {
  const tbody = document.getElementById("tabelaConciliacao");
  const rodape = document.getElementById("rodapeConciliacao");
  if (!AppData.extrato.length) return;

  let linhas = AppData.extrato;
  if (filtroAtivoConciliacao === "SEM_TAG") {
    linhas = linhas.filter(m => !m.tipoConciliacaoDomino);
  } else if (filtroAtivoConciliacao !== "Todos") {
    linhas = linhas.filter(m => m.tipoConciliacaoDomino === filtroAtivoConciliacao);
  }

  const LIMITE = 200;
  const mostrar = linhas.slice(0, LIMITE);

  tbody.innerHTML = mostrar.map(m => `
    <tr>
      <td>${fmtData(m.data)}</td>
      <td>${m.historico || "<span style=\"color:var(--ink-muted)\">—</span>"}</td>
      <td style="font-family:var(--font-mono)">${m.documento || ""}</td>
      <td class="num" style="color:${m.valor < 0 ? 'var(--danger)' : 'var(--ink)'}">${fmtMoeda(m.valor)}</td>
      <td>${m.tipoConciliacaoDomino ? `<span class="badge-status ok"><span class="dot"></span>${m.tipoConciliacaoDomino}</span>` : `<span class="badge-status alerta"><span class="dot"></span>Somente extrato</span>`}</td>
      <td>${m.empresa || ""}</td>
    </tr>
  `).join("");

  rodape.textContent = linhas.length > LIMITE
    ? `Mostrando ${LIMITE} de ${linhas.length.toLocaleString("pt-BR")} linhas — refine o filtro para ver outras.`
    : `${linhas.length.toLocaleString("pt-BR")} linha(s).`;
}

function renderTabelaApontamentos() {
  const tbody = document.getElementById("tabelaApontamentos");
  if (!AppData.apontamentos.length) return;
  tbody.innerHTML = AppData.apontamentos.slice(0, 200).map(a => `
    <tr>
      <td>${a.origem}</td>
      <td><span class="badge-status alerta"><span class="dot"></span>${a.tipoProblema}</span></td>
      <td>${a.fornecedorCliente || ""}</td>
      <td>${a.empresaTitulo || ""}</td>
      <td>${a.centroDeCusto || ""}</td>
      <td>${a.planoDeContas || ""}</td>
      <td class="num">${fmtMoeda(a.valor)}</td>
    </tr>
  `).join("");
}

// ---------- Status rail dinâmica ----------
function atualizarStatusRail() {
  if (AppData.validacaoTotais) {
    STATUS_RAIL_ITEMS[0].status = AppData.validacaoTotais.bate ? "ok" : "bloqueio";
  }
  if (AppData.pagar.length || AppData.receber.length) {
    STATUS_RAIL_ITEMS[1].status = AppData.apontamentos.length ? "alerta" : "ok";
  }
  railEl.innerHTML = STATUS_RAIL_ITEMS.map(item => `
    <div class="seg"><span class="dot ${item.status}"></span><span>${item.label}</span></div>
  `).join("");
}

// (dropzones agora usam <label>+<input type=file> real — ver bloco de upload acima)
