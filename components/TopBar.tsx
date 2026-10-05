"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopBar() {
  const p = usePathname();
  const on = (h: string) => (h === "/" ? p === "/" : p.startsWith(h)) ? "on" : "";
  return (
    <header className="top noprint">
      <div className="top-in">
        <Link href="/" className="logo"><i />Skill Sprint</Link>
        <nav className="nav">
          <Link href="/" className={on("/")}>Dashboard</Link>
          <Link href="/new" className={on("/new")}>New group</Link>
          <Link href="/settings" className={on("/settings")}>Settings</Link>
        </nav>
      </div>
    </header>
  );
}
