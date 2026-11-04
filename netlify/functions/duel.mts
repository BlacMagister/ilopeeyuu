import type { Config } from "@netlify/functions";
import { and, eq, gt, lt, sql, asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { duelRooms, duelPlayers, duelAnswers } from "../../db/schema.js";
import KANJI from "../../lib/kanji-data.mjs";

/*
 * Duel Kanji — realtime multiplayer quiz.
 * The server owns every phase transition and timestamp, so all players see
 * the same question at the same moment. Clients poll /api/duel/state and
 * render using their measured server-clock offset.
 *
 * Phases: lobby → countdown → (question → reveal)×N → finished
 * A question ends as soon as every online player has answered, or when time runs out.
 */

type Kind = "meaning" | "reading" | "reverse";
type Settings = { from: number; to: number; count: number; seconds: number; kind: Kind | "mix" };
type Question = { kind: Kind; prompt: string; sub?: string; choices: string[]; answer: number; idx: number };

const DATA = KANJI as [string, string, string][];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 8;
const COUNTDOWN_MS = 3500;
const REVEAL_MS = 4500;
const ONLINE_MS = 12000;
const GRACE_MS = 600;
const AVATARS = ["🐰", "🐱", "🐻", "🐼", "🦊", "🐸", "🐥", "🐨", "🐹", "🦄", "🐧", "🐯"];

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);

