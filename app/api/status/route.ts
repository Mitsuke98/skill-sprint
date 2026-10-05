import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ youtube: !!process.env.YOUTUBE_API_KEY, ai: !!process.env.ANTHROPIC_API_KEY });
}
