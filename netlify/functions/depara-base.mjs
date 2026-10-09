import { getStore } from "@netlify/blobs";
import { camposAlteradosDoGrupo, criarBackupCompleto, criarBackupGrupo, criarIdBackup } from "./backup-base.mjs";
import { CAMPOS_POR_GRUPO, prepararBasePersistida } from "./group-merge.mjs";

const BLOB_KEY = "base";
const SYNC_META_KEY = "sync-meta";
const GROUP_STORAGE_VERSION = "v1";

function groupBlobKey(generation, grupo) {
  return `groups/${generation}/${encodeURIComponent(grupo)}`;
}

function groupConfigBlobKey(generation, grupo) {
  return `group-config/${generation}/${encodeURIComponent(grupo)}`;
}

function backupFullBlobKey(id) {
  return `backups/full/${id}`;
}

function backupGroupBlobKey(id, grupo) {
  return `backups/groups/${id}/${encodeURIComponent(grupo)}`;
}

function backupManifestBlobKey(id) {
  return `backups/manifests/${id}`;
}

function registroGrupo(base, grupo, updatedAt) {
  const campos = {};
  CAMPOS_POR_GRUPO.forEach((campo) => {
    if (base[campo] && Object.prototype.hasOwnProperty.call(base[campo], grupo)) campos[campo] = base[campo][grupo];
  });
  return { grupo, campos, updatedAt };
}

async function sobreporRegistrosDeGrupo(store, base) {
  const generation = base.__groupStorageGeneration || GROUP_STORAGE_VERSION;
  const registros = await Promise.all((Array.isArray(base.grupos) ? base.grupos : []).map(async (grupo) => {
    const [raw, rawConfig] = await Promise.all([
      store.get(groupBlobKey(generation, grupo)),
      store.get(groupConfigBlobKey(generation, grupo)),
    ]);
    const registro = raw ? JSON.parse(raw) : { grupo, campos: {} };
    if (rawConfig) registro.campos.configGrupos = JSON.parse(rawConfig);
    return raw || rawConfig ? registro : null;
  }));
  let updatedAt = base.updatedAt || null;
  registros.filter(Boolean).forEach((registro) => {
    CAMPOS_POR_GRUPO.forEach((campo) => {
      if (!Object.prototype.hasOwnProperty.call(registro.campos || {}, campo)) return;
      base[campo] = base[campo] && typeof base[campo] === "object" ? base[campo] : {};
      base[campo][registro.grupo] = registro.campos[campo];
    });
    if (registro.updatedAt && (!updatedAt || registro.updatedAt > updatedAt)) updatedAt = registro.updatedAt;
  });
  base.updatedAt = updatedAt;
  delete base.__groupStorageGeneration;
  return base;
}

async function lerRegistroGrupoAtual(store, baseAtual, generation, grupo) {
  const [rawRegistro, rawConfig] = await Promise.all([
    store.get(groupBlobKey(generation, grupo)),
    store.get(groupConfigBlobKey(generation, grupo)),
  ]);
  const registro = rawRegistro
    ? JSON.parse(rawRegistro)
    : registroGrupo(baseAtual, grupo, baseAtual.updatedAt || null);
  if (rawConfig) registro.campos.configGrupos = JSON.parse(rawConfig);
  return registro;
}

async function salvarBackupAntesDaGravacao(store, baseAtual, body, resultado, rawAtual, dataIso) {
  if (!rawAtual) return null;
  const id = criarIdBackup(dataIso);
  if (resultado.modo === "grupos") {
    const generation = baseAtual.__groupStorageGeneration || GROUP_STORAGE_VERSION;
    const sync = body.__sync && typeof body.__sync === "object" ? body.__sync : {};
    const backups = await Promise.all(resultado.gruposAlterados.map(async (grupo) => {
      const registro = await lerRegistroGrupoAtual(store, baseAtual, generation, grupo);
      const backup = criarBackupGrupo(registro, {
        id,
        dataIso,
        grupo,
        camposAlterados: camposAlteradosDoGrupo(sync, grupo),
      });
      await store.set(backupGroupBlobKey(id, grupo), JSON.stringify(backup));
      return { grupo, chave: backupGroupBlobKey(id, grupo) };
    }));
    await store.set(backupManifestBlobKey(id), JSON.stringify({ versao: 1, id, tipo: "grupos", criadoEm: dataIso, backups }));
    return id;
  }

  const baseEfetiva = await sobreporRegistrosDeGrupo(store, structuredClone(baseAtual));
  const backup = criarBackupCompleto(baseEfetiva, { id, dataIso });
  await Promise.all([
    store.set(backupFullBlobKey(id), JSON.stringify(backup)),
    store.set(backupManifestBlobKey(id), JSON.stringify({ versao: 1, id, tipo: "completo", criadoEm: dataIso, chave: backupFullBlobKey(id) })),
  ]);
  return id;
}

