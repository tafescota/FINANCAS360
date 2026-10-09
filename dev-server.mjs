import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPOS_POR_GRUPO, prepararBasePersistida } from "./netlify/functions/group-merge.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8787);
const basePath = process.env.DEPARA_BASE_PATH ? resolve(process.env.DEPARA_BASE_PATH) : join(root, ".local", "depara-base.json");
const groupsPath = join(dirname(basePath), "groups");
const metaPath = join(dirname(basePath), "sync-meta.json");
const groupStorageVersion = "v1";

function groupFilePath(generation, grupo) {
  return join(groupsPath, `${generation}--${Buffer.from(grupo).toString("base64url")}.json`);
}

function registroGrupo(base, grupo, updatedAt) {
  const campos = {};
  CAMPOS_POR_GRUPO.forEach((campo) => {
    if (base[campo] && Object.prototype.hasOwnProperty.call(base[campo], grupo)) campos[campo] = base[campo][grupo];
  });
  return { grupo, campos, updatedAt };
}

async function sobreporRegistrosDeGrupo(base) {
  const generation = base.__groupStorageGeneration || groupStorageVersion;
  let updatedAt = base.updatedAt || null;
  await Promise.all((Array.isArray(base.grupos) ? base.grupos : []).map(async (grupo) => {
    const path = groupFilePath(generation, grupo);
    if (!existsSync(path)) return;
    const registro = JSON.parse(await readFile(path, "utf8"));
    CAMPOS_POR_GRUPO.forEach((campo) => {
      if (!Object.prototype.hasOwnProperty.call(registro.campos || {}, campo)) return;
      base[campo] = base[campo] && typeof base[campo] === "object" ? base[campo] : {};
      base[campo][registro.grupo] = registro.campos[campo];
    });
    if (registro.updatedAt && (!updatedAt || registro.updatedAt > updatedAt)) updatedAt = registro.updatedAt;
  }));
  base.updatedAt = updatedAt;
  delete base.__groupStorageGeneration;
  return base;
}

const baseVazia = {
  grupos: [],
  depara: {},
  deparaRecebimentos: {},
  deparaProvisao: {},
  deparaProvisaoParcelas: {},
  planoContas: {},
  contasSemConciliacao: {},
  configGrupos: {},
  percentuaisRateioFixo: {},
  vinculosConciliacaoSalvos: {},
  updatedAt: null,
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleBase(req, res) {
  if (req.method === "GET") {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const rawMeta = existsSync(metaPath) ? await readFile(metaPath, "utf8") : null;
      const meta = rawMeta ? JSON.parse(rawMeta) : {};
      if (url.searchParams.get("meta") === "1") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ syncToken: meta.syncToken || "", updatedAt: meta.updatedAt || null }));
        return;
      }
      const raw = existsSync(basePath) ? await readFile(basePath, "utf8") : null;
      const data = raw ? await sobreporRegistrosDeGrupo(JSON.parse(raw)) : baseVazia;
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ...baseVazia, ...data, syncToken: meta.syncToken || data.updatedAt || "" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      if (!Array.isArray(body.grupos) || !body.depara || typeof body.depara !== "object") {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Formato invalido." }));
        return;
      }
      const rawAtual = existsSync(basePath) ? await readFile(basePath, "utf8") : null;
      const baseAtual = rawAtual ? JSON.parse(rawAtual) : baseVazia;
      const resultado = prepararBasePersistida(baseAtual, body);
      const updatedAt = new Date().toISOString();
      const syncToken = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await mkdir(groupsPath, { recursive: true });
      if (resultado.modo === "grupos" && rawAtual) {
        const generation = baseAtual.__groupStorageGeneration || groupStorageVersion;
        await Promise.all(resultado.gruposAlterados.map((grupo) => writeFile(
          groupFilePath(generation, grupo),
          JSON.stringify(registroGrupo(body, grupo, updatedAt), null, 2),
        )));
      } else {
        const baseCompleta = rawAtual
          ? resultado.base
          : prepararBasePersistida({}, { ...body, __sync: { estruturaCompleta: true } }).base;
        const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await Promise.all((baseCompleta.grupos || []).map((grupo) => writeFile(
          groupFilePath(generation, grupo),
          JSON.stringify(registroGrupo(baseCompleta, grupo, updatedAt), null, 2),
        )));
        await writeFile(basePath, JSON.stringify({ ...baseVazia, ...baseCompleta, __groupStorageGeneration: generation, updatedAt }, null, 2));
      }
      await writeFile(metaPath, JSON.stringify({ syncToken, updatedAt }, null, 2));
      const modoPersistido = resultado.modo === "grupos" && rawAtual ? "grupos" : "completo";
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, updatedAt, syncToken, modo: modoPersistido, gruposAlterados: resultado.gruposAlterados }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Metodo nao permitido.");
}

async function handleStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = resolve(root, normalize(relative));

  if (!target.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso negado.");
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    res.writeHead(200, {
      "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Nao encontrado.");
  }
}

const server = createServer((req, res) => {
  if ((req.url || "").startsWith("/.netlify/functions/depara-base")) {
    handleBase(req, res);
    return;
  }
  handleStatic(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aromas Rateio em http://127.0.0.1:${port}/`);
});
