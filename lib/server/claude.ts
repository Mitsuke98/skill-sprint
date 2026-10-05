import "server-only";

export const hasAI = () => !!process.env.ANTHROPIC_API_KEY;

export async function askJSON<T>(system: string, user: string, maxTokens = 4000): Promise<T> {
  if (!hasAI()) throw new Error("Add ANTHROPIC_API_KEY in Vercel to use the automatic builder.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system: system + "\n\nRespond with a single JSON object only. No prose, no markdown fences.",
      messages: [{ role: "user", content: user }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Claude API error ${r.status}`);
  const text: string = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Claude returned no JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