export default async (req, context) => {
  const store = getStore("depara");

  // GET — retorna a base atual
  if (req.method === "GET") {
    try {
      const somenteMeta = new URL(req.url).searchParams.get("meta") === "1";
      const rawMeta = await store.get(SYNC_META_KEY);
      const meta = rawMeta ? JSON.parse(rawMeta) : {};
      if (somenteMeta) return Response.json({ syncToken: meta.syncToken || "", updatedAt: meta.updatedAt || null });
      const raw = await store.get(BLOB_KEY);
      if (!raw) {
        return Response.json({ grupos: [], depara: {}, deparaRecebimentos: {}, deparaProvisao: {}, deparaProvisaoParcelas: {}, planoContas: {}, updatedAt: null });
      }
      const data = JSON.parse(raw);
      const base = await sobreporRegistrosDeGrupo(store, data);
      return Response.json({ ...base, syncToken: meta.syncToken || base.updatedAt || "" });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // POST ou PUT — salva a base
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const body = await req.json();
      if (!Array.isArray(body.grupos) || typeof body.depara !== "object") {
        return Response.json({ error: "Formato inválido." }, { status: 400 });
      }
      const rawAtual = await store.get(BLOB_KEY);
      const baseAtual = rawAtual ? JSON.parse(rawAtual) : {};
      const resultado = prepararBasePersistida(baseAtual, body);
      const updatedAt = new Date().toISOString();
      const syncToken = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const backupId = await salvarBackupAntesDaGravacao(store, baseAtual, body, resultado, rawAtual, updatedAt);
      if (resultado.modo === "grupos" && rawAtual) {
        const generation = baseAtual.__groupStorageGeneration || GROUP_STORAGE_VERSION;
        await Promise.all(resultado.gruposAlterados.map(async (grupo) => {
          const atual = await lerRegistroGrupoAtual(store, baseAtual, generation, grupo);
          const recebido = registroGrupo(body, grupo, updatedAt);
          const registro = { grupo, campos: { ...(atual.campos || {}), ...(recebido.campos || {}) }, updatedAt };
          const gravacoes = [store.set(groupBlobKey(generation, grupo), JSON.stringify(registro))];
          if (Object.prototype.hasOwnProperty.call(recebido.campos || {}, "configGrupos")) {
            gravacoes.push(store.set(groupConfigBlobKey(generation, grupo), JSON.stringify(recebido.campos.configGrupos)));
          }
          await Promise.all(gravacoes);
        }));
      } else {
        const baseCompleta = rawAtual
          ? resultado.base
          : prepararBasePersistida({}, { ...body, __sync: { estruturaCompleta: true } }).base;
        const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await Promise.all((baseCompleta.grupos || []).flatMap((grupo) => {
          const registro = registroGrupo(baseCompleta, grupo, updatedAt);
          const gravacoes = [store.set(groupBlobKey(generation, grupo), JSON.stringify(registro))];
          if (Object.prototype.hasOwnProperty.call(registro.campos, "configGrupos")) {
            gravacoes.push(store.set(groupConfigBlobKey(generation, grupo), JSON.stringify(registro.campos.configGrupos)));
          }
          return gravacoes;
        }));
        const payload = JSON.stringify({ ...baseCompleta, __groupStorageGeneration: generation, updatedAt });
        await store.set(BLOB_KEY, payload);
      }
      await store.set(SYNC_META_KEY, JSON.stringify({ syncToken, updatedAt }));
      const modoPersistido = resultado.modo === "grupos" && rawAtual ? "grupos" : "completo";
      return Response.json({ ok: true, updatedAt, syncToken, modo: modoPersistido, gruposAlterados: resultado.gruposAlterados, backupId });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // OPTIONS — CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  return new Response("Método não permitido.", { status: 405 });
};

export const config = {
  path: "/.netlify/functions/depara-base",
};
