"use client";
import { useEffect, useState } from "react";

export const CheckSvg = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
);

export function Kpi({ k, v, s, hi }: { k: string; v: React.ReactNode; s?: React.ReactNode; hi?: boolean }) {
  return <div className={"kpi" + (hi ? " hi" : "")}><span className="k">{k}</span><span className="v">{v}</span>{s && <span className="s">{s}</span>}</div>;
}

export function Frame({ label, children, sel, style, className = "" }: { label?: React.ReactNode; children: React.ReactNode; sel?: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <section className={`frame ${sel ? "sel" : ""} ${className}`} style={style}>
      {label && <span className="fl"># <b>{label}</b></span>}
      {sel && <><span className="handle h1" /><span className="handle h2" /><span className="handle h3" /><span className="handle h4" /></>}
      {children}
    </section>
  );
}

let setToastGlobal: ((m: string) => void) | null = null;
export function toast(m: string) { setToastGlobal?.(m); }
export function Toaster() {
  const [msg, setMsg] = useState(""); const [show, setShow] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    setToastGlobal = (m) => { setMsg(m); setShow(true); clearTimeout(t); t = setTimeout(() => setShow(false), 3200); };
    return () => { setToastGlobal = null; clearTimeout(t); };
  }, []);
  return <div className={"toast" + (show ? " show" : "")} role="status" aria-live="polite">{msg}</div>;
}

export function confetti() {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.getElementById("confetti") as HTMLCanvasElement | null; if (!cv) return;
  const ctx = cv.getContext("2d")!; cv.width = innerWidth; cv.height = innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--c1", "--c2", "--c3", "--c4"].map((k) => cs.getPropertyValue(k).trim());
  const P = Array.from({ length: 140 }, () => ({ x: cv.width / 2, y: cv.height * 0.35, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 4, r: Math.random() * 6 + 3, c: cols[(Math.random() * 4) | 0], a: Math.random() * 6 }));
  let f = 0;
  const tick = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of P) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
    if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  tick();
}

export function downloadJSON(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Loading() { return <main className="wrap"><p className="muted">Loading your progress…</p></main>; }
