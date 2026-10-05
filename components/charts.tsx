"use client";
import { dayKey, fmtDur } from "@/lib/metrics";

export function Ring({ value, size = 96, label, sub }: { value: number; size?: number; label: string; sub?: string }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ok)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset .6s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", lineHeight: 1 }}>
        <div><div style={{ font: `800 ${size / 4}px var(--f-display)` }}>{label}</div>{sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}</div>
      </div>
    </div>
  );
}

// Radar of readiness per skill (0–100)
export function Radar({ items }: { items: { name: string; value: number }[] }) {
  if (items.length < 3) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
      {items.map((it) => (
        <div key={it.name}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{it.name}</span><span className="mono" style={{ color: "var(--select)" }}>{it.value}</span></div>
          <div className="bar" style={{ height: 14, marginTop: 6 }}><i style={{ width: `${it.value}%`, background: "var(--select)" }} /></div>
        </div>
      ))}
      <p className="hint" style={{ margin: 0 }}>Add a third skill to see your profile as a radar chart.</p>
    </div>
  );
  const W = 360, H = 300, cx = W / 2, cy = H / 2 + 4, R = 105;
  const n = Math.max(items.length, 3);
  const pts = (scale: number) => Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    return [cx + Math.cos(a) * R * scale, cy + Math.sin(a) * R * scale] as const;
  });
  const val = items.map((it, i) => {
    const a = -Math.PI / 2 + (i / n) * 2 * Math.PI, s = Math.max(0.02, it.value / 100);
    return [cx + Math.cos(a) * R * s, cy + Math.sin(a) * R * s] as const;
  });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 460, margin: "0 auto" }} role="img" aria-label="Skill readiness radar">
      {[0.25, 0.5, 0.75, 1].map((s) => <polygon key={s} points={pts(s).map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--line)" />)}
      {pts(1).map((p, i) => <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--line)" />)}
      {items.length >= 3 && <polygon points={val.map((p) => p.join(",")).join(" ")} fill="var(--select)" fillOpacity=".18" stroke="var(--select)" strokeWidth="2" />}
      {items.length < 3 && val.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--select)" strokeWidth="4" strokeLinecap="round" />)}
      {val.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--select)" />)}
      {items.map((it, i) => {
        const a = -Math.PI / 2 + (i / n) * 2 * Math.PI, x = cx + Math.cos(a) * (R + 18), y = cy + Math.sin(a) * (R + 16);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>{it.name.length > 16 ? it.name.slice(0, 15) + "…" : it.name} <tspan style={{ fill: "var(--select)" }}>{it.value}</tspan></text>;
      })}
      <text x={cx + 4} y={cy - R * 0.5} style={{ fontSize: 9 }}>50</text>
    </svg>
  );
}

// GitHub-style heatmap, last `weeks` weeks
export function Heatmap({ act, weeks = 18 }: { act: Record<string, number>; weeks?: number }) {
  const cell = 13, gap = 3, top = 16, left = 22;
  const end = new Date(); const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1) - end.getDay());
  const days: { k: string; x: number; y: number; s: number; d: Date }[] = [];
  const d = new Date(start);
  for (let i = 0; d <= end; i++) { const k = dayKey(d.getTime()); days.push({ k, x: Math.floor(i / 7), y: d.getDay(), s: act[k] ?? 0, d: new Date(d) }); d.setDate(d.getDate() + 1); }
  const lvl = (s: number) => (s <= 0 ? 0 : s < 900 ? 1 : s < 2700 ? 2 : s < 5400 ? 3 : 4);
  const op = [0, 0.3, 0.55, 0.8, 1];
  const W = left + (weeks + 1) * (cell + gap), H = top + 7 * (cell + gap);
  const months: { x: number; label: string }[] = [];
  days.forEach((c) => { if (c.d.getDate() <= 7 && c.y === 0) months.push({ x: c.x, label: c.d.toLocaleDateString([], { month: "short" }) }); });
  return (
    <div style={{ overflowX: "auto" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 300, maxWidth: W * 1.6 }} role="img" aria-label="Study activity by day">
        {months.map((m, i) => <text key={i} x={left + m.x * (cell + gap)} y={10}>{m.label}</text>)}
        {["M", "W", "F"].map((t, i) => <text key={t} x={0} y={top + (i * 2 + 1) * (cell + gap) + 10}>{t}</text>)}
        {days.map((c) => (
          <rect key={c.k} x={left + c.x * (cell + gap)} y={top + c.y * (cell + gap)} width={cell} height={cell} rx="3"
            fill={lvl(c.s) ? "var(--ok)" : "var(--line)"} fillOpacity={lvl(c.s) ? op[lvl(c.s)] : 1}>
            <title>{c.d.toLocaleDateString()} · {c.s ? fmtDur(c.s) : "no study"}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

// Vertical bars for the last N days
export function DayBars({ days }: { days: { key: string; label: string; secs: number }[] }) {
  const W = 360, H = 150, top = 16, bottom = 22, left = 30;
  const maxMin = Math.max(30, ...days.map((d) => d.secs / 60));
  const step = maxMin > 120 ? 60 : maxMin > 60 ? 30 : 15;
  const ymax = Math.ceil(maxMin / step) * step;
  const bw = (W - left) / days.length;
  const y = (m: number) => top + (H - top - bottom) * (1 - m / ymax);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Minutes studied per day">
      {Array.from({ length: ymax / step + 1 }, (_, i) => i * step).map((m) => (
        <g key={m}><line x1={left} x2={W} y1={y(m)} y2={y(m)} stroke="var(--line)" /><text x={left - 6} y={y(m) + 4} textAnchor="end">{m}</text></g>
      ))}
      {days.map((d, i) => {
        const m = d.secs / 60, last = i === days.length - 1;
        return (
          <g key={d.key}>
            <rect x={left + i * bw + bw * 0.2} y={y(m)} width={bw * 0.6} height={Math.max(0, y(0) - y(m))} rx="3" fill={last ? "var(--select)" : "var(--c1)"} fillOpacity={last ? 1 : 0.45} />
            <text x={left + i * bw + bw / 2} y={H - 6} textAnchor="middle" style={last ? { fill: "var(--ink)", fontWeight: 700 } : undefined}>{d.label}</text>
          </g>
        );
      })}
      <text x={left} y={10}>min</text>
    </svg>
  );
}

// Weekly recall accuracy line
export function RetentionLine({ series }: { series: { label: string; acc: number | null; n: number }[] }) {
  const W = 360, H = 160, top = 14, bottom = 22, left = 34, right = 10;
  const x = (i: number) => left + (i * (W - left - right)) / Math.max(1, series.length - 1);
  const y = (v: number) => top + (H - top - bottom) * (1 - v);
  const pts = series.map((s, i) => (s.acc == null ? null : [x(i), y(s.acc)] as const));
  let path = "", pen = false;
  for (const p of pts) { if (!p) { pen = false; continue; } path += `${pen ? " L" : " M"}${p[0]} ${p[1]}`; pen = true; }
  const lastIdx = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0).pop();
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flashcard recall accuracy by week">
      {[0, 0.5, 1].map((v) => <g key={v}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={left - 6} y={y(v) + 4} textAnchor="end">{v * 100}%</text></g>)}
      {path && <path d={path.trim()} fill="none" stroke="var(--redline)" strokeWidth="2.2" strokeLinejoin="round" />}
      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={i === lastIdx ? 5 : 3} fill={i === lastIdx ? "var(--redline)" : "var(--frame)"} stroke="var(--redline)" strokeWidth="2" />)}
      {series.map((s, i) => (i % 2 === series.length % 2 || i === series.length - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{s.label}</text>)}
    </svg>
  );
}

export function LPA({ l, p, a }: { l: number; p: number; a: number }) {
  // three stacked thirds: Learned, Practised, Applied
  return (
    <div className="stack" title={`Learned ${Math.round(l * 100)}% · Practised ${Math.round(p * 100)}% · Applied ${Math.round(a * 100)}%`}>
      <i style={{ width: `${(l * 100) / 3}%`, background: "var(--c1)" }} />
      <i style={{ width: `${(p * 100) / 3}%`, background: "var(--c3)" }} />
      <i style={{ width: `${(a * 100) / 3}%`, background: "var(--c2)" }} />
    </div>
  );
}
export function LPALegend() {
  return <div className="legend"><span><i style={{ background: "var(--c1)" }} />Learned (watched)</span><span><i style={{ background: "var(--c3)" }} />Practised (flashcards)</span><span><i style={{ background: "var(--c2)" }} />Applied (challenges + scenarios)</span></div>;
}
