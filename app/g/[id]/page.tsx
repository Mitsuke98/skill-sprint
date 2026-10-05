"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useStore, useHydrated, getProgress } from "@/lib/store";
import { groupStats, fmtDur, rankOf } from "@/lib/metrics";
import { Loading, Toaster, downloadJSON } from "@/components/ui";
import { Ring } from "@/components/charts";
import Dashboard from "@/components/group/Dashboard";
import Path from "@/components/group/Path";
import Cards from "@/components/group/Cards";
import { Notes, Scenarios, Plan } from "@/components/group/Extras";
import BuilderForm from "@/components/BuilderForm";

const TABS = [["dashboard", "Dashboard"], ["path", "Path"], ["cards", "Flashcards"], ["notes", "Notes"], ["scenarios", "Scenarios"], ["plan", "Day plan"]] as const;

function GroupInner() {
  const ok = useHydrated();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const g = useStore((s) => s.groups.find((x) => x.id === id));
  const all = useStore((s) => s.progress);
  const remove = useStore((s) => s.removeGroup);
  const [tab, setTab] = useState<string>(sp.get("tab") ?? "path");
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [ai, setAi] = useState(false);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then((s) => setAi(!!s.ai)).catch(() => {}); }, []);
  useEffect(() => { const t = sp.get("tab"); if (t) setTab(t); }, [sp]);

  if (!ok) return <Loading />;
  if (!g) return <main className="wrap"><div className="empty">This group doesn't exist on this device. <Link href="/">Back to dashboard</Link></div></main>;
  const p = getProgress(all, g.id);
  const st = groupStats(g, p);
  const rank = rankOf(st.xp);
  const go = (t: string) => { setTab(t); router.replace(`/g/${g.id}?tab=${t}`, { scroll: false }); };
  const { id: _i, createdAt: _c, ...portable } = g;

  return (
    <main className="wrap">
      <Toaster />
      <div className="row between" style={{ alignItems: "flex-start", gap: 16 }}>
        <div className="row" style={{ gap: 16, flexWrap: "nowrap", minWidth: 0 }}>
          <Ring value={st.pct} size={84} label={`${Math.round(st.pct * 100)}%`} sub={`${st.done}/${st.total}`} />
          <div style={{ minWidth: 0 }}>
            <span className="mono muted" style={{ fontSize: 12 }}>{g.category.toUpperCase()} · {rank.name.toUpperCase()} · {st.xp} XP{rank.next ? ` · ${rank.next[0] - st.xp} to ${rank.next[1]}` : ""}</span>
            <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 800 }}>{g.skill}</h1>
            <div className="muted" style={{ fontSize: 13 }}>{g.sources.map((s) => s.title).join(" · ")} · {fmtDur(st.leftSecs / p.speed)} left at {p.speed}×</div>
          </div>
        </div>
        <div className="row noprint">
          <button className="btn pri" onClick={() => setAdding(true)}>+ Add videos</button>
          <Link className="btn" href={`/g/${g.id}/print`}>PDF notes</Link>
          <button className="btn" onClick={() => downloadJSON(`${g.skill.replace(/\W+/g, "-").toLowerCase()}.course.json`, { format: "skill-sprint-course", version: 1, group: portable })}>Export</button>
          {confirmDel ? <><button className="btn danger" onClick={() => { remove(g.id); router.push("/"); }}>Delete for good</button><button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button></> : <button className="btn danger" onClick={() => setConfirmDel(true)}>Delete</button>}
        </div>
      </div>

      <nav className="tabs noprint" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}>{l}{k === "cards" && st.due ? ` · ${st.due}` : ""}</button>)}
      </nav>

      {tab === "dashboard" && <Dashboard g={g} p={p} go={go} />}
      {tab === "path" && <Path g={g} p={p} />}
      {tab === "cards" && <Cards g={g} p={p} />}
      {tab === "notes" && <Notes g={g} />}
      {tab === "scenarios" && <Scenarios g={g} p={p} ai={ai} />}
      {tab === "plan" && <Plan g={g} p={p} />}

      {adding && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="addh" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <div className="dlg">
            <div className="row between"><h3 id="addh" style={{ fontSize: 22 }}>Add videos to {g.skill}</h3><button className="btn sm" onClick={() => setAdding(false)} aria-label="Close">✕</button></div>
            <p className="muted" style={{ margin: 0 }}>New videos slot into your existing levels. Anything already in this group is skipped, and your progress stays.</p>
            <BuilderForm existing={g} onDone={() => setAdding(false)} />
          </div>
        </div>
      )}
    </main>
  );
}

export default function GroupPage() { return <Suspense fallback={<Loading />}><GroupInner /></Suspense>; }
