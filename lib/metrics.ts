import type { Group, Progress, Video } from "./types";

const DAY = 86400000;
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const fmtDur = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };
export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const cardKey = (v: Video, i: number) => `${v.id}#${i}`;
export const vidXP = (v: Video) => Math.round(v.secs / 60) * 10 + 20;

export const RANKS: [number, string][] = [[0, "Beginner"], [300, "Apprentice"], [900, "Practitioner"], [1800, "Skilled"], [3000, "Advanced"], [4500, "Expert"], [6500, "Master"]];
export function rankOf(xp: number) {
  let i = 0; for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k][0]) i = k;
  return { name: RANKS[i][1], floor: RANKS[i][0], next: RANKS[i + 1] ?? null };
}

export function coreVideos(g: Group) {
  const bonus = new Set(g.levels.filter((l) => l.bonus).map((l) => l.id));
  return g.videos.filter((v) => !bonus.has(v.level));
}
export function orderedVideos(g: Group) {
  const out: Video[] = [];
  for (const l of g.levels) out.push(...g.videos.filter((v) => v.level === l.id));
  out.push(...g.videos.filter((v) => !g.levels.find((l) => l.id === v.level)));
  return out;
}
export function nextVideo(g: Group, p: Progress) {
  const core = orderedVideos(g).filter((v) => !g.levels.find((l) => l.id === v.level)?.bonus);
  return core.find((v) => !p.done[v.id]) ?? orderedVideos(g).find((v) => !p.done[v.id]) ?? null;
}

export function xpOf(g: Group, p: Progress) {
  let x = 0;
  for (const v of g.videos) if (p.done[v.id]) x += vidXP(v);
  x += Object.values(p.recall).filter(Boolean).length * 20;
  x += Object.keys(p.challenges).length * 100;
  x += p.reviews.filter((r) => r.ok).length * 2;
  x += Object.values(p.scenarios).reduce((s, a) => s + Math.round(a.score / 2), 0);
  return x;
}

export function activityByDay(g: Group, p: Progress) {
  const m: Record<string, number> = {};
  const add = (t: number, secs: number) => { const k = dayKey(t); m[k] = (m[k] ?? 0) + secs; };
  const byId = new Map(g.videos.map((v) => [v.id, v]));
  for (const [id, t] of Object.entries(p.done)) add(t, byId.get(id)?.secs ?? 0);
  for (const r of p.reviews) add(r.t, 20);
  for (const a of Object.values(p.scenarios)) add(a.t, 180);
  for (const t of Object.values(p.challenges)) add(t, 600);
  return m; // day -> seconds
}