const rid = (n = 20) => {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const cleanName = (s: unknown) =>
  String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Pemain";

function sanitizeSettings(raw: any): Settings {
  const N = DATA.length;
  let from = clamp(parseInt(raw?.from, 10) || 1, 1, N);
  let to = clamp(parseInt(raw?.to, 10) || N, 1, N);
  if (from > to) [from, to] = [to, from];
  const count = clamp(parseInt(raw?.count, 10) || 10, 3, 50);
  const seconds = clamp(parseInt(raw?.seconds, 10) || 15, 5, 30);
  const kind = ["meaning", "reading", "reverse", "mix"].includes(raw?.kind) ? raw.kind : "meaning";
  return { from, to, count, seconds, kind };
}

function buildQuestions(s: Settings): Question[] {
  const range = Array.from({ length: s.to - s.from + 1 }, (_, k) => s.from - 1 + k);
  const pool = range.length >= 8 ? range : Array.from({ length: DATA.length }, (_, k) => k);
  const picks = shuffle([...range]);
  while (picks.length < s.count) picks.push(...shuffle([...range]));
  const kinds: Kind[] = ["meaning", "reading", "reverse"];

  return picks.slice(0, s.count).map((idx, n) => {
    const kind: Kind = s.kind === "mix" ? kinds[n % 3] : s.kind;
    const [kanji, kana, arti] = DATA[idx];
    const field = kind === "meaning" ? 2 : kind === "reading" ? 1 : 0;
    const correct = DATA[idx][field];
    const seen = new Set([correct]);
    const wrong: string[] = [];
    for (const j of shuffle([...pool])) {
      const v = DATA[j][field];
      if (!seen.has(v) && DATA[j][0] !== kanji) { seen.add(v); wrong.push(v); }
      if (wrong.length === 3) break;
    }
    const choices = shuffle([correct, ...wrong]);
    return {
      kind, idx,
      prompt: kind === "reverse" ? arti : kanji,
      sub: kind === "reverse" ? kana : undefined,
      choices,
      answer: choices.indexOf(correct),
    };
  });
}

async function uniqueCode() {
  for (let t = 0; t < 12; t++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    const [hit] = await db.select({ c: duelRooms.code }).from(duelRooms).where(eq(duelRooms.code, code));
    if (!hit) return code;
  }
  throw new Error("Tidak bisa membuat kode room");
}

async function auth(code: string, pid: string, token: string) {
  if (!code || !pid || !token) return null;
  const [p] = await db.select().from(duelPlayers)
    .where(and(eq(duelPlayers.id, pid), eq(duelPlayers.roomCode, code)));
  if (!p || p.token !== token) return null;
  return p;
}

/** Advance the room state machine if its current phase is due. Idempotent across concurrent callers. */
async function tick(code: string) {
  for (let guard = 0; guard < 3; guard++) {
    const [room] = await db.select().from(duelRooms).where(eq(duelRooms.code, code));
    if (!room) return null;
    const now = Date.now();
    const ends = room.phaseEndsAt?.getTime() ?? 0;
    const qs = room.questions as Question[];
    const s = room.settings as Settings;
    const same = and(eq(duelRooms.code, code), eq(duelRooms.status, room.status), eq(duelRooms.qIndex, room.qIndex));
    let moved: unknown[] = [];

    if (room.status === "countdown" && now >= ends) {
      moved = await db.update(duelRooms)
        .set({ status: "question", qIndex: 0, phaseStartedAt: new Date(ends), phaseEndsAt: new Date(ends + s.seconds * 1000) })
        .where(same).returning({ c: duelRooms.code });
    } else if (room.status === "question") {
      let done = now >= ends + GRACE_MS;
      if (!done) {
        const online = await db.select({ id: duelPlayers.id }).from(duelPlayers)
          .where(and(eq(duelPlayers.roomCode, code), gt(duelPlayers.lastSeen, new Date(now - ONLINE_MS))));
        const answered = await db.select({ id: duelAnswers.playerId }).from(duelAnswers)
          .where(and(eq(duelAnswers.roomCode, code), eq(duelAnswers.qIndex, room.qIndex)));
        const set = new Set(answered.map((a) => a.id));
        done = online.length > 0 && online.every((p) => set.has(p.id));
      }
      if (!done) return room;
      {
        moved = await db.update(duelRooms)
          .set({ status: "reveal", phaseStartedAt: new Date(now), phaseEndsAt: new Date(now + REVEAL_MS) })
          .where(same).returning({ c: duelRooms.code });
      }
    } else if (room.status === "reveal" && now >= ends) {
      const last = room.qIndex + 1 >= qs.length;
      moved = await db.update(duelRooms)
        .set(last
          ? { status: "finished", phaseStartedAt: new Date(now), phaseEndsAt: null }
          : { status: "question", qIndex: room.qIndex + 1, phaseStartedAt: new Date(now + 250), phaseEndsAt: new Date(now + 250 + s.seconds * 1000) })
        .where(same).returning({ c: duelRooms.code });
    } else {
      return room;
    }
    void moved; // advanced (by us or a concurrent caller) — re-read and check the next phase
  }
  const [room] = await db.select().from(duelRooms).where(eq(duelRooms.code, code));
  return room ?? null;
}

async function snapshot(code: string, me: string) {
  const room = await tick(code);
  if (!room) return null;
  const now = Date.now();
  const qs = room.questions as Question[];
  const players = await db.select().from(duelPlayers).where(eq(duelPlayers.roomCode, code)).orderBy(asc(duelPlayers.joinedAt));
  const showQ = room.status === "question" || room.status === "reveal";
  const answers = showQ
    ? await db.select().from(duelAnswers).where(and(eq(duelAnswers.roomCode, code), eq(duelAnswers.qIndex, room.qIndex)))
    : [];
  const byPlayer = new Map(answers.map((a) => [a.playerId, a]));
  const reveal = room.status === "reveal";
  const q = showQ ? qs[room.qIndex] : null;

  let question: any = null;
  if (q) {
    const mine = byPlayer.get(me);
    question = { kind: q.kind, prompt: q.prompt, sub: q.sub, choices: q.choices };
    if (reveal) {
      const [k, kana, arti] = DATA[q.idx];
      question.answer = q.answer;
      question.card = { kanji: k, kana, arti };
    } else if (mine) {
      question.answer = q.answer; // you already locked in — safe to tell you
    }
    question.myChoice = mine ? mine.choice : null;
  }

  return {
    serverNow: now,
    me,
    room: {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      settings: room.settings,
      qIndex: room.qIndex,
      total: qs.length || (room.settings as Settings).count,
      phaseStartedAt: room.phaseStartedAt?.getTime() ?? null,
      phaseEndsAt: room.phaseEndsAt?.getTime() ?? null,
    },
    question,
    players: players.map((p) => {
      const a = byPlayer.get(p.id);
      return {
        id: p.id, name: p.name, avatar: p.avatar, score: p.score, streak: p.streak, correct: p.correctCount,
        online: now - p.lastSeen.getTime() < ONLINE_MS,
        answered: !!a,
        result: reveal && a ? { choice: a.choice, correct: a.correct, points: a.points, ms: a.ms } : null,
      };
    }),
  };
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();

  if (req.method === "GET" && action === "state") {
    const code = (url.searchParams.get("code") || "").toUpperCase();
    const p = await auth(code, url.searchParams.get("pid") || "", url.searchParams.get("token") || "");
    if (!p) return fail("Kamu bukan anggota room ini", 403);
    await db.update(duelPlayers).set({ lastSeen: new Date() }).where(eq(duelPlayers.id, p.id));
    const snap = await snapshot(code, p.id);
    return snap ? json(snap) : fail("Room tidak ditemukan", 404);
  }

  if (req.method !== "POST") return fail("Method not allowed", 405);
  const body: any = await req.json().catch(() => ({}));

  if (action === "create") {
    // Housekeeping: drop rooms older than 6 hours.
    await db.delete(duelRooms).where(lt(duelRooms.createdAt, new Date(Date.now() - 6 * 3600 * 1000)));
    const code = await uniqueCode();
    const pid = rid(12), token = rid(20);
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[0];
    await db.insert(duelRooms).values({ code, hostId: pid, settings: sanitizeSettings(body.settings) });
    await db.insert(duelPlayers).values({ id: pid, roomCode: code, token, name: cleanName(body.name), avatar });
    return json({ code, pid, token });
  }

  if (action === "join") {
    const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const [room] = await db.select().from(duelRooms).where(eq(duelRooms.code, code));
    if (!room) return fail("Kode room tidak ditemukan 🥺", 404);
    const existing = await auth(code, body.pid, body.token);
    if (existing) return json({ code, pid: existing.id, token: existing.token });
    if (room.status !== "lobby") return fail("Game di room ini sudah dimulai");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(duelPlayers).where(eq(duelPlayers.roomCode, code));
    if (n >= MAX_PLAYERS) return fail(`Room penuh (maks ${MAX_PLAYERS} pemain)`);
    const pid = rid(12), token = rid(20);
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[n % AVATARS.length];
    await db.insert(duelPlayers).values({ id: pid, roomCode: code, token, name: cleanName(body.name), avatar });
    return json({ code, pid, token });
  }

  const code = String(body.code || "").toUpperCase();
  const p = await auth(code, body.pid, body.token);
  if (!p) return fail("Kamu bukan anggota room ini", 403);
  const [room] = await db.select().from(duelRooms).where(eq(duelRooms.code, code));
  if (!room) return fail("Room tidak ditemukan", 404);
  const isHost = room.hostId === p.id;

  if (action === "settings") {
    if (!isHost) return fail("Hanya host yang bisa mengatur", 403);
    if (room.status !== "lobby" && room.status !== "finished") return fail("Game sedang berjalan");
    await db.update(duelRooms).set({ settings: sanitizeSettings(body.settings) }).where(eq(duelRooms.code, code));
    return json(await snapshot(code, p.id));
  }

  if (action === "start") {
    if (!isHost) return fail("Hanya host yang bisa memulai", 403);
    if (room.status !== "lobby" && room.status !== "finished") return fail("Game sudah berjalan");
    const s = sanitizeSettings(body.settings ?? room.settings);
    const now = Date.now();
    // Remove players who left (offline) before starting; reset scores for a fresh round.
    await db.delete(duelPlayers).where(and(eq(duelPlayers.roomCode, code), lt(duelPlayers.lastSeen, new Date(now - ONLINE_MS))));
    await db.delete(duelAnswers).where(eq(duelAnswers.roomCode, code));
    await db.update(duelPlayers).set({ score: 0, streak: 0, correctCount: 0 }).where(eq(duelPlayers.roomCode, code));
    await db.update(duelRooms).set({
      status: "countdown", settings: s, questions: buildQuestions(s), qIndex: -1,
      phaseStartedAt: new Date(now), phaseEndsAt: new Date(now + COUNTDOWN_MS),
    }).where(and(eq(duelRooms.code, code), eq(duelRooms.status, room.status)));
    return json(await snapshot(code, p.id));
  }

  if (action === "answer") {
    const cur = await tick(code);
    if (!cur || cur.status !== "question") return fail("Belum/tidak ada soal aktif", 409);
    const qi = parseInt(body.q, 10);
    if (qi !== cur.qIndex) return fail("Soal sudah berganti", 409);
    const q = (cur.questions as Question[])[qi];
    const choice = parseInt(body.choice, 10);
    if (!(choice >= 0 && choice < q.choices.length)) return fail("Pilihan tidak valid");
    const now = Date.now();
    const start = cur.phaseStartedAt!.getTime(), end = cur.phaseEndsAt!.getTime();
    if (now > end + GRACE_MS) return fail("Waktu habis ⏰", 409);
    const limit = end - start;
    const ms = clamp(now - start, 0, limit);
    const correct = choice === q.answer;
    // Faster = more points: 1000 at 0s down to 300 at the buzzer, plus a small streak bonus.
    const streak = correct ? p.streak + 1 : 0;
    const points = correct ? Math.round(1000 - 700 * (ms / limit)) + Math.min(streak - 1, 5) * 40 : 0;
    const inserted = await db.insert(duelAnswers)
      .values({ roomCode: code, playerId: p.id, qIndex: qi, choice, correct, points, ms })
      .onConflictDoNothing().returning({ id: duelAnswers.id });
    if (inserted.length) {
      await db.update(duelPlayers).set({
        score: sql`${duelPlayers.score} + ${points}`,
        streak,
        correctCount: correct ? sql`${duelPlayers.correctCount} + 1` : duelPlayers.correctCount,
        lastSeen: new Date(),
      }).where(eq(duelPlayers.id, p.id));
    }
    return json(await snapshot(code, p.id));
  }

  if (action === "leave") {
    await db.delete(duelPlayers).where(eq(duelPlayers.id, p.id));
    const rest = await db.select().from(duelPlayers).where(eq(duelPlayers.roomCode, code)).orderBy(asc(duelPlayers.joinedAt));
    if (!rest.length) await db.delete(duelRooms).where(eq(duelRooms.code, code));
    else if (isHost) await db.update(duelRooms).set({ hostId: rest[0].id }).where(eq(duelRooms.code, code));
    return json({ ok: true });
  }

  if (action === "lobby") {
    if (!isHost) return fail("Hanya host", 403);
    if (room.status !== "finished") return fail("Game belum selesai");
    await db.update(duelRooms).set({ status: "lobby", qIndex: -1, questions: [], phaseStartedAt: null, phaseEndsAt: null })
      .where(eq(duelRooms.code, code));
    await db.update(duelPlayers).set({ score: 0, streak: 0, correctCount: 0 }).where(eq(duelPlayers.roomCode, code));
    await db.delete(duelAnswers).where(eq(duelAnswers.roomCode, code));
    return json(await snapshot(code, p.id));
  }

  return fail("Aksi tidak dikenal", 404);
}

export default async (req: Request) => {
  try {
    return await handle(req);
  } catch (err) {
    console.error("duel error", err);
    return fail("Server sedang sibuk, coba lagi ya 🙏", 500);
  }
};

export const config: Config = { path: "/api/duel/*" };
