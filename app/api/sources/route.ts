import { NextResponse } from "next/server";
import { parseInput, resolveChannel, playlistVideoIds, videoDetails, scrapeVideo, chaptersFrom, type RawVideo } from "@/lib/server/youtube";
export const maxDuration = 60;

type Src = { kind: "video" | "channel"; url: string; id: string; title: string };

export async function POST(req: Request) {
  const { inputs, max = 500, skipShorts = true } = (await req.json()) as { inputs: string[]; max?: number; skipShorts?: boolean };
  const sources: Src[] = [], videos: RawVideo[] = [], errors: string[] = [];
  const hasKey = !!process.env.YOUTUBE_API_KEY;
  for (const url of inputs.filter((x) => x && x.trim())) {
    const p = parseInput(url);
    if (!p) { errors.push(`Not a YouTube link: ${url}`); continue; }
    try {
      if (p.kind === "video") {
        const v = hasKey ? (await videoDetails([p.id]))[0] : await scrapeVideo(p.id);
        if (!v) throw new Error("Video not found.");
        const { id, title, desc, channelId, channelTitle, secs, publishedAt } = v;
        videos.push({ id, title, desc, channelId, channelTitle, secs, publishedAt });
        sources.push({ kind: "video", url, id: v.id, title: v.title });
      } else if (p.kind === "playlist") {
        if (!hasKey) throw new Error("Add YOUTUBE_API_KEY in Vercel to read playlists.");
        const ids = await playlistVideoIds(p.id, max);
        const vs = await videoDetails(ids);
        videos.push(...vs);
        sources.push({ kind: "channel", url, id: p.id, title: vs[0]?.channelTitle ? `${vs[0].channelTitle} playlist` : "Playlist" });
      } else {
        const c = await resolveChannel(p);
        const ids = await playlistVideoIds(c.uploads, max);
        const vs = await videoDetails(ids);
        videos.push(...vs);
        sources.push({ kind: "channel", url, id: c.id, title: c.title });
      }
    } catch (e) { errors.push(`${url}: ${(e as Error).message}`); }
  }
  const seen = new Set<string>();
  const unique = videos.filter((v) => !seen.has(v.id) && seen.add(v.id)).filter((v) => !skipShorts || v.secs === 0 || v.secs > 75);
  return NextResponse.json({
    sources, errors,
    videos: unique.map((v) => ({ ...v, chapters: chaptersFrom(v.desc) })),
  });
}
