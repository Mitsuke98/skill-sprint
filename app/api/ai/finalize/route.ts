import { NextResponse } from "next/server";
import { askJSON } from "@/lib/server/claude";
export const maxDuration = 120;

type In = { skill: string; levels: { id: string; name: string; goal: string; bonus?: boolean }[]; videos: { title: string; level: string; sum: string; concepts: string[] }[]; scenarioCount?: number };
type Out = { levels: { id: string; goal: string; challenge: string }[]; scenarios: { prompt: string; concepts: string[]; model: string }[] };

const SYSTEM = `You design practice for a self-paced course.
- For each level write a hands-on "challenge": a concrete 10–20 minute task the learner does in the real tool or real life using only what that level taught. Start with a verb. One or two sentences.
- Tighten each level "goal" to one sentence.
- Write real-world "scenarios": short workplace or client situations that require applying several lessons. Each has "concepts" (tags from the course) and a "model" answer (3–5 sentences) that cites specific techniques and values taught in the videos.`;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as In;
    const user = `Skill: ${b.skill}
Levels: ${JSON.stringify(b.levels)}
Videos: ${JSON.stringify(b.videos)}
Write ${b.scenarioCount ?? 8} scenarios. Return {"levels":[{"id","goal","challenge"}],"scenarios":[{"prompt","concepts","model"}]}`;
    return NextResponse.json(await askJSON<Out>(SYSTEM, user, 8000));
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
