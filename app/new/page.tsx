"use client";
import BuilderForm from "@/components/BuilderForm";
import { Frame, Toaster } from "@/components/ui";

export default function NewGroup() {
  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <Toaster />
      <div>
        <h1 style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800 }}>New learning group</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>Give it YouTube links and the skill you want. You'll get an ordered path, notes, flashcards, challenges and a dashboard.</p>
      </div>
      <div className="grid" style={{ paddingTop: 14 }}><Frame label="Course builder"><BuilderForm /></Frame></div>
    </main>
  );
}
