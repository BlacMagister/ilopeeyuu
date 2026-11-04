import type { Config, Context } from "@netlify/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { deviceProgress } from "../../db/schema.js";

/*
 * Per-device progress backup.
 * Every browser gets its own device code (e.g. "K7QM-2XPA-9RTD"). The study
 * games keep saving to localStorage as before; assets/device-sync.js mirrors a
 * snapshot of those keys here so progress survives closing the browser,
 * clearing site data, or moving to a new browser with the same code.
 *
 * GET  /api/progress?id=CODE  → { id, data, updatedAt } (404 if unknown)
 * GET  /api/progress          → same, using the device cookie (restore after storage wipe)
 * PUT  /api/progress          → body { id, data } — upserts the snapshot
 */

const COOKIE = "sakura_device";
const ID_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const MAX_BYTES = 900_000;
const YEAR = 60 * 60 * 24 * 400;

const cleanId = (v: unknown) => {
  const s = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 12) return null;
  const id = `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  return ID_RE.test(id) ? id : null;
};

const json = (data: unknown, status = 200, id?: string | null) => {
  const headers = new Headers({ "cache-control": "no-store" });
  if (id) headers.append("set-cookie", `${COOKIE}=${id}; Path=/; Max-Age=${YEAR}; SameSite=Lax; Secure; HttpOnly`);
  return Response.json(data, { status, headers });
};

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const fromQuery = url.searchParams.get("id");
    const id = cleanId(fromQuery ?? context.cookies.get(COOKIE));
    if (!id) return json({ error: "not_found" }, 404);
    const [row] = await db.select().from(deviceProgress).where(eq(deviceProgress.deviceId, id)).limit(1);
    if (!row) return json({ error: "not_found", id }, 404);
    return json({ id, data: row.data, updatedAt: row.updatedAt.getTime() }, 200, id);
  }

  if (req.method === "PUT" || req.method === "POST") {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: "too_large" }, 413);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }
    const id = cleanId(body?.id);
    const data = body?.data;
    if (!id) return json({ error: "bad_id" }, 400);
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad_data" }, 400);
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof k === "string" && k.length <= 80 && typeof v === "string") clean[k] = v;
    }
    const [row] = await db
      .insert(deviceProgress)
      .values({ deviceId: id, data: clean })
      .onConflictDoUpdate({ target: deviceProgress.deviceId, set: { data: clean, updatedAt: sql`now()` } })
      .returning({ updatedAt: deviceProgress.updatedAt });
    return json({ ok: true, id, updatedAt: row.updatedAt.getTime() }, 200, id);
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config: Config = { path: "/api/progress" };
