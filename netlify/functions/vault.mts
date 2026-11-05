import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { loveNotes, moodLog, bucketItems, vaultCounters } from "../../db/schema.js";

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
/** Parse a JSON body; anything that isn't a plain object (null, arrays, bad JSON) becomes {}. */
const readBody = async (req: Request): Promise<Record<string, any>> => {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? b : {};
};

/* Login brute-force guard: after too many wrong passwords from one IP, wait a while. */
const MAX_FAILS = 8;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
type Fails = { n: number; first: number };
const failKey = (ip: string) => "_fails/" + (ip || "unknown").replace(/[^a-zA-Z0-9.:_-]/g, "").slice(0, 64);
async function readFails(ip: string): Promise<Fails> {
  const f = (await store().get(failKey(ip), { type: "json" }).catch(() => null)) as Fails | null;
  return f && Date.now() - f.first < FAIL_WINDOW_MS ? f : { n: 0, first: Date.now() };
}

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

/* ---------- Telegram notifications (activity in the room → owner's bot) ----------
 * TELEGRAM_BOT_TOKEN is required. TELEGRAM_CHAT_ID is optional: when it is missing, the chat of
 * whoever last messaged the bot (e.g. "/start") is looked up once via getUpdates and remembered. */
async function telegramChat(bot: string): Promise<string | null> {
  const fixed = process.env.TELEGRAM_CHAT_ID;
  if (fixed) return fixed;
  const saved = await store().get("_tg_chat").catch(() => null);
  if (saved) return saved;
  const r = await fetch(`https://api.telegram.org/bot${bot}/getUpdates?limit=50`).catch(() => null);
  const j: any = r && r.ok ? await r.json().catch(() => null) : null;
  const msgs = (j?.result || []).map((u: any) => u.message || u.edited_message).filter((m: any) => m?.chat?.id);
  const chat = msgs.length ? String(msgs[msgs.length - 1].chat.id) : null;
  if (chat) await store().set("_tg_chat", chat).catch(() => {});
  return chat;
}
async function telegram(text: string): Promise<boolean> {
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  if (!bot) return false;
  try {
    const chat = await telegramChat(bot);
    if (!chat) { console.warn("telegram: no chat yet — send /start to the bot first"); return false; }
    const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const r = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: `${text}\n\n🕒 ${time} WIB`, disable_web_page_preview: true }),
    });
    if (!r.ok) console.warn("telegram send failed", r.status);
    return r.ok;
  } catch (err) {
    console.warn("telegram error", err);
    return false;
  }
}

export default async (req: Request, context: Context) => {
  try {
    return await handle(req, context);
  } catch (err) {
    console.error("vault error", err);
    return fail("Server sedang sibuk, coba lagi ya 🙏", 500);
  }
};

