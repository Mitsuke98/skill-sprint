"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { build, newGroup, parseCourseFile, claudePrompt, type Mode, type Method } from "@/lib/builder";
import type { Group } from "@/lib/types";
import { toast, confetti } from "./ui";

type How = Method | "import";

export default function BuilderForm({ existing, onDone }: { existing?: Group; onDone?: () => void }) {
  const router = useRouter();
  const addGroup = useStore((s) => s.addGroup);
  const merge = useStore((s) => s.mergeIntoGroup);
  const [mode, setMode] = useState<Mode>("channel");
  const [inputs, setInputs] = useState<string[]>([""]);
  const [skill, setSkill] = useState(existing?.skill ?? "");
  const [focus, setFocus] = useState("");
  const [how, setHow] = useState<How>("ai");
  const [status, setStatus] = useState<{ youtube: boolean; ai: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ youtube: false, ai: false })); }, []);
  useEffect(() => { if (mode !== "multi") setInputs((x) => [x[0] ?? ""]); else if (inputs.length < 2) setInputs((x) => [x[0] ?? "", ""]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  const needsKeyForChannel = mode !== "video" && status && !status.youtube;
  const aiMissing = how === "ai" && status && !status.ai;
  const filled = inputs.filter((x) => x.trim());
  const canRun = !busy && filled.length > 0 && skill.trim() && how !== "import" && !aiMissing && !needsKeyForChannel;

  async function run() {
    setBusy(true); setErr(""); setLog([]); setPct(0);
    try {
      const r = await build({ mode, method: how as Method, inputs: filled, skill: skill.trim(), focus: focus.trim(), existing }, (m, p) => { setLog((l) => [...l, m]); if (p != null) setPct(p); });
      if (existing) {
        merge(existing.id, { videos: r.videos, levels: r.levels, scenarios: r.scenarios, sources: r.sources });
        toast(`Added ${r.videos.length} videos to ${existing.skill}`); confetti(); onDone?.();
      } else {
        const g = newGroup(skill.trim(), r.category, how as Method, r);
        addGroup(g); confetti(); router.push(`/g/${g.id}`);
      }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const g = parseCourseFile(await f.text());
      if (existing) {
        merge(existing.id, { videos: g.videos, levels: g.levels, scenarios: g.scenarios, sources: g.sources });
        toast(`Imported ${g.videos.length} videos into ${existing.skill}`); onDone?.();
      } else { addGroup(g); router.push(`/g/${g.id}`); }
    } catch (e) { setErr((e as Error).message); }
  }

  async function copyPrompt() {
    const t = claudePrompt(mode, filled, skill, focus);
    try { await navigator.clipboard.writeText(t); toast("Prompt copied. Paste it into a Claude chat."); } catch { setErr("Couldn't copy. Select the prompt text and copy it manually."); }
  }

  const placeholder = mode === "video" ? "https://youtube.com/watch?v=…" : "https://youtube.com/@creator";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label className="lb">What are you adding?</label>
        <div className="seg" role="group">
          {([["video", "One video"], ["channel", "One channel"], ["multi", "Several channels"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        <p className="hint">{mode === "video" ? "A single video becomes a mini course with sections, notes and flashcards." : mode === "channel" ? "Every upload on the channel is scanned; only videos that teach the skill are kept." : "Uploads from all channels are combined into one path. Near-duplicate lessons are dropped."}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="lb" htmlFor="in0">{mode === "video" ? "Video link" : mode === "channel" ? "Channel link" : "Channel links"}</label>
        {inputs.map((v, i) => (
          <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
            <input id={`in${i}`} className="input" value={v} placeholder={placeholder} onChange={(e) => setInputs((x) => x.map((y, k) => (k === i ? e.target.value : y)))} />
            {mode === "multi" && inputs.length > 2 && <button className="btn sm" aria-label="Remove channel" onClick={() => setInputs((x) => x.filter((_, k) => k !== i))}>✕</button>}
          </div>
        ))}
        {mode === "multi" && <div><button className="btn sm" onClick={() => setInputs((x) => [...x, ""])}>+ Add another channel</button></div>}
        <p className="hint">Accepts @handles, channel URLs, video links, youtu.be links and playlist links.</p>
      </div>

      <div className="grid g2" style={{ paddingTop: 0, gap: 16 }}>
        <div>
          <label className="lb" htmlFor="skill">Skill</label>
          <input id="skill" className="input" value={skill} disabled={!!existing} placeholder="e.g. Figma, After Effects, Three.js" onChange={(e) => setSkill(e.target.value)} />
        </div>
        <div>
          <label className="lb" htmlFor="focus">What do you want out of it? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="focus" className="input" value={focus} placeholder="e.g. dashboard UI for work, beginner friendly" onChange={(e) => setFocus(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="lb">How should it be built?</label>
        <div className="seg" role="group">
          <button aria-pressed={how === "ai"} onClick={() => setHow("ai")}>Automatic (Claude)</button>
          <button aria-pressed={how === "tracker"} onClick={() => setHow("tracker")}>Tracker only</button>
          <button aria-pressed={how === "import"} onClick={() => setHow("import")}>Import a course file</button>
        </div>
        <p className="hint">
          {how === "ai" && "Filters, orders, and writes notes, flashcards, challenges and real-world scenarios. Takes 1–5 minutes."}
          {how === "tracker" && "Keeps videos whose title or description mention the skill, oldest first, in ~45-minute parts. No notes or flashcards."}
          {how === "import" && "Upload a course file. You can get one by pasting the prompt below into a Claude chat."}
        </p>
        {status && how === "ai" && !status.ai && <p className="hint" style={{ color: "var(--bad)" }}>Automatic mode needs ANTHROPIC_API_KEY in your Vercel environment variables. Use Tracker only or Import for now.</p>}
        {needsKeyForChannel && how !== "import" && <p className="hint" style={{ color: "var(--bad)" }}>Reading channels needs YOUTUBE_API_KEY in your Vercel environment variables. Single videos work without it.</p>}
      </div>

      {how === "import" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row">
            <button className="btn pri" onClick={() => fileRef.current?.click()}>Upload course file</button>
            <button className="btn" onClick={copyPrompt} disabled={!filled.length}>Copy prompt for Claude</button>
            {!existing && <button className="btn" onClick={async () => { const t = await fetch("/examples/kole-jain-figma.course.json").then((r) => r.text()); const g = parseCourseFile(t); addGroup(g); router.push(`/g/${g.id}`); }}>Load example course</button>}
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {filled.length > 0 && <pre className="log" style={{ maxHeight: 180 }}>{claudePrompt(mode, filled, skill, focus)}</pre>}
        </div>
      ) : (
        <div className="row">
          <button className="btn pri" disabled={!canRun} onClick={run}>{busy ? "Building…" : existing ? "Add to group" : "Build course"}</button>
          {!skill.trim() && <span className="hint" style={{ margin: 0 }}>Enter a skill to continue.</span>}
        </div>
      )}

      {(busy || log.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="bar"><i style={{ width: `${pct}%`, background: "var(--select)" }} /></div>
          <div className="log" aria-live="polite">{log.join("\n")}</div>
        </div>
      )}
      {err && <div className="ans" style={{ color: "var(--bad)" }}>{err}</div>}
    </div>
  );
}
