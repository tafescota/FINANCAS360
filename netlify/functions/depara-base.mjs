import { getStore } from "@netlify/blobs";

const BLOB_KEY = "base";

export default async (req, context) => {
  const store = getStore("depara");

  // GET — retorna a base atual
  if (req.method === "GET") {
    try {
      const raw = await store.get(BLOB_KEY);
      if (!raw) {
        return Response.json({ grupos: [], depara: {}, planoContas: {}, updatedAt: null });
      }
      const data = JSON.parse(raw);
      return Response.json(data);
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
      const payload = JSON.stringify({ ...body, updatedAt: new Date().toISOString() });
      await store.set(BLOB_KEY, payload);
      return Response.json({ ok: true });
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
