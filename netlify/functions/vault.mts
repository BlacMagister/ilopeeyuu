import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";

/*
 * Private video vault behind the header menu login.
 * Files are stored in Netlify Blobs as 3 MB chunks so uploads and downloads stay
 * under the function payload limit regardless of the video size.
 *   meta/<id>       JSON description of a video
 *   chunk/<id>/<n>  binary chunk n
 *   _secret         random HMAC key used to sign session tokens (created on first login)
 *
 * Motion videos generated for this site live in vault-motions/ (listed in
 * vault-motions/manifest.json). They are bundled with this function and show up
 * in the vault automatically — nobody has to upload them. They are read-only.
 */

const CHUNK = 3 * 1024 * 1024;
const MAX_CHUNKS = 700; // ~2 GB per video
const TOKEN_DAYS = 30;
// sha256("<username lowercased>:<password>") — the plain credentials are never stored
const CRED_HASH = "87fec5534251d72e5c639bb3cb3a8d4c004782f295524267d1fb5ce8757ce0bc";

type Meta = { id: string; name: string; type: string; size: number; chunks: number; created: number; done: boolean };

const store = () => getStore({ name: "vault", consistency: "strong" });
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const rid = (n = 12) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer);

async function secret(create = false): Promise<string | null> {
  const s = store();
  let key = (await s.get("_secret", { type: "text" })) as string | null;
  if (!key && create) {
    key = rid(32);
    await s.set("_secret", key);
  }
  return key;
}
async function sign(payload: string, key: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(payload)));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function authed(req: Request) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [exp, sig] = tok.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const key = await secret();
  return !!key && safeEq(sig, await sign(exp, key));
}

/* ---------- generated motions bundled with the function ---------- */
type Motion = { id: string; file: string; name: string; type?: string; created: string; desc?: string; thumb?: string };
const MOTION_DIR = [join(process.cwd(), "vault-motions"), join(process.cwd(), "..", "vault-motions")].find((d) =>
  existsSync(join(d, "manifest.json")),
);
function motions(): (Meta & { builtin: true; desc?: string; file: string; thumb?: string })[] {
  if (!MOTION_DIR) return [];
  try {
    const list = JSON.parse(readFileSync(join(MOTION_DIR, "manifest.json"), "utf8")) as Motion[];
    return list.flatMap((m) => {
      const path = join(MOTION_DIR, m.file);
      if (!/^[a-z0-9-]+$/.test(m.id) || m.file.includes("..") || !existsSync(path)) return [];
      const size = statSync(path).size;
      const thumb = m.thumb && !m.thumb.includes("..") && existsSync(join(MOTION_DIR, m.thumb)) ? join(MOTION_DIR, m.thumb) : undefined;
      return [{
        id: "m-" + m.id, name: m.name, type: m.type || "video/mp4", size, chunks: Math.ceil(size / CHUNK),
        created: Date.parse(m.created) || 0, done: true, builtin: true as const, desc: m.desc, file: path, thumb,
      }];
    });
  } catch {
    return [];
  }
}
function readPart(path: string, n: number) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(CHUNK);
    const len = readSync(fd, buf, 0, CHUNK, n * CHUNK);
    return buf.subarray(0, len);
  } finally {
    closeSync(fd);
  }
}

const validId = (id: string | null): id is string => !!id && /^[a-f0-9]{24}$/.test(id);
const cleanName = (n: unknown) =>
  String(n || "video").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120) || "video";

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/api\/vault\/?/, "");
  const s = store();

  if (action === "login" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const u = String(body.u || "").trim().toLowerCase();
    const p = String(body.p || "");
    if (!safeEq(await sha256(`${u}:${p}`), CRED_HASH)) {
      await new Promise((r) => setTimeout(r, 700));
      return fail("Username atau password salah", 401);
    }
    const key = (await secret(true))!;
    const exp = String(Date.now() + TOKEN_DAYS * 864e5);
    return json({ token: `${exp}.${await sign(exp, key)}` });
  }

  if (!(await authed(req))) return fail("Sesi berakhir, silakan masuk lagi", 401);

  if (action === "check") return json({ ok: true });

  if (action === "list" && req.method === "GET") {
    const { blobs } = await s.list({ prefix: "meta/" });
    const saved = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<Meta | null>)))
      .filter((m): m is Meta => !!m && m.done);
    const items = [...motions().map(({ file, thumb, ...m }) => ({ ...m, hasThumb: !!thumb })), ...saved].sort((a, b) => b.created - a.created);
    return json({ items, chunk: CHUNK });
  }

  if (action === "init" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const size = Number(body.size);
    if (!(size > 0)) return fail("File kosong");
    const chunks = Math.ceil(size / CHUNK);
    if (chunks > MAX_CHUNKS) return fail("File terlalu besar");
    const meta: Meta = {
      id: rid(),
      name: cleanName(body.name),
      type: String(body.type || "video/mp4").slice(0, 80),
      size,
      chunks,
      created: Date.now(),
      done: false,
    };
    await s.setJSON(`meta/${meta.id}`, meta);
    return json({ id: meta.id, chunk: CHUNK, chunks });
  }

  const id = url.searchParams.get("id");
  if (id?.startsWith("m-")) {
    const m = motions().find((x) => x.id === id);
    if (!m) return fail("Video tidak ditemukan", 404);
    if (action === "thumb" && req.method === "GET" && m.thumb)
      return new Response(readFileSync(m.thumb), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" } });
    const n = Number(url.searchParams.get("n"));
    if (action !== "chunk" || req.method !== "GET") return fail("Video ini tidak bisa diubah", 403);
    if (!(Number.isInteger(n) && n >= 0 && n < m.chunks)) return fail("Bagian tidak valid");
    return new Response(readPart(m.file, n), {
      headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=3600" },
    });
  }
  if (!validId(id)) return fail("ID tidak valid");
  const meta = (await s.get(`meta/${id}`, { type: "json" })) as Meta | null;
  if (!meta) return fail("Video tidak ditemukan", 404);
  const n = Number(url.searchParams.get("n"));
  const validN = Number.isInteger(n) && n >= 0 && n < meta.chunks;

  if (action === "chunk" && req.method === "PUT") {
    if (!validN) return fail("Bagian tidak valid");
    const data = await req.arrayBuffer();
    if (!data.byteLength || data.byteLength > CHUNK) return fail("Ukuran bagian tidak valid");
    await s.set(`chunk/${id}/${n}`, data);
    return json({ ok: true });
  }

  if (action === "done" && req.method === "POST") {
    const { blobs } = await s.list({ prefix: `chunk/${id}/` });
    if (blobs.length < meta.chunks) return fail("Upload belum lengkap");
    meta.done = true;
    await s.setJSON(`meta/${id}`, meta);
    return json({ item: meta });
  }

  if (action === "chunk" && req.method === "GET") {
    if (!validN) return fail("Bagian tidak valid");
    const data = (await s.get(`chunk/${id}/${n}`, { type: "arrayBuffer" })) as ArrayBuffer | null;
    if (!data) return fail("Bagian hilang", 404);
    return new Response(data, {
      headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=86400" },
    });
  }

  if (action === "rename" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    meta.name = cleanName(body.name);
    await s.setJSON(`meta/${id}`, meta);
    return json({ item: meta });
  }

  if (action === "item" && req.method === "DELETE") {
    const { blobs } = await s.list({ prefix: `chunk/${id}/` });
    await Promise.all(blobs.map((b) => s.delete(b.key)));
    await s.delete(`meta/${id}`);
    return json({ ok: true });
  }

  return fail("Tidak ditemukan", 404);
};

export const config: Config = { path: "/api/vault/*" };
