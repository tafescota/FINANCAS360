function limparDataParaChave(dataIso) {
  return dataIso.replace(/[:.]/g, "-");
}

export function criarIdBackup(dataIso = new Date().toISOString(), sufixo = Math.random().toString(36).slice(2, 10)) {
  return `${limparDataParaChave(dataIso)}-${sufixo}`;
}

export function criarBackupCompleto(base, { id, dataIso, motivo = "antes-de-salvamento-completo" }) {
  return {
    versao: 1,
    tipo: "completo",
    id,
    criadoEm: dataIso,
    motivo,
    base,
  };
}

export function criarBackupGrupo(registro, { id, dataIso, grupo, camposAlterados = [] }) {
  return {
    versao: 1,
    tipo: "grupo",
    id,
    criadoEm: dataIso,
    grupo,
    camposAlterados,
    registro,
  };
}

export function camposAlteradosDoGrupo(sync, grupo) {
  const campos = sync && sync.camposPorGrupo && Array.isArray(sync.camposPorGrupo[grupo])
    ? sync.camposPorGrupo[grupo]
    : [];
  return [...new Set(campos.filter((campo) => typeof campo === "string" && campo.trim()))];
}
