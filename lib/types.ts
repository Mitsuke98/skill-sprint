// Course content (what a group teaches)
export type Card = { q: string; a: string };

export type Video = {
  id: string;            // YouTube video id
  title: string;
  channelId: string;
  channelTitle: string;
  secs: number;          // duration in seconds
  level: string;         // Level id
  kind: "hands-on" | "partial" | "concept";
  sum: string;           // one-line summary
  pts: string[];         // key lessons
  cards: Card[];
  concepts: string[];    // concept tags, e.g. "Typography"
  addedAt: number;
};

export type Level = { id: string; name: string; goal: string; challenge: string; bonus?: boolean };

export type Scenario = { id: string; prompt: string; concepts: string[]; model: string };

export type Source = { kind: "video" | "channel"; url: string; id: string; title: string };

export type Group = {
  id: string;
  skill: string;         // e.g. "Figma"
  category: string;      // e.g. "Design"
  createdAt: number;
  sources: Source[];
  levels: Level[];
  videos: Video[];
  scenarios: Scenario[];
  built: "ai" | "tracker" | "import";
};

// Progress (what you've done)
export type CardState = { box: number; due: number; right: number; wrong: number };
export type Review = { t: number; ok: boolean; concept?: string };
export type ScenarioAnswer = { t: number; answer: string; score: number; feedback: string }; // score 0–100

export type Progress = {
  done: Record<string, number>;          // videoId -> timestamp
  recall: Record<string, boolean>;       // videoId -> recall correct
  challenges: Record<string, number>;    // levelId -> timestamp
  cards: Record<string, CardState>;      // "videoId#i" -> state
  reviews: Review[];                     // flashcard review log
  scenarios: Record<string, ScenarioAnswer>;
  speed: number;
  start: string;                         // "10:00" day-plan start
};

export const emptyProgress = (): Progress => ({
  done: {}, recall: {}, challenges: {}, cards: {}, reviews: [], scenarios: {}, speed: 1.25, start: "10:00",
});

// Portable file format for import/export
export type CourseFile = { format: "skill-sprint-course"; version: 1; group: Omit<Group, "id" | "createdAt"> & Partial<Pick<Group, "id" | "createdAt">> };
export type BackupFile = { format: "skill-sprint-backup"; version: 1; groups: Group[]; progress: Record<string, Progress> };
