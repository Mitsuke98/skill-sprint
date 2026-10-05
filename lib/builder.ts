"use client";
import type { Group, Level, Video, Scenario, Source, CourseFile } from "./types";
import { uid } from "./store";

export type Mode = "video" | "channel" | "multi";
export type Method = "ai" | "tracker";
export type RawVideo = { id: string; title: string; desc: string; channelId: string; channelTitle: string; secs: number; publishedAt: string; chapters: string[] };
export type Log = (msg: string, pct?: number) => void;

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error || `Server error ${r.status}`);
  return j as T;
}

export async function fetchSources(inputs: string[]) {
  return post<{ sources: Source[]; videos: RawVideo[]; errors: string[] }>("/api/sources", { inputs });
}

const firstSentence = (d: string) => (d.replace(/https?:\/\/\S+/g, "").split(/\n|(?<=[.!?])\s/).map((s) => s.trim()).find((s) => s.length > 20) ?? "").slice(0, 180);

function trackerPlan(skill: string, vids: RawVideo[], mode: Mode, existing?: Group) {
  const words = skill.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1);
  let keep = mode === "video" ? vids : vids.filter((v) => words.some((w) => (v.title + " " + v.desc).toLowerCase().includes(w)));
  if (!keep.length) keep = vids;
  keep = [...keep].sort((a, b) => (a.publishedAt || "").localeCompare(b.publishedAt || ""));
  const levels: Level[] = []; const videos: Video[] = [];
  if (existing) {
    const l: Level = { id: "l" + uid().slice(0, 5), name: `Added ${new Date().toLocaleDateString()}`, goal: "Videos you added later.", challenge: "Apply one idea from these videos to a real piece of work." };
    levels.push(l);
    keep.forEach((v) => videos.push(toVideo(v, l.id)));
    return { levels, videos };
  }
  let cur: Level | null = null, acc = 0;
  for (const v of keep) {
    if (!cur || acc > 45 * 60) {
      cur = { id: "l" + (levels.length + 1), name: `Part ${levels.length + 1}`, goal: "Work through these videos in order.", challenge: "Recreate one thing you saw in this part, from memory." };
      levels.push(cur); acc = 0;
    }
    videos.push(toVideo(v, cur.id)); acc += v.secs;
  }
  return { levels, videos };
}

