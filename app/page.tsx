"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useStore, useHydrated, getProgress } from "@/lib/store";
import { groupStats, mergeActivity, streakOf, lastNDays, nextVideo, fmtDur, rankOf, readinessLabel } from "@/lib/metrics";
import { Frame, Kpi, Loading, Toaster } from "@/components/ui";
import { Radar, Heatmap, DayBars, LPA, LPALegend, Ring } from "@/components/charts";

export default function Home() {
  const ok = useHydrated();
  const groups = useStore((s) => s.groups);
  const progress = useStore((s) => s.progress);

  const data = useMemo(() => groups.map((g) => {
    const p = getProgress(progress, g.id);
    const st = groupStats(g, p);
    const last = Math.max(0, ...Object.values(p.done), ...p.reviews.map((r) => r.t), ...Object.values(p.scenarios).map((a) => a.t));
    return { g, p, st, last, next: nextVideo(g, p) };
  }), [groups, progress]);

  if (!ok) return <Loading />;

  const act = mergeActivity(data.map((d) => d.st.act));
  const streak = streakOf(act);
  const week = lastNDays(act, 7);
  const weekSecs = week.reduce((s, d) => s + d.secs, 0);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekVideos = data.reduce((s, d) => s + Object.values(d.p.done).filter((t) => t > weekAgo).length, 0);
  const xp = data.reduce((s, d) => s + d.st.xp, 0);
  const rank = rankOf(xp);
  const watched = data.reduce((s, d) => s + d.st.watchedSecs, 0);
  const done = data.reduce((s, d) => s + d.st.done, 0), total = data.reduce((s, d) => s + d.st.total, 0);
  const due = data.reduce((s, d) => s + d.st.due, 0);
  const avgReady = data.length ? Math.round(data.reduce((s, d) => s + d.st.readiness, 0) / data.length) : 0;
  const recent = [...data].sort((a, b) => b.last - a.last).find((d) => d.next) ?? null;

  const cats = Object.entries(data.reduce<Record<string, typeof data>>((m, d) => { (m[d.g.category] ??= []).push(d); return m; }, {}))
    .map(([name, ds]) => ({ name, n: ds.length, ready: Math.round(ds.reduce((s, d) => s + d.st.readiness, 0) / ds.length), skills: ds.map((d) => d.g.skill) }))
    .sort((a, b) => b.ready - a.ready);

  const dueMost = [...data].sort((a, b) => b.st.due - a.st.due)[0];
  const weakApply = [...data].filter((d) => d.st.done > 0).sort((a, b) => a.st.applied - b.st.applied)[0];
  const suggestion = dueMost && dueMost.st.due >= 5
    ? { text: `Review ${dueMost.st.due} flashcards in ${dueMost.g.skill} before they fade.`, href: `/g/${dueMost.g.id}?tab=cards` }
    : weakApply && weakApply.st.applied < 0.3 && weakApply.st.learned > 0.25
      ? { text: `You've watched a lot of ${weakApply.g.skill} but applied little. Try a real-world scenario.`, href: `/g/${weakApply.g.id}?tab=scenarios` }
      : recent ? { text: `Keep going with ${recent.g.skill}: “${recent.next!.title}”.`, href: `/g/${recent.g.id}` } : { text: "Create your first group from a YouTube channel.", href: "/new" };

  return (
    <main className="wrap">
      <Toaster />
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <span className="mono muted" style={{ fontSize: 12 }}>{rank.name.toUpperCase()} · {xp.toLocaleString()} XP{rank.next ? ` · ${rank.next[0] - xp} to ${rank.next[1]}` : ""}</span>
          <h1 style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 800 }}>Your skills</h1>
        </div>
        <Link href="/new" className="btn pri">+ New group</Link>
      </div>

      <div className="kpis">
        <Kpi k="Skills" v={groups.length} s={`${cats.length} categor${cats.length === 1 ? "y" : "ies"}`} />
        <Kpi k="Readiness" v={`${avgReady}`} s={`avg across skills · ${readinessLabel(avgReady)}`} hi />
        <Kpi k="Time learned" v={fmtDur(watched)} s={`${fmtDur(weekSecs)} this week`} />
        <Kpi k="Videos" v={`${done}/${total}`} s={`${weekVideos} this week`} />
        <Kpi k="Day streak" v={streak} s={streak ? "keep it alive today" : "study today to start one"} />
        <Kpi k="Cards due" v={due} s="spaced-repetition reviews" />
      </div>

      {recent && recent.next && (
        <Frame label={`Continue · ${recent.g.skill}`} sel>
          <div className="row between" style={{ gap: 16 }}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div className="row" style={{ marginBottom: 6 }}><span className={`chip ${recent.next.kind}`}>{recent.next.kind}</span><span className="mono muted" style={{ fontSize: 13 }}>{fmtDur(recent.next.secs)} · {recent.next.channelTitle}</span></div>
              <h2 style={{ fontSize: 22 }}>{recent.next.title}</h2>
              <p className="muted" style={{ margin: "4px 0 0", maxWidth: "65ch" }}>{recent.next.sum}</p>
            </div>
            <div className="row">
              <a className="btn pri" href={`https://www.youtube.com/watch?v=${recent.next.id}`} target="_blank" rel="noopener">▶ Watch</a>
              <Link className="btn" href={`/g/${recent.g.id}`}>Open {recent.g.skill}</Link>
            </div>
          </div>
        </Frame>
      )}

      <div className="grid g21">
        <Frame label="Skill profile · readiness 0–100">
          {data.length ? <Radar items={data.map((d) => ({ name: d.g.skill, value: d.st.readiness }))} /> : <p className="muted">Add a group to see your skill profile.</p>}
          <p className="hint">Readiness blends what you watched (30%), what you can recall (30%) and what you've applied in challenges and scenarios (40%).</p>
        </Frame>
        <Frame label="Skill types">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cats.map((c) => (
              <div key={c.name}>
                <div className="row between"><b>{c.name}</b><span className="mono">{c.ready}</span></div>
                <div className="bar" style={{ margin: "6px 0 4px" }}><i style={{ width: `${c.ready}%`, background: "var(--select)" }} /></div>
                <span className="muted" style={{ fontSize: 13 }}>{c.skills.join(", ")}</span>
              </div>
            ))}
            {!cats.length && <p className="muted">No skills yet.</p>}
          </div>
        </Frame>
      </div>

      <Frame label="Real-world readiness">
        <div className="row between" style={{ marginBottom: 10 }}><p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>Can you use it, not just recall it? Each skill moves from Learned to Practised to Applied.</p><LPALegend /></div>
        {data.map(({ g, st }) => (
          <div key={g.id} className="crow" style={{ gridTemplateColumns: "minmax(90px,170px) minmax(0,1fr) auto auto" }}>
            <Link href={`/g/${g.id}`} className="nm" style={{ color: "var(--ink)", textDecoration: "none" }}>{g.skill}</Link>
            <LPA l={st.learned} p={st.practiced} a={st.applied} />
            <span className="chip red">{readinessLabel(st.readiness)}</span>
            <Link href={`/g/${g.id}?tab=scenarios`} className="linkbtn">{st.scenarioAnswered}/{st.scenarioTotal} scenarios</Link>
          </div>
        ))}
      </Frame>

      <div className="grid g2">
        <Frame label="This week">
          <DayBars days={week} />
          <div className="row" style={{ gap: 18, marginTop: 8, fontSize: 14 }}>
            <span><b className="mono">{fmtDur(weekSecs)}</b> <span className="muted">studied</span></span>
            <span><b className="mono">{weekVideos}</b> <span className="muted">videos</span></span>
          </div>
          <div className="ans" style={{ marginTop: 12 }}><b>Next best step:</b> {suggestion.text} <Link href={suggestion.href}>Go →</Link></div>
        </Frame>
        <Frame label="Study activity · all skills">
          <Heatmap act={act} />
          <p className="hint">Each square is a day. Darker means more time on videos, flashcards, challenges and scenarios.</p>
        </Frame>
      </div>

      <div className="grid g3">
        {data.map(({ g, st, next }) => (
          <Link key={g.id} href={`/g/${g.id}`} className="card-link">
            <Frame label={`${g.category} · ${g.sources.length} source${g.sources.length === 1 ? "" : "s"}`} className="gcard">
              <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
                <Ring value={st.pct} size={76} label={`${Math.round(st.pct * 100)}%`} sub={`${st.done}/${st.total}`} />
                <div style={{ minWidth: 0 }}>
                  <h3>{g.skill}</h3>
                  <div className="meta">{g.sources.map((s) => s.title).slice(0, 3).join(", ")}{g.sources.length > 3 ? ` +${g.sources.length - 3}` : ""}</div>
                </div>
              </div>
              <div className="row" style={{ fontSize: 13, gap: 12 }}>
                <span><b className="mono">{st.readiness}</b> <span className="muted">readiness</span></span>
                <span><b className="mono">{st.due}</b> <span className="muted">cards due</span></span>
                <span className="redline">{fmtDur(st.leftSecs)} left</span>
              </div>
              {next && <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Next: {next.title}</div>}
            </Frame>
          </Link>
        ))}
        <Link href="/new" className="card-link">
          <Frame label="New"><div className="empty" style={{ border: 0, padding: 20 }}><h3 style={{ color: "var(--ink)" }}>+ New group</h3><p style={{ margin: "6px 0 0" }}>One video, one channel, or several channels for one skill.</p></div></Frame>
        </Link>
      </div>
    </main>
  );
}
