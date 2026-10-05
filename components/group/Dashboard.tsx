"use client";
import type { Group, Progress } from "@/lib/types";
import { groupStats, conceptCoverage, retentionSeries, channelStats, fmtDur, rankOf, readinessLabel, lastNDays } from "@/lib/metrics";
import { Frame, Kpi } from "../ui";
import { Heatmap, RetentionLine, LPA, LPALegend, Ring, DayBars } from "../charts";

export default function Dashboard({ g, p, go }: { g: Group; p: Progress; go: (tab: string) => void }) {
  const st = groupStats(g, p);
  const cov = conceptCoverage(g, p);
  const ret = retentionSeries(p.reviews);
  const chans = channelStats(g, p);
  const rank = rankOf(st.xp);
  const fading = cov.filter((c) => c.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 4);
  const hasReviews = p.reviews.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="kpis">
        <Kpi k="Complete" v={`${Math.round(st.pct * 100)}%`} s={`${st.done}/${st.total} videos`} />
        <Kpi k="Readiness" v={st.readiness} s={readinessLabel(st.readiness)} hi />
        <Kpi k="Watched" v={fmtDur(st.watchedSecs)} s={`${fmtDur(st.leftSecs)} left`} />
        <Kpi k="Streak" v={`${st.streak}d`} s={`${rank.name} · ${st.xp} XP`} />
        <Kpi k="Recall" v={hasReviews ? `${Math.round(st.recallRate * 100)}%` : "–"} s={`${st.reviews} reviews`} />
        <Kpi k="Challenges" v={`${st.challengesDone}/${st.challengesTotal}`} s="hands-on tasks" />
        <Kpi k="Cards due" v={st.due} s={`${st.mastered}/${st.cards} mastered`} />
      </div>

      <div className="grid g21">
        <Frame label="Concept coverage">
          <div className="row between" style={{ marginBottom: 8 }}><span className="muted" style={{ fontSize: 13 }}>Per concept: watched → recalled → applied</span><LPALegend /></div>
          {cov.length ? cov.map((c) => (
            <div key={c.name} className="crow">
              <span className="nm" title={c.name}>{c.name}</span>
              <LPA l={c.learned} p={c.practiced} a={c.applied} />
              <span className="mono muted">{c.videos}v</span>
            </div>
          )) : <p className="muted">Concept tags come with Claude-built or imported courses.</p>}
        </Frame>
        <Frame label="Readiness">
          <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
            <Ring value={st.readiness / 100} label={`${st.readiness}`} sub={readinessLabel(st.readiness)} size={104} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, minWidth: 0 }}>
              <div><b>Learned</b> <span className="mono">{Math.round(st.learned * 100)}%</span><div className="muted">core videos watched</div></div>
              <div><b>Practised</b> <span className="mono">{Math.round(st.practiced * 100)}%</span><div className="muted">flashcards mastered</div></div>
              <div><b>Applied</b> <span className="mono">{Math.round(st.applied * 100)}%</span><div className="muted">challenges + scenario scores</div></div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn sm" onClick={() => go("scenarios")}>Answer a scenario</button>
            <button className="btn sm" onClick={() => go("cards")}>Review cards</button>
          </div>
        </Frame>
      </div>

      <div className="grid g2">
        <Frame label="Retention · weekly recall accuracy">
          {hasReviews ? <RetentionLine series={ret} /> : <p className="muted">Review a few flashcards and your recall trend appears here.</p>}
          {fading.length > 0 && <div className="ans" style={{ marginTop: 10, fontSize: 14 }}><b>Fading:</b> {fading.map((f) => `${f.name} (${f.overdue} overdue)`).join(", ")}. <button className="linkbtn" onClick={() => go("cards")}>Review now →</button></div>}
        </Frame>
        <Frame label="Last 14 days · minutes">
          <DayBars days={lastNDays(st.act, 14)} />
        </Frame>
      </div>

      <div className="grid g2">
        <Frame label="Study activity">
          <Heatmap act={st.act} weeks={16} />
        </Frame>
        <Frame label={`By channel · ${chans.length}`}>
          {chans.map((c) => (
            <div key={c.id} className="crow">
              <span className="nm">{c.title}</span>
              <div className="bar"><i style={{ width: `${(c.done / c.total) * 100}%`, background: "var(--c1)" }} /></div>
              <span className="mono muted">{c.done}/{c.total}</span>
            </div>
          ))}
          <p className="hint">{chans.length > 1 ? `Most of this course comes from ${chans[0].title}.` : "Add another channel to compare creators."}</p>
        </Frame>
      </div>
    </div>
  );
}
