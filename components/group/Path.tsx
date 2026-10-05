"use client";
import { useState } from "react";
import type { Group, Progress, Video } from "@/lib/types";
import { useStore } from "@/lib/store";
import { nextVideo, fmtDur, fmtClock, vidXP, channelStats } from "@/lib/metrics";
import { CheckSvg, Frame, toast, confetti } from "../ui";

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const MOTIVATE = ["Nice. Keep the streak rolling.", "One more and your momentum builds.", "That's how skill gets built: one video at a time.", "Momentum. Don't break it now.", "Small wins stack up.", "Your future self says thanks."];

export default function Path({ g, p }: { g: Group; p: Progress }) {
  const toggleDone = useStore((s) => s.toggleDone);
  const setRecall = useStore((s) => s.setRecall);
  const setChallenge = useStore((s) => s.setChallenge);
  const [view, setView] = useState<"path" | "channel">("path");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [recall, setRecallQ] = useState<Video | null>(null);
  const [shown, setShown] = useState(false);
  const next = nextVideo(g, p);

  function markDone(v: Video) {
    if (p.done[v.id]) { toggleDone(g.id, v.id); return; }
    toggleDone(g.id, v.id);
    const lvVids = g.videos.filter((x) => x.level === v.level);
    const levelDone = lvVids.every((x) => x.id === v.id || p.done[x.id]);
    const n = Object.keys(p.done).length + 1;
    if (levelDone) { confetti(); toast(`Level cleared! +${vidXP(v)} XP. Challenge unlocked.`); }
    else if (n === g.videos.length || [0.25, 0.5, 0.75].some((f) => Math.floor(g.videos.length * f) === n)) { confetti(); toast(`${Math.round((n / g.videos.length) * 100)}% of ${g.skill} done. Milestone!`); }
    else toast(`+${vidXP(v)} XP · ${MOTIVATE[n % MOTIVATE.length]}`);
    if (v.cards.length) { setRecallQ(v); setShown(false); }
  }

  const row = (v: Video) => {
    const done = !!p.done[v.id];
    return (
      <li key={v.id} className={`vid ${done ? "done" : ""} ${next?.id === v.id ? "next" : ""}`}>
        <button className="check" onClick={() => markDone(v)} aria-label={`${done ? "Mark not done" : "Mark done"}: ${v.title}`}><CheckSvg /></button>
        <div style={{ minWidth: 0 }}>
          <div className="vt">{v.title}</div>
          <div className="vmeta">
            <span className="mono">{fmtClock(v.secs)}</span>
            <span className={`chip ${v.kind}`}>{v.kind}</span>
            {view === "path" && g.sources.length > 1 && <span>{v.channelTitle}</span>}
            <span>+{vidXP(v)} XP</span>
            {(v.pts.length > 0 || v.sum) && <button className="linkbtn" onClick={() => setOpen((o) => ({ ...o, [v.id]: !o[v.id] }))}>{open[v.id] ? "Hide notes" : "Notes"}</button>}
          </div>
          {open[v.id] && <div className="notes"><p style={{ margin: "0 0 6px" }}><i>{v.sum}</i></p>{v.pts.length > 0 && <ul>{v.pts.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>}
        </div>
        <div className="vact"><a className="btn sm" href={yt(v.id)} target="_blank" rel="noopener">Watch</a></div>
      </li>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {next ? (
        <div className="grid" style={{ paddingTop: 20 }}>
          <Frame label={`Up next · ${g.levels.find((l) => l.id === next.level)?.name ?? ""}`} sel>
            <div className="row" style={{ marginBottom: 6 }}><span className={`chip ${next.kind}`}>{next.kind}</span><span className="mono muted" style={{ fontSize: 13 }}>{fmtClock(next.secs)} · {fmtDur(next.secs / p.speed)} at {p.speed}× · +{vidXP(next)} XP · {next.channelTitle}</span></div>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)" }}>{next.title}</h2>
            <p className="muted" style={{ margin: "6px 0 12px", maxWidth: "65ch" }}>{next.sum}</p>
            <div className="row">
              <a className="btn pri" href={yt(next.id)} target="_blank" rel="noopener">▶ Watch on YouTube</a>
              <button className="btn ok" onClick={() => markDone(next)}>Mark done</button>
              {next.pts.length > 0 && <button className="btn" onClick={() => setOpen((o) => ({ ...o, [next.id]: !o[next.id] }))}>What to look for</button>}
            </div>
            {open[next.id] && <div className="notes"><ul>{next.pts.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          </Frame>
        </div>
      ) : <div className="empty"><h3 style={{ color: "var(--ink)" }}>Every video done.</h3><p>Lock it in with flashcards and scenarios.</p></div>}

      <div className="row between">
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === "path"} onClick={() => setView("path")}>Learning path</button>
          <button aria-pressed={view === "channel"} onClick={() => setView("channel")}>By channel</button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>Ticking a video updates both views.</span>
      </div>

      <div className="grid" style={{ gap: 40 }}>
        {view === "path" ? g.levels.map((l) => {
          const vs = g.videos.filter((v) => v.level === l.id);
          if (!vs.length) return null;
          const d = vs.filter((v) => p.done[v.id]).length, full = d === vs.length;
          const left = vs.filter((v) => !p.done[v.id]).reduce((s, v) => s + v.secs, 0) / p.speed;
          return (
            <Frame key={l.id} label={`${l.bonus ? "Bonus" : "Level " + (g.levels.filter((x) => !x.bonus).indexOf(l) + 1)} — ${l.name}`} style={full ? { borderColor: "var(--ok)" } : undefined}>
              <div className="lvhead">
                <div><h3>{l.name}</h3><p>{l.goal}</p></div>
                <div className="row" style={{ fontSize: 13 }}><span className="mono muted">{d}/{vs.length}</span><div className="bar" style={{ width: 110 }}><i style={{ width: `${(d / vs.length) * 100}%` }} /></div>{left ? <span className="redline">{fmtDur(left)}</span> : <span className="chip hands-on">Cleared</span>}</div>
              </div>
              <ol className="vlist">{vs.map(row)}</ol>
              <div className={`challenge ${p.challenges[l.id] ? "cleared" : ""}`}>
                <span className="k">{p.challenges[l.id] ? "Challenge cleared · +100 XP" : "Level challenge · +100 XP"}</span>
                <p>{l.challenge}</p>
                {!p.challenges[l.id] && <div><button className="btn sm" disabled={!full} onClick={() => { setChallenge(g.id, l.id); confetti(); toast("+100 XP · that's real practice, not just watching."); }}>{full ? "I did it" : "Finish the videos to unlock"}</button></div>}
              </div>
            </Frame>
          );
        }) : channelStats(g, p).map((c) => {
          const vs = g.videos.filter((v) => v.channelId === c.id);
          return (
            <Frame key={c.id} label={`${c.title} · ${c.done}/${c.total} done`}>
              <div className="lvhead"><div><h3>{c.title}</h3><p>{fmtDur(c.secs)} watched · {fmtDur(vs.filter((v) => !p.done[v.id]).reduce((s, v) => s + v.secs, 0))} left</p></div>
                <div className="bar" style={{ width: 140 }}><i style={{ width: `${(c.done / c.total) * 100}%` }} /></div></div>
              <ol className="vlist">{vs.map(row)}</ol>
            </Frame>
          );
        })}
      </div>

      {recall && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rq">
          <div className="dlg">
            <span className="k">Quick recall · +20 XP</span>
            <h3 id="rq" style={{ fontSize: 22 }}>{recall.cards[0].q}</h3>
            <p className="muted" style={{ margin: 0 }}>Answer it in your head first, then reveal.</p>
            {shown && <div className="ans">{recall.cards[0].a}</div>}
            <div className="row">
              {!shown ? <><button className="btn pri" autoFocus onClick={() => setShown(true)}>Reveal answer</button><button className="btn" onClick={() => setRecallQ(null)}>Skip</button></>
                : <><button className="btn ok" autoFocus onClick={() => { setRecall(g.id, recall.id, true); toast("+20 XP · it's sticking"); setRecallQ(null); }}>I knew it</button>
                  <button className="btn" onClick={() => { setRecall(g.id, recall.id, false); toast("It'll come up in flashcards."); setRecallQ(null); }}>Not yet</button></>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
