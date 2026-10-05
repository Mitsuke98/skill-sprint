"use client";
import { useEffect, useMemo, useState } from "react";
import type { Group, Progress } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cardKey } from "@/lib/metrics";

type C = { key: string; q: string; a: string; title: string; concept?: string; level: string };

export default function Cards({ g, p }: { g: Group; p: Progress }) {
  const grade = useStore((s) => s.gradeCard);
  const [deck, setDeck] = useState("due");
  const [queue, setQueue] = useState<C[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [seed, setSeed] = useState(0);

  const all = useMemo(() => g.videos.flatMap((v) => v.cards.map((c, k) => ({ key: cardKey(v, k), q: c.q, a: c.a, title: v.title, concept: v.concepts[0], level: v.level, vid: v.id }))), [g]);
  useEffect(() => {
    const now = Date.now();
    let cs = all;
    if (deck === "due") cs = cs.filter((c) => p.done[c.vid] && (p.cards[c.key]?.due ?? 0) <= now);
    else if (deck === "done") cs = cs.filter((c) => p.done[c.vid]);
    else if (deck === "weak") cs = cs.filter((c) => (p.cards[c.key]?.wrong ?? 0) > 0 && (p.cards[c.key]?.box ?? 0) < 2);
    else if (deck !== "all") cs = cs.filter((c) => c.level === deck);
    setQueue([...cs].sort((a, b) => (p.cards[a.key]?.box ?? 0) - (p.cards[b.key]?.box ?? 0) || Math.random() - 0.5));
    setI(0); setFlip(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, seed, all]);

  const c = queue[i];
  function answer(ok: boolean) {
    grade(g.id, c.key, ok, c.concept);
    if (!ok) setQueue((q) => [...q, c]);
    setI((x) => x + 1); setFlip(false);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.code === "Space" && c) { e.preventDefault(); setFlip(true); }
      if (flip && (e.key === "1" || e.key === "ArrowLeft")) answer(false);
      if (flip && (e.key === "2" || e.key === "ArrowRight")) answer(true);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  if (!all.length) return <div className="empty">This group has no flashcards. Groups built with Claude or imported course files include them.</div>;
  return (
    <div className="fc">
      <div className="row" style={{ justifyContent: "center" }}>
        <select className="input" style={{ width: "auto" }} value={deck} onChange={(e) => setDeck(e.target.value)} aria-label="Deck">
          <option value="due">Due for review</option>
          <option value="done">Videos I've finished</option>
          <option value="weak">Cards I keep missing</option>
          <option value="all">All {all.length} cards</option>
          {g.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button className="btn" onClick={() => setSeed((s) => s + 1)}>Restart</button>
      </div>
      {!c ? (
        <div className="empty" style={{ maxWidth: 580 }}>
          {queue.length ? <><h3 style={{ color: "var(--ink)" }}>Deck cleared</h3><p>Correct cards come back in 1, 3, 7, 16, then 35 days.</p></> : <p>{deck === "due" ? "Nothing due right now. Finish more videos, or pick another deck." : "No cards in this deck yet."}</p>}
        </div>
      ) : (
        <>
          <button className={"flip" + (flip ? " on" : "")} onClick={() => setFlip(true)} aria-label="Flip card">
            <div className="flip-in">
              <div className="face"><span className="k">Card {i + 1}/{queue.length}{p.cards[c.key]?.box ? ` · known ×${p.cards[c.key].box}` : ""}</span><div className="q">{c.q}</div><span className="src">Tap or press space to flip</span></div>
              <div className="face back"><span className="k">Answer</span><div className="a">{c.a}</div><span className="src">From: {c.title}</span></div>
            </div>
          </button>
          <div className="row">{flip ? <><button className="btn" onClick={() => answer(false)}>Again</button><button className="btn ok" onClick={() => answer(true)}>Got it · +2 XP</button></> : <button className="btn pri" onClick={() => setFlip(true)}>Show answer</button>}</div>
        </>
      )}
    </div>
  );
}
