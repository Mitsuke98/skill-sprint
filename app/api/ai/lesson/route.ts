import { NextResponse } from "next/server";
import { askJSON } from "@/lib/server/claude";
import { transcript, chaptersFrom } from "@/lib/server/youtube";
export const maxDuration = 120;

type In = { skill: string; single?: boolean; concepts: string[]; video: { id: string; title: string; desc: string; secs: number; channelTitle: string } };
type Out = { sum: string; pts: string[]; cards: { q: string; a: string }[]; concepts: string[]; kind: "hands-on" | "partial" | "concept" };

const SYSTEM = `You write study material from a YouTube lesson so a learner can revise fast and remember it.
- "sum": one sentence on what the video teaches.
- "pts": the concrete lessons in order. Keep exact numbers, values, shortcuts, settings and named techniques. Plain, short sentences.
- "cards": flashcards testing the most useful facts. Questions are specific; answers are short.
- "concepts": 1–3 concept tags for this skill (reuse tags from the given list when they fit, otherwise create a short Title Case tag).
- "kind": "hands-on" if the video walks through doing it in the tool, "partial" if it shows some of it, "concept" if it is theory or examples.
Never invent facts that are not in the material. If only the title and description are available, keep points general and fewer.`;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as In;
    const t = await transcript(b.video.id);
    const chapters = chaptersFrom(b.video.desc);
    const n = b.single ? "8–14 points and 6–10 cards" : "5–9 points and 2–4 cards";
    const user = `Skill: ${b.skill}
Known concept tags: ${JSON.stringify(b.concepts)}
Video: ${b.video.title} (${Math.round(b.video.secs / 60)} min, by ${b.video.channelTitle})
${chapters.length ? `Chapters:\n${chapters.join("\n")}\n` : ""}Description: ${b.video.desc.slice(0, 1500)}
${t.text ? `Transcript:\n${t.text.slice(0, 45000)}` : "Transcript: unavailable"}

Write ${n}. Return {"sum","pts","cards":[{"q","a"}],"concepts","kind"}`;
    const out = await askJSON<Out>(SYSTEM, user, 3000);
    return NextResponse.json({ ...out, transcript: t.source });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
