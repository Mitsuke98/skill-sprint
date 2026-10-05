"use client";
import { useState } from "react";
import type { Group, Progress, Scenario } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fmtDur } from "@/lib/metrics";
import { Frame, toast, confetti } from "../ui";

export function Notes({ g }: { g: Group }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <input className="input" type="search" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
      {g.levels.map((l) => {
        const vs = g.videos.filter((v) => v.level === l.id && (!t || (v.title + " " + v.sum + " " + v.pts.join(" ") + " " + v.concepts.join(" ")).toLowerCase().includes(t)));
        if (!vs.length) return null;
        return (
          <section key={l.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 18 }}>{l.name}</h3>
            {vs.map((v) => (
              <article key={v.id} className="frame" style={{ padding: 14 }}>
                <h4 style={{ fontSize: 15 }}>{v.title}</h4>
                <p className="muted" style={{ margin: "2px 0 8px", fontSize: 14 }}>{v.sum}</p>
                {v.pts.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{v.pts.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                {v.concepts.length > 0 && <div className="row" style={{ marginTop: 8 }}>{v.concepts.map((c) => <span key={c} className="chip">{c}</span>)}</div>}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ScenarioCard({ g, s, p, ai }: { g: Group; s: Scenario; p: Progress; ai: boolean }) {
  const save = useStore((x) => x.answerScenario);
  const prev = p.scenarios[s.id];
  const [text, setText] = useState(prev?.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [err, setErr] = useState("");

  async function grade() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ai/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skill: g.skill, prompt: s.prompt, model: s.model, answer: text }) });
      const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Grading failed");
      save(g.id, s.id, text, j.score, j.feedback); if (j.score >= 70) confetti(); toast(`Scored ${j.score}/100`);
      setShowModel(true);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const self = (score: number) => { save(g.id, s.id, text, score, "Self-assessed against the model answer."); toast(`Saved · ${score}/100`); };

  return (
    <Frame label={s.concepts.join(" · ") || "Scenario"}>
      <p style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600, maxWidth: "70ch" }}>{s.prompt}</p>
      <textarea className="input" id={`sc-${s.id}`} placeholder="How would you handle it? Be specific: techniques, values, order of steps." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        {ai && <button className="btn pri" disabled={busy || text.trim().length < 20} onClick={grade}>{busy ? "Grading…" : "Grade with Claude"}</button>}
        <button className="btn" onClick={() => setShowModel((x) => !x)}>{showModel ? "Hide model answer" : "Compare with model answer"}</button>
        {prev && <span className="chip red">Best: {prev.score}/100</span>}
      </div>
      {prev?.feedback && prev.feedback !== "Self-assessed against the model answer." && <div className="ans" style={{ marginTop: 10, fontSize: 14 }}><b>Feedback:</b> {prev.feedback}</div>}
      {showModel && (
        <div className="ans" style={{ marginTop: 10, fontSize: 14 }}>
          <b>Model answer:</b> {s.model}
          {!ai && text.trim().length >= 20 && <div className="row" style={{ marginTop: 10 }}><span className="muted">How close were you?</span>{[[25, "Missed most"], [60, "Partly"], [90, "Nailed it"]].map(([v, l]) => <button key={v} className="btn sm" onClick={() => self(v as number)}>{l}</button>)}</div>}
        </div>
      )}
      {err && <p className="hint" style={{ color: "var(--bad)" }}>{err}</p>}
    </Frame>
  );
}

export function Scenarios({ g, p, ai }: { g: Group; p: Progress; ai: boolean }) {
  if (!g.scenarios.length) return <div className="empty">No real-world scenarios in this group yet. Claude-built courses include them.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>These test whether you can use what you learned. Scores feed your Applied level and readiness.{!ai && " Without a Claude key, compare with the model answer and rate yourself."}</p>
      <div className="grid" style={{ gap: 36 }}>{g.scenarios.map((s) => <ScenarioCard key={s.id} g={g} s={s} p={p} ai={ai} />)}</div>
    </div>
  );
}

export function Plan({ g, p }: { g: Group; p: Progress }) {
  const setPlan = useStore((s) => s.setPlan);
  const [h, m] = (p.start || "10:00").split(":").map(Number);
  let t = new Date(); t.setHours(h, m, 0, 0);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const rows: { t: string; label: string; sub?: string; dur: number; brk?: boolean }[] = [];
  let since = 0, total = 0;
  const lv = g.levels.filter((l) => g.videos.some((v) => v.level === l.id && !p.done[v.id]));
  lv.forEach((l, i) => {
    const vs = g.videos.filter((v) => v.level === l.id && !p.done[v.id]);
    const block = vs.reduce((s, v) => s + v.secs, 0) / p.speed + (p.challenges[l.id] ? 0 : 600);
    rows.push({ t: fmt(t), label: l.name, sub: `${vs.length} video${vs.length > 1 ? "s" : ""}${p.challenges[l.id] ? "" : " + challenge"}`, dur: block });
    t = new Date(t.getTime() + block * 1000); since += block; total += block;
    if (i < lv.length - 1 && since >= 45 * 60) {
      const lunch = t.getHours() >= 12 && t.getHours() < 15 && !rows.some((r) => r.label === "Lunch");
      const d = lunch ? 45 * 60 : 10 * 60;
      rows.push({ t: fmt(t), label: lunch ? "Lunch" : "Break: stand up, water, no phone", dur: d, brk: true });
      t = new Date(t.getTime() + d * 1000); since = 0;
    }
  });
  rows.push({ t: fmt(t), label: "Finish line: 10-minute flashcard run", dur: 600 });
  return (
    <Frame label="Day plan">
      <div className="row" style={{ marginBottom: 12, gap: 12 }}>
        <label htmlFor="start" className="lb" style={{ margin: 0 }}>Start at</label>
        <input id="start" type="time" className="input" style={{ width: "auto" }} value={p.start} onChange={(e) => setPlan(g.id, { start: e.target.value || "10:00" })} />
        <span className="lb" style={{ margin: 0 }}>Speed</span>
        <div className="seg" role="group" aria-label="Playback speed">{[1, 1.25, 1.5, 1.75, 2].map((s) => <button key={s} aria-pressed={p.speed === s} onClick={() => setPlan(g.id, { speed: s })}>{s}×</button>)}</div>
      </div>
      <p className="muted" style={{ margin: "0 0 10px" }}>Remaining work: <b className="mono">{fmtDur(total)}</b> at {p.speed}×, including challenges.</p>
      <ol className="tl">{rows.map((r, i) => <li key={i} className={r.brk ? "brk" : ""}><span className="t">{r.t}</span><span><b>{r.label}</b>{r.sub && <span className="muted"> · {r.sub}</span>}</span><span className="dur mono muted">{fmtDur(r.dur)}</span></li>)}</ol>
    </Frame>
  );
}