export function mergeActivity(maps: Record<string, number>[]) {
  const out: Record<string, number> = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function streakOf(act: Record<string, number>) {
  let n = 0; const d = new Date();
  if (!act[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  while (act[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function groupStats(g: Group, p: Progress) {
  const all = g.videos, core = coreVideos(g);
  const done = all.filter((v) => p.done[v.id]);
  const watchedSecs = done.reduce((s, v) => s + v.secs, 0);
  const totalSecs = all.reduce((s, v) => s + v.secs, 0);
  const cards = all.flatMap((v) => v.cards.map((c, i) => ({ key: cardKey(v, i), v })));
  const mastered = cards.filter((c) => (p.cards[c.key]?.box ?? 0) >= 2).length;
  const now = Date.now();
  const unlocked = cards.filter((c) => p.done[c.v.id]);
  const due = unlocked.filter((c) => (p.cards[c.key]?.due ?? 0) <= now).length;
  const reviewsOk = p.reviews.filter((r) => r.ok).length;
  const recallRate = p.reviews.length ? reviewsOk / p.reviews.length : 0;
  const recallVals = Object.values(p.recall);
  const quickRecall = recallVals.length ? recallVals.filter(Boolean).length / recallVals.length : 0;
  const levelsCore = g.levels.filter((l) => !l.bonus && all.some((v) => v.level === l.id));
  const challengesDone = levelsCore.filter((l) => p.challenges[l.id]).length;
  const scen = g.scenarios.map((s) => p.scenarios[s.id]?.score ?? 0);
  const scenAvg = scen.length ? scen.reduce((a, b) => a + b, 0) / scen.length / 100 : 0;
  const answered = g.scenarios.filter((s) => p.scenarios[s.id]).length;

  const learned = core.length ? core.filter((v) => p.done[v.id]).length / core.length : 0;
  const practiced = cards.length ? 0.7 * (mastered / cards.length) + 0.3 * Math.max(recallRate, quickRecall) * (unlocked.length / cards.length) : 0;
  const applied = 0.5 * (levelsCore.length ? challengesDone / levelsCore.length : 0) + 0.5 * scenAvg;
  const readiness = Math.round(100 * (0.3 * learned + 0.3 * practiced + 0.4 * applied));
  const act = activityByDay(g, p);

  return {
    total: all.length, done: done.length, pct: all.length ? done.length / all.length : 0,
    coreTotal: core.length, coreDone: core.filter((v) => p.done[v.id]).length,
    watchedSecs, totalSecs, leftSecs: totalSecs - watchedSecs,
    cards: cards.length, mastered, due, recallRate, reviews: p.reviews.length,
    challengesDone, challengesTotal: levelsCore.length, scenarioAnswered: answered, scenarioTotal: g.scenarios.length, scenAvg,
    learned, practiced, applied, readiness, xp: xpOf(g, p), streak: streakOf(act), act,
  };
}
export type GroupStats = ReturnType<typeof groupStats>;

export function conceptCoverage(g: Group, p: Progress) {
  const names = [...new Set(g.videos.flatMap((v) => v.concepts))];
  return names.map((name) => {
    const vs = g.videos.filter((v) => v.concepts.includes(name));
    const learned = vs.filter((v) => p.done[v.id]).length / vs.length;
    const keys = vs.flatMap((v) => v.cards.map((_, i) => cardKey(v, i)));
    const practiced = keys.length ? keys.filter((k) => (p.cards[k]?.box ?? 0) >= 2).length / keys.length : 0;
    const sc = g.scenarios.filter((s) => s.concepts.includes(name));
    let applied: number;
    if (sc.length) applied = sc.reduce((s, x) => s + (p.scenarios[x.id]?.score ?? 0), 0) / sc.length / 100;
    else {
      const lv = [...new Set(vs.map((v) => v.level))];
      applied = lv.length ? lv.filter((l) => p.challenges[l]).length / lv.length : 0;
    }
    const overdue = keys.filter((k) => p.cards[k] && p.cards[k].box > 0 && p.cards[k].due < Date.now()).length;
    return { name, videos: vs.length, learned, practiced, applied, overdue };
  }).sort((a, b) => b.videos - a.videos);
}

export function retentionSeries(reviews: Progress["reviews"], weeks = 8) {
  const now = Date.now(), out: { label: string; acc: number | null; n: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const from = now - (w + 1) * 7 * DAY, to = now - w * 7 * DAY;
    const rs = reviews.filter((r) => r.t > from && r.t <= to);
    const d = new Date(to);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, acc: rs.length ? rs.filter((r) => r.ok).length / rs.length : null, n: rs.length });
  }
  return out;
}

export function channelStats(g: Group, p: Progress) {
  const m = new Map<string, { id: string; title: string; total: number; done: number; secs: number }>();
  for (const v of g.videos) {
    const c = m.get(v.channelId) ?? { id: v.channelId, title: v.channelTitle, total: 0, done: 0, secs: 0 };
    c.total++; if (p.done[v.id]) { c.done++; c.secs += v.secs; }
    m.set(v.channelId, c);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function lastNDays(act: Record<string, number>, n: number) {
  const out: { key: string; label: string; secs: number }[] = [];
  const d = new Date(); d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const k = dayKey(d.getTime());
    out.push({ key: k, label: d.toLocaleDateString([], { weekday: "short" }).slice(0, 2), secs: act[k] ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function readinessLabel(r: number) {
  if (r >= 70) return "Applied";
  if (r >= 40) return "Practised";
  if (r >= 10) return "Learned";
  return "Starting";
}
