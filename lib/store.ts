"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Group, Progress, Video, Level, Scenario, CardState, Source } from "./types";
import { emptyProgress } from "./types";
import { SEED_GROUP } from "./seed";

type State = {
  groups: Group[];
  progress: Record<string, Progress>;
  seeded: boolean;
  addGroup: (g: Group) => void;
  removeGroup: (id: string) => void;
  mergeIntoGroup: (id: string, add: { videos: Video[]; levels?: Level[]; scenarios?: Scenario[]; sources?: Source[] }) => void;
  toggleDone: (gid: string, vid: string) => void;
  setRecall: (gid: string, vid: string, ok: boolean) => void;
  setChallenge: (gid: string, lid: string) => void;
  gradeCard: (gid: string, key: string, ok: boolean, concept?: string) => void;
  answerScenario: (gid: string, sid: string, answer: string, score: number, feedback: string) => void;
  setPlan: (gid: string, p: Partial<Pick<Progress, "speed" | "start">>) => void;
  replaceAll: (groups: Group[], progress: Record<string, Progress>) => void;
  seedIfNeeded: () => void;
};

const DAY = 86400000;
export const BOX_DAYS = [0, 1, 3, 7, 16, 35];

const prog = (s: State, gid: string) => s.progress[gid] ?? emptyProgress();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      groups: [],
      progress: {},
      seeded: false,
      addGroup: (g) => set((s) => ({ groups: [g, ...s.groups], progress: { ...s.progress, [g.id]: emptyProgress() } })),
      removeGroup: (id) => set((s) => {
        const p = { ...s.progress }; delete p[id];
        return { groups: s.groups.filter((g) => g.id !== id), progress: p };
      }),
      mergeIntoGroup: (id, add) => set((s) => ({
        groups: s.groups.map((g) => {
          if (g.id !== id) return g;
          const have = new Set(g.videos.map((v) => v.id));
          const levels = [...g.levels];
          for (const l of add.levels ?? []) if (!levels.find((x) => x.id === l.id)) {
            const bonusIdx = levels.findIndex((x) => x.bonus);
            if (bonusIdx >= 0 && !l.bonus) levels.splice(bonusIdx, 0, l); else levels.push(l);
          }
          const srcHave = new Set(g.sources.map((x) => x.kind + x.id));
          return {
            ...g,
            levels,
            videos: [...g.videos, ...add.videos.filter((v) => !have.has(v.id))],
            scenarios: [...g.scenarios, ...(add.scenarios ?? [])],
            sources: [...g.sources, ...(add.sources ?? []).filter((x) => !srcHave.has(x.kind + x.id))],
          };
        }),
      })),
      toggleDone: (gid, vid) => set((s) => {
        const p = prog(s, gid), done = { ...p.done };
        if (done[vid]) delete done[vid]; else done[vid] = Date.now();
        return { progress: { ...s.progress, [gid]: { ...p, done } } };
      }),
      setRecall: (gid, vid, ok) => set((s) => {
        const p = prog(s, gid);
        return { progress: { ...s.progress, [gid]: { ...p, recall: { ...p.recall, [vid]: ok } } } };
      }),
      setChallenge: (gid, lid) => set((s) => {
        const p = prog(s, gid);
        return { progress: { ...s.progress, [gid]: { ...p, challenges: { ...p.challenges, [lid]: Date.now() } } } };
      }),
      gradeCard: (gid, key, ok, concept) => set((s) => {
        const p = prog(s, gid);
        const c: CardState = p.cards[key] ?? { box: 0, due: 0, right: 0, wrong: 0 };
        const box = ok ? Math.min(c.box + 1, BOX_DAYS.length - 1) : 0;
        const next: CardState = { box, due: Date.now() + BOX_DAYS[box] * DAY, right: c.right + (ok ? 1 : 0), wrong: c.wrong + (ok ? 0 : 1) };
        const reviews = [...p.reviews, { t: Date.now(), ok, concept }].slice(-3000);
        return { progress: { ...s.progress, [gid]: { ...p, cards: { ...p.cards, [key]: next }, reviews } } };
      }),
      answerScenario: (gid, sid, answer, score, feedback) => set((s) => {
        const p = prog(s, gid);
        return { progress: { ...s.progress, [gid]: { ...p, scenarios: { ...p.scenarios, [sid]: { t: Date.now(), answer, score, feedback } } } } };
      }),
      setPlan: (gid, pl) => set((s) => ({ progress: { ...s.progress, [gid]: { ...prog(s, gid), ...pl } } })),
      replaceAll: (groups, progress) => set({ groups, progress, seeded: true }),
      seedIfNeeded: () => {
        if (get().seeded) return;
        const exists = get().groups.some((g) => g.id === SEED_GROUP.id);
        set((s) => ({
          seeded: true,
          groups: exists ? s.groups : [...s.groups, SEED_GROUP],
          progress: exists ? s.progress : { ...s.progress, [SEED_GROUP.id]: emptyProgress() },
        }));
      },
    }),
    { name: "skill-sprint-v1", storage: createJSONStorage(() => localStorage), version: 1 }
  )
);

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const done = () => { useStore.getState().seedIfNeeded(); setH(true); };
    if (useStore.persist.hasHydrated()) done();
    return useStore.persist.onFinishHydration(done);
  }, []);
  return h;
}

export const getProgress = (all: Record<string, Progress>, gid: string) => all[gid] ?? emptyProgress();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
