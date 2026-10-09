export const CAMPOS_POR_GRUPO = [
  "depara",
  "deparaRecebimentos",
  "deparaProvisao",
  "deparaProvisaoParcelas",
  "planoContas",
  "contasSemConciliacao",
  "configGrupos",
  "deparaSaidasExtrato",
];

function objeto(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

export function prepararBasePersistida(baseAtual, baseRecebida) {
  const atual = objeto(baseAtual);
  const recebida = objeto(baseRecebida);
  const sync = objeto(recebida.__sync);
  const gruposAlterados = Array.isArray(sync.gruposAlterados)
    ? [...new Set(sync.gruposAlterados.filter((nome) => typeof nome === "string" && nome.trim()))]
    : [];

  if (sync.estruturaCompleta !== false || gruposAlterados.length === 0) {
    const { __sync, ...baseCompleta } = recebida;
    return { base: baseCompleta, modo: "completo", gruposAlterados: [] };
  }

  const base = { ...atual };
  const gruposAtuais = Array.isArray(atual.grupos) ? atual.grupos : [];
  const gruposRecebidos = Array.isArray(recebida.grupos) ? recebida.grupos : [];
  base.grupos = [...gruposAtuais];
  gruposAlterados.forEach((grupo) => {
    if (gruposRecebidos.includes(grupo) && !base.grupos.includes(grupo)) base.grupos.push(grupo);
  });

  CAMPOS_POR_GRUPO.forEach((campo) => {
    const remoto = objeto(atual[campo]);
    const enviado = objeto(recebida[campo]);
    base[campo] = { ...remoto };
    gruposAlterados.forEach((grupo) => {
      if (Object.prototype.hasOwnProperty.call(enviado, grupo)) base[campo][grupo] = enviado[grupo];
    });
  });

  delete base.__sync;
  return { base, modo: "grupos", gruposAlterados };
}
