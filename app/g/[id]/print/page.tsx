"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore, useHydrated } from "@/lib/store";
import { fmtClock, fmtDur } from "@/lib/metrics";
import { Loading } from "@/components/ui";

export default function PrintNotes() {
  const ok = useHydrated();
  const { id } = useParams<{ id: string }>();
  const g = useStore((s) => s.groups.find((x) => x.id === id));
  if (!ok) return <Loading />;
  if (!g) return <main className="wrap"><div className="empty">Group not found.</div></main>;
  let n = 0;
  return (
    <main className="wrap print" style={{ maxWidth: 820 }}>
      <style>{`@page{size:A4;margin:16mm 14mm} .print h2{font-size:22px;margin-top:10px} .print .lv{break-before:page} .print .v{break-inside:avoid;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--line)} .print table{border-collapse:collapse;width:100%} .print td{border:1px solid var(--line);padding:4px 6px;vertical-align:top;font-size:13px} .print tr{break-inside:avoid}`}</style>
      <div className="row between noprint">
        <Link href={`/g/${g.id}`} className="btn">← Back</Link>
        <button className="btn pri" onClick={() => window.print()}>Save as PDF</button>
      </div>
      <p className="hint noprint">In the print dialog, choose “Save as PDF” as the destination.</p>
      <section className="frame">
        <h1 style={{ fontSize: 34 }}>{g.skill} · Revision notes</h1>
        <p className="muted">{g.videos.length} videos from {g.sources.map((s) => s.title).join(", ")} · {fmtDur(g.videos.reduce((s, v) => s + v.secs, 0))}</p>
        <h2>The path</h2>
        <table><tbody>
          {g.levels.map((l) => [
            <tr key={l.id}><td colSpan={3} style={{ background: "var(--select-soft)" }}><b>{l.name}</b></td></tr>,
            ...g.videos.filter((v) => v.level === l.id).map((v) => <tr key={v.id}><td className="mono">{++n}</td><td>{v.title}</td><td className="mono">{fmtClock(v.secs)}</td></tr>),
          ])}
        </tbody></table>
      </section>
      {g.levels.map((l) => (
        <section key={l.id} className="frame lv">
          <h2>{l.name}</h2><p className="muted">{l.goal}</p>
          {g.videos.filter((v) => v.level === l.id).map((v) => (
            <div key={v.id} className="v"><h4>{v.title}</h4><p style={{ margin: "2px 0 4px" }}><i>{v.sum}</i></p>{v.pts.length > 0 && <ul style={{ margin: 0, paddingLeft: 18 }}>{v.pts.map((x, i) => <li key={i}>{x}</li>)}</ul>}</div>
          ))}
          <div className="challenge"><span className="k">Challenge</span><p>{l.challenge}</p></div>
        </section>
      ))}
      {g.videos.some((v) => v.cards.length) && (
        <section className="frame lv"><h2>Flashcards</h2><p className="muted">Cover the right column and answer out loud.</p>
          <table><tbody>{g.videos.flatMap((v) => v.cards.map((c, i) => <tr key={v.id + i}><td style={{ width: "48%", fontWeight: 600 }}>{c.q}</td><td>{c.a}</td></tr>))}</tbody></table>
        </section>
      )}
      {g.scenarios.length > 0 && (
        <section className="frame lv"><h2>Real-world scenarios</h2>
          {g.scenarios.map((s) => <div key={s.id} className="v"><b>{s.prompt}</b><p style={{ margin: "4px 0 0" }} className="muted">Model answer: {s.model}</p></div>)}
        </section>
      )}
    </main>
  );
}
