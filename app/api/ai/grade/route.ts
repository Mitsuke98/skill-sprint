import { NextResponse } from "next/server";
import { askJSON } from "@/lib/server/claude";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { skill: string; prompt: string; model: string; answer: string };
    const out = await askJSON<{ score: number; feedback: string }>(
      "You grade a learner's answer to a real-world scenario against a model answer. Score 0–100 for how well they applied the right techniques (not wording). Feedback: 2–3 short sentences, name what they got right and the most important thing they missed.",
      `Skill: ${b.skill}\nScenario: ${b.prompt}\nModel answer: ${b.model}\nLearner answer: ${b.answer}\nReturn {"score","feedback"}`, 800);
    return NextResponse.json({ score: Math.max(0, Math.min(100, Math.round(out.score))), feedback: out.feedback });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
