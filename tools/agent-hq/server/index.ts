/**
 * Agent HQ API server.
 *   POST /api/agent-status   agents report { agentId, status, currentTask, progress, activity }
 *   GET  /api/health         configuration and reachability
 *   GET  /*                  the built app from dist/ (after `pnpm build`)
 * Writes go to Supabase with the service role key; the browser only ever reads.
 */
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type ActivityRow,
  type AgentRow,
  activityFromRow,
  agentFromRow,
} from "../src/data/live/rows.ts";
import { buildAgentUpdate, checkApiKey, parseReport, presentedKey } from "./report.ts";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const API_KEY = process.env.AGENT_HQ_API_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DIST = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const MAX_BODY = 64 * 1024;

const supabase: SupabaseClient | null =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function handleReport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!API_KEY) {
    sendJson(res, 503, { ok: false, error: "AGENT_HQ_API_KEY is not set on the server" });
    return;
  }
  if (!checkApiKey(presentedKey(req.headers), API_KEY)) {
    sendJson(res, 401, { ok: false, error: "invalid or missing API key" });
    return;
  }
  if (!supabase) {
    sendJson(res, 503, { ok: false, error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" });
    return;
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : "invalid JSON" });
    return;
  }
  const parsed = parseReport(body);
  if (!parsed.ok) {
    sendJson(res, 400, { ok: false, errors: parsed.errors });
    return;
  }
  const { report } = parsed;

  const { data: existing, error: readError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", report.agentId)
    .maybeSingle();
  if (readError) {
    sendJson(res, 502, { ok: false, error: readError.message });
    return;
  }
  if (!existing) {
    sendJson(res, 404, { ok: false, error: `unknown agent "${report.agentId}"; add it first` });
    return;
  }
  const row = existing as AgentRow;
  const update = buildAgentUpdate(row, report, new Date());

  let saved: AgentRow = row;
  if (Object.keys(update.patch).length > 0) {
    const { data, error } = await supabase
      .from("agents")
      .update(update.patch)
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) {
      sendJson(res, 502, { ok: false, error: error.message });
      return;
    }
    saved = data as AgentRow;
  }
  if (update.activity.length > 0) {
    const { error } = await supabase
      .from("agent_activity")
      .insert(
        update.activity.map((a) => ({ agent_id: row.id, text: a.text, kind: a.kind ?? null })),
      );
    if (error) {
      sendJson(res, 502, { ok: false, error: error.message });
      return;
    }
  }
  const { data: recent } = await supabase
    .from("agent_activity")
    .select("*")
    .eq("agent_id", row.id)
    .order("time", { ascending: false })
    .limit(10);
  const activity = ((recent ?? []) as ActivityRow[]).reverse().map(activityFromRow);
  sendJson(res, 200, {
    ok: true,
    statusChanged: update.statusChanged,
    agent: agentFromRow(saved, activity),
  });
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [join(DIST, safe), join(DIST, "index.html")];
  for (const file of candidates) {
    if (!file.startsWith(DIST)) continue;
    try {
      const data = await readFile(file);
      const type = MIME[extname(file)] ?? "application/octet-stream";
      const immutable = file.includes(`${join(DIST, "assets")}`);
      res.writeHead(200, {
        "content-type": type,
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      });
      res.end(data);
      return;
    } catch {
      // try the next candidate
    }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found; run `pnpm build` first");
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const route = async () => {
    if (url.pathname === "/api/agent-status") {
      if (req.method !== "POST") {
        res.writeHead(405, { allow: "POST", "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "use POST" }));
        return;
      }
      await handleReport(req, res);
      return;
    }
    if (url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        supabase: supabase !== null,
        apiKey: API_KEY.length > 0,
        time: new Date().toISOString(),
      });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { ok: false, error: "no such endpoint" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    await serveStatic(url.pathname, res);
  };
  route().catch((e: unknown) => {
    console.error(e);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: "internal error" });
  });
});

server.listen(PORT, HOST, () => {
  const live = supabase ? "connected to Supabase" : "no Supabase credentials (reports will 503)";
  const key = API_KEY ? "API key set" : "AGENT_HQ_API_KEY missing (reports will 503)";
  console.log(`agent-hq api on http://${HOST}:${PORT}  |  ${live}  |  ${key}`);
});