function toVideo(v: RawVideo, level: string, extra?: Partial<Video>): Video {
  return {
    id: v.id, title: v.title, channelId: v.channelId, channelTitle: v.channelTitle, secs: v.secs, level,
    kind: "concept", sum: firstSentence(v.desc) || v.title, pts: v.chapters.slice(0, 12), cards: [], concepts: [], addedAt: Date.now(), ...extra,
  };
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

export async function build(opts: { mode: Mode; method: Method; inputs: string[]; skill: string; focus?: string; existing?: Group }, log: Log) {
  const { mode, method, inputs, skill, focus, existing } = opts;
  log("Reading YouTube…", 3);
  const src = await fetchSources(inputs);
  src.errors.forEach((e) => log("⚠ " + e));
  const have = new Set(existing?.videos.map((v) => v.id) ?? []);
  const raw = src.videos.filter((v) => !have.has(v.id));
  if (!raw.length) throw new Error(src.errors[0] || (existing ? "No new videos found; they're already in this group." : "No videos found."));
  log(`Found ${raw.length} video${raw.length > 1 ? "s" : ""} from ${src.sources.map((s) => s.title).join(", ")}.`, 8);

  if (method === "tracker") {
    const { levels, videos } = trackerPlan(skill, raw, mode, existing);
    log(`Kept ${videos.length} videos in ${levels.length} parts.`, 100);
    return { sources: src.sources, levels, videos, scenarios: [] as Scenario[], category: "General" };
  }

  // 1. plan
  log("Claude is picking and ordering the relevant videos…", 12);
  const plan = await post<{ category: string; levels: Level[]; picks: { id: string; level: string }[] }>("/api/ai/plan", {
    skill, focus, mode, videos: raw.map(({ id, title, desc, secs, channelTitle, chapters }) => ({ id, title, desc, secs, channelTitle, chapters })),
    existingLevels: existing?.levels.map(({ id, name, goal }) => ({ id, name, goal })),
  });
  if (!plan.picks.length) throw new Error(`None of these videos looked relevant to ${skill}. Try a broader skill name.`);
  const existingIds = new Set(existing?.levels.map((l) => l.id) ?? []);
  const newLevels = plan.levels.filter((l) => !existingIds.has(l.id)).map((l) => ({ ...l, challenge: "" }));
  log(`Kept ${plan.picks.length} of ${raw.length} videos in ${plan.levels.length} levels.`, 18);

  // 2. lessons
  const byId = new Map(raw.map((v) => [v.id, v]));
  const concepts = new Set(existing?.videos.flatMap((v) => v.concepts) ?? []);
  const videos: Video[] = new Array(plan.picks.length);
  let doneN = 0, noTranscript = 0;
  await pool(plan.picks, 3, async (p, i) => {
    const v = byId.get(p.id)!;
    try {
      const l = await post<{ sum: string; pts: string[]; cards: { q: string; a: string }[]; concepts: string[]; kind: Video["kind"]; transcript: string }>(
        "/api/ai/lesson", { skill, single: mode === "video", concepts: [...concepts], video: { id: v.id, title: v.title, desc: v.desc, secs: v.secs, channelTitle: v.channelTitle } });
      l.concepts?.forEach((c) => concepts.add(c));
      if (l.transcript === "none") noTranscript++;
      videos[i] = toVideo(v, p.level, { sum: l.sum, pts: l.pts ?? [], cards: l.cards ?? [], concepts: l.concepts ?? [], kind: l.kind ?? "concept" });
    } catch (e) {
      log(`⚠ Notes failed for “${v.title}”: ${(e as Error).message}`);
      videos[i] = toVideo(v, p.level);
    }
    doneN++;
    log(`Notes and flashcards: ${doneN}/${plan.picks.length}`, 18 + Math.round((doneN / plan.picks.length) * 70));
  });
  if (noTranscript) log(`${noTranscript} video${noTranscript > 1 ? "s had" : " had"} no readable transcript, so their notes come from the title and description.`);

  // 3. challenges + scenarios
  log("Writing level challenges and real-world scenarios…", 90);
  let scenarios: Scenario[] = [];
  const levelsForFinal = existing ? newLevels : plan.levels;
  try {
    const fin = await post<{ levels: { id: string; goal: string; challenge: string }[]; scenarios: { prompt: string; concepts: string[]; model: string }[] }>("/api/ai/finalize", {
      skill, levels: levelsForFinal.length ? levelsForFinal : plan.levels, scenarioCount: existing ? 3 : mode === "video" ? 4 : 8,
      videos: videos.map((v) => ({ title: v.title, level: v.level, sum: v.sum, concepts: v.concepts })),
    });
    for (const l of newLevels) { const f = fin.levels.find((x) => x.id === l.id); if (f) { l.goal = f.goal || l.goal; l.challenge = f.challenge; } }
    if (!existing) for (const l of plan.levels) { const f = fin.levels.find((x) => x.id === l.id); if (f) { l.goal = f.goal || l.goal; (l as Level).challenge = f.challenge; } }
    scenarios = fin.scenarios.map((s) => ({ id: "s" + uid().slice(0, 6), ...s }));
  } catch (e) { log("⚠ Challenges failed: " + (e as Error).message); }
  const levels = (existing ? newLevels : plan.levels).map((l) => ({ ...l, challenge: l.challenge || "Apply one idea from this level to a real piece of work." }));
  log("Done.", 100);
  return { sources: src.sources, levels, videos: videos.filter(Boolean), scenarios, category: plan.category || "General" };
}

export function newGroup(skill: string, category: string, built: Group["built"], r: { sources: Source[]; levels: Level[]; videos: Video[]; scenarios: Scenario[] }): Group {
  return { id: uid(), skill, category, createdAt: Date.now(), built, ...r };
}

export function parseCourseFile(text: string): Group {
  const j = JSON.parse(text) as CourseFile;
  const g = (j.format === "skill-sprint-course" ? j.group : (j as unknown as { group?: Group }).group ?? j) as Group;
  if (!g || !Array.isArray(g.videos) || !Array.isArray(g.levels) || !g.skill) throw new Error("That file isn't a Skill Sprint course.");
  return {
    ...g, id: uid(), createdAt: Date.now(), built: "import",
    sources: g.sources ?? [], scenarios: g.scenarios ?? [], category: g.category || "General",
    videos: g.videos.map((v) => ({ ...v, pts: v.pts ?? [], cards: v.cards ?? [], concepts: v.concepts ?? [], kind: v.kind ?? "concept", addedAt: v.addedAt ?? Date.now(), sum: v.sum ?? "" })),
  };
}

export function claudePrompt(mode: Mode, inputs: string[], skill: string, focus: string) {
  const what = mode === "video" ? "this YouTube video" : mode === "channel" ? "every upload on this YouTube channel" : "every upload on these YouTube channels";
  return `Build me a Skill Sprint course file.

Skill I want to learn: ${skill || "(skill)"}
${focus ? `What I want out of it: ${focus}\n` : ""}Source: ${what}
${inputs.filter(Boolean).join("\n")}

Scan all the videos, keep only the ones that teach this skill (put useful off-topic ones in a final bonus level), order them so each builds on the last with an easy win first, and read the transcripts to write notes. Give me the result as a downloadable JSON file in exactly this shape:

{
  "format": "skill-sprint-course", "version": 1,
  "group": {
    "skill": "${skill || "Skill"}", "category": "Design | Motion | Development | …",
    "sources": [{ "kind": "channel" | "video", "url": "", "id": "channel or video id", "title": "" }],
    "levels": [{ "id": "l1", "name": "", "goal": "", "challenge": "a 10–20 min hands-on task", "bonus": false }],
    "videos": [{ "id": "YouTube video id", "title": "", "channelId": "", "channelTitle": "", "secs": 0,
      "level": "l1", "kind": "hands-on | partial | concept", "sum": "one line",
      "pts": ["key lessons with exact numbers"], "cards": [{ "q": "", "a": "" }], "concepts": ["Title Case tag"] }],
    "scenarios": [{ "id": "s1", "prompt": "real-world situation", "concepts": [""], "model": "model answer" }]
  }
}`;
}
