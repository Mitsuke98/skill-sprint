import { NextResponse } from "next/server";
import { askJSON } from "@/lib/server/claude";
export const maxDuration = 120;

type In = {
  skill: string; focus?: string; mode: "video" | "channel" | "multi";
  videos: { id: string; title: string; desc: string; secs: number; channelTitle: string; chapters?: string[] }[];
  existingLevels?: { id: string; name: string; goal: string }[];
};
type Out = {
  category: string;
  levels: { id: string; name: string; goal: string; bonus?: boolean }[];
  picks: { id: string; level: string }[];
};

const SYSTEM = `You are a curriculum designer who turns YouTube videos into a focused, gamified course.
Rules:
- Keep only videos that genuinely help someone learn the requested skill. Useful but off-topic videos (career, pricing, tangents) go in one final level with "bonus": true. Drop anything irrelevant (vlogs, announcements with no teaching, sponsors).
- Order so each video builds on earlier ones. Put a short, easy win first. Foundations before advanced, concepts before case studies.
- Group into 4–10 levels of roughly 20–60 minutes each (fewer for small sets). A single-video course has one level.
- When several channels teach the same thing, keep the clearest one and drop near-duplicates.
- Level ids are short slugs like "l1", "l2". Level names are 2–5 words. Goals are one sentence.
- "category" is a broad skill family such as Design, Motion, Development, Data, Business, Music, Language, Fitness.
- If existing levels are given, reuse their ids for videos that fit them and only create new levels when needed (new ids must not clash).`;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as In;
    const list = b.videos.map((v) => ({
      id: v.id, t: v.title, min: Math.round(v.secs / 60), ch: v.channelTitle,
      d: v.desc.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").slice(0, b.videos.length > 150 ? 120 : 260),
      ...(v.chapters?.length ? { chapters: v.chapters.slice(0, 20) } : {}),
    }));
    const user = `Skill to learn: ${b.skill}
${b.focus ? `What the learner wants: ${b.focus}\n` : ""}Input mode: ${b.mode}
${b.existingLevels?.length ? `Existing levels in this course: ${JSON.stringify(b.existingLevels)}\n` : ""}
Videos (${list.length}):
${JSON.stringify(list)}

Return: {"category": string, "levels": [{"id","name","goal","bonus"?}], "picks": [{"id": videoId, "level": levelId}] in learning order}`;
    const out = await askJSON<Out>(SYSTEM, user, 16000);
    const valid = new Set(b.videos.map((v) => v.id));
    out.picks = (out.picks ?? []).filter((p) => valid.has(p.id));
    return NextResponse.json(out);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