async function handle(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/api\/vault\/?/, "");
  const s = store();

  if (action === "login" && req.method === "POST") {
    const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "";
    const fails = await readFails(ip);
    if (fails.n >= MAX_FAILS) {
      const mins = Math.max(1, Math.ceil((fails.first + FAIL_WINDOW_MS - Date.now()) / 60000));
      return fail(`Terlalu banyak percobaan. Coba lagi ${mins} menit lagi ya`, 429);
    }
    const body = await readBody(req);
    const u = String(body.u || "").trim().toLowerCase().slice(0, 200);
    const p = String(body.p || "").slice(0, 200);
    if (!safeEq(await sha256(`${u}:${p}`), CRED_HASH)) {
      await store().setJSON(failKey(ip), { n: fails.n + 1, first: fails.first }).catch(() => {});
      await new Promise((r) => setTimeout(r, 700));
      return fail("Username atau password salah", 401);
    }
    if (fails.n) await store().delete(failKey(ip)).catch(() => {});
    const key = (await secret(true))!;
    const exp = String(Date.now() + TOKEN_DAYS * 864e5);
    const ping = telegram("🔐 Dia baru saja masuk ke Ruang Rahasia 💗");
    if (typeof (context as any).waitUntil === "function") (context as any).waitUntil(ping); else await ping;
    return json({ token: `${exp}.${await sign(exp, key)}` });
  }

  if (!(await authed(req))) return fail("Sesi berakhir, silakan masuk lagi", 401);

  if (action === "check") return json({ ok: true });

  if (action === "notify" && req.method === "POST") {
    const body = await readBody(req);
    const text = String(body.text || "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, 900);
    if (!text) return fail("Pesan kosong");
    const sent = await telegram(text);
    return json({ ok: sent });
  }

  if (action === "list" && req.method === "GET") {
    const { blobs } = await s.list({ prefix: "meta/" });
    const metas = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<Meta | null>));
    const saved = metas.filter((m): m is Meta => !!m && m.done);
    // Housekeeping: uploads that were abandoned more than a day ago only waste storage.
    const stale = metas.filter((m): m is Meta => !!m && !m.done && Date.now() - m.created > 864e5);
    if (stale.length) {
      await Promise.all(stale.map(async (m) => {
        const { blobs: parts } = await s.list({ prefix: `chunk/${m.id}/` });
        await Promise.all(parts.map((b) => s.delete(b.key)));
        await s.delete(`meta/${m.id}`);
      })).catch((err) => console.error("vault cleanup", err));
    }
    const items = [...motions().map(({ file, thumb, ...m }) => ({ ...m, hasThumb: !!thumb })), ...saved].sort((a, b) => b.created - a.created);
    return json({ items, chunk: CHUNK });
  }

  /* ---------- Ruang Rahasia: notes, mood, bucket list, kangen counter ---------- */
  const room = await roomRoutes(action, req, url);
  if (room) return room;

  if (action === "init" && req.method === "POST") {
    const body = await readBody(req);
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
    if (meta.done) return fail("Video ini sudah selesai diupload", 409);
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
    const body = await readBody(req);
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
}

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, n);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const NOTE_COLORS = ["pink", "lilac", "mint", "peach", "sky"] as const;
const MOODS = ["bahagia", "kangen", "santai", "capek", "sedih", "semangat"] as const;
const numId = (url: URL) => {
  const n = Number(url.searchParams.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
};
const ROOM_ACTIONS = new Set(["room", "notes", "notes/pin", "mood", "bucket", "bucket/toggle", "kangen", "count", "coupon", "since"]);
const COUNT_KEYS = ["peluk", "cium"] as const;
const sticker = (v: unknown, d: string) => clip(v, 8) || d;

async function roomRoutes(action: string, req: Request, url: URL): Promise<Response | null> {
  if (!ROOM_ACTIONS.has(action)) return null;
  const m = req.method;
  const body = m === "POST" || m === "PUT" ? await readBody(req) : {};

  if (action === "room" && m === "GET") {
    const since = new Date(Date.now() - 62 * 864e5).toISOString().slice(0, 10);
    const [notes, moods, bucket, counters] = await Promise.all([
      db.select().from(loveNotes).orderBy(desc(loveNotes.pinned), desc(loveNotes.createdAt)).limit(200),
      db.select().from(moodLog).where(gte(moodLog.day, since)).orderBy(desc(moodLog.day)),
      db.select().from(bucketItems).orderBy(bucketItems.done, desc(bucketItems.createdAt)).limit(200),
      db.select().from(vaultCounters),
    ]);
    return json({ notes, moods, bucket, counters: Object.fromEntries(counters.map((c) => [c.key, c.value])) });
  }

  if (action === "notes" && m === "POST") {
    const text = clip(body.body, 600);
    if (!text) return fail("Suratnya masih kosong");
    const [note] = await db.insert(loveNotes).values({
      body: text, color: pick(body.color, NOTE_COLORS, "pink"), sticker: sticker(body.sticker, "💌"),
    }).returning();
    return json({ note });
  }
  if (action === "notes/pin" && m === "POST") {
    const id = numId(url); if (!id) return fail("ID tidak valid");
    const [note] = await db.update(loveNotes).set({ pinned: sql`not ${loveNotes.pinned}` }).where(eq(loveNotes.id, id)).returning();
    return note ? json({ note }) : fail("Surat tidak ditemukan", 404);
  }
  if (action === "notes" && m === "DELETE") {
    const id = numId(url); if (!id) return fail("ID tidak valid");
    await db.delete(loveNotes).where(eq(loveNotes.id, id));
    return json({ ok: true });
  }

  if (action === "mood" && m === "PUT") {
    const day = String(body.day || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("Tanggal tidak valid");
    const mood = pick(body.mood, MOODS, "bahagia"), note = clip(body.note, 140);
    const [row] = await db.insert(moodLog).values({ day, mood, note })
      .onConflictDoUpdate({ target: moodLog.day, set: { mood, note, updatedAt: new Date() } }).returning();
    return json({ mood: row });
  }

  if (action === "bucket" && m === "POST") {
    const text = clip(body.text, 120);
    if (!text) return fail("Tulis mimpinya dulu ya");
    const [item] = await db.insert(bucketItems).values({ text, emoji: sticker(body.emoji, "✨") }).returning();
    return json({ item });
  }
  if (action === "bucket/toggle" && m === "POST") {
    const id = numId(url); if (!id) return fail("ID tidak valid");
    const [item] = await db.update(bucketItems)
      .set({ done: sql`not ${bucketItems.done}`, doneAt: sql`case when ${bucketItems.done} then null else now() end` })
      .where(eq(bucketItems.id, id)).returning();
    return item ? json({ item }) : fail("Tidak ditemukan", 404);
  }
  if (action === "bucket" && m === "DELETE") {
    const id = numId(url); if (!id) return fail("ID tidak valid");
    await db.delete(bucketItems).where(eq(bucketItems.id, id));
    return json({ ok: true });
  }

  if (action === "kangen" && m === "POST") {
    const n = Math.min(50, Math.max(1, Math.floor(Number(body.n) || 1)));
    const [row] = await db.insert(vaultCounters).values({ key: "kangen", value: n })
      .onConflictDoUpdate({ target: vaultCounters.key, set: { value: sql`${vaultCounters.value} + ${n}` } }).returning();
    return json({ value: row.value });
  }

  /* "Untukmu" tab: virtual hugs/kisses, love coupons and the day we got together */
  if (action === "count" && m === "POST") {
    const key = pick(body.key, COUNT_KEYS, "peluk");
    const n = Math.min(50, Math.max(1, Math.floor(Number(body.n) || 1)));
    const [row] = await db.insert(vaultCounters).values({ key, value: n })
      .onConflictDoUpdate({ target: vaultCounters.key, set: { value: sql`${vaultCounters.value} + ${n}` } }).returning();
    return json({ key, value: row.value });
  }
  if (action === "coupon" && m === "POST") {
    const id = String(body.id || "");
    if (!/^[a-z0-9-]{1,30}$/.test(id)) return fail("Kupon tidak valid");
    const value = body.used ? Math.floor(Date.now() / 1000) : 0; // seconds since epoch when redeemed, 0 = unused
    const key = "coupon:" + id;
    const [row] = await db.insert(vaultCounters).values({ key, value })
      .onConflictDoUpdate({ target: vaultCounters.key, set: { value } }).returning();
    return json({ key, value: row.value });
  }
  if (action === "since" && m === "PUT") {
    const day = String(body.day || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return fail("Tanggal tidak valid");
    const value = Number(day.replace(/-/g, ""));
    const [row] = await db.insert(vaultCounters).values({ key: "since", value })
      .onConflictDoUpdate({ target: vaultCounters.key, set: { value } }).returning();
    return json({ value: row.value });
  }

  return null;
}

export const config: Config = { path: "/api/vault/*" };
