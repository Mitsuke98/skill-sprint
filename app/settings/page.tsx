"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, useHydrated } from "@/lib/store";
import { Frame, Loading, Toaster, downloadJSON, toast } from "@/components/ui";
import type { BackupFile } from "@/lib/types";

export default function Settings() {
  const ok = useHydrated();
  const groups = useStore((s) => s.groups);
  const progress = useStore((s) => s.progress);
  const replaceAll = useStore((s) => s.replaceAll);
  const [status, setStatus] = useState<{ youtube: boolean; ai: boolean } | null>(null);
  const [confirm, setConfirm] = useState<null | "restore" | "reset">(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ youtube: false, ai: false })); }, []);
  if (!ok) return <Loading />;

  async function pick(f?: File) {
    if (!f) return; setErr("");
    try { const j = JSON.parse(await f.text()) as BackupFile; if (j.format !== "skill-sprint-backup") throw new Error(); setPending(j); setConfirm("restore"); }
    catch { setErr("That file isn't a Skill Sprint backup. Course files go in New group → Import."); }
  }
  const dot = (on?: boolean) => <span className="chip" style={on ? { background: "var(--ok-soft)", color: "var(--ok)" } : { background: "var(--redline-soft)", color: "var(--redline)" }}>{on ? "Connected" : "Not set"}</span>;

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <Toaster />
      <h1 style={{ fontSize: 34, fontWeight: 800 }}>Settings</h1>
      <div className="grid" style={{ gap: 38 }}>
        <Frame label="Backup & move devices">
          <p className="muted" style={{ marginTop: 0 }}>Your groups and progress live in this browser. Export a backup to keep it safe or to move it to another device.</p>
          <div className="row">
            <button className="btn pri" onClick={() => downloadJSON(`skill-sprint-backup-${new Date().toISOString().slice(0, 10)}.json`, { format: "skill-sprint-backup", version: 1, groups, progress } satisfies BackupFile)}>Export backup</button>
            <button className="btn" onClick={() => ref.current?.click()}>Restore from backup</button>
            <input ref={ref} type="file" accept=".json" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          {confirm === "restore" && pending && <div className="ans" style={{ marginTop: 12 }}>Replace everything on this device with {pending.groups.length} groups from the backup? <div className="row" style={{ marginTop: 8 }}><button className="btn danger" onClick={() => { replaceAll(pending.groups, pending.progress); setConfirm(null); toast("Backup restored"); }}>Replace</button><button className="btn" onClick={() => setConfirm(null)}>Cancel</button></div></div>}
          {err && <p className="hint" style={{ color: "var(--bad)" }}>{err}</p>}
        </Frame>
        <Frame label="Connections">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="row between"><span><b>YouTube Data API</b><br /><span className="muted" style={{ fontSize: 13 }}>Reads channels and playlists. Free from Google Cloud Console.</span></span>{dot(status?.youtube)}</div>
            <div className="row between"><span><b>Claude API</b><br /><span className="muted" style={{ fontSize: 13 }}>Builds courses automatically and grades scenarios.</span></span>{dot(status?.ai)}</div>
          </div>
          <p className="hint">Keys are set as environment variables in Vercel (Project → Settings → Environment Variables), never in the browser.</p>
        </Frame>
        <Frame label="Reset">
          <p className="muted" style={{ marginTop: 0 }}>Delete every group and all progress on this device.</p>
          {confirm === "reset" ? <div className="row"><button className="btn danger" onClick={() => { replaceAll([], {}); setConfirm(null); toast("Everything cleared"); }}>Delete everything</button><button className="btn" onClick={() => setConfirm(null)}>Cancel</button></div> : <button className="btn danger" onClick={() => setConfirm("reset")}>Reset app</button>}
        </Frame>
      </div>
    </main>
  );
}
