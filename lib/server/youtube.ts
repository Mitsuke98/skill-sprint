import "server-only";

export type RawVideo = {
  id: string; title: string; desc: string; channelId: string; channelTitle: string; secs: number; publishedAt: string;
};
export type ParsedInput =
  | { kind: "video"; id: string }
  | { kind: "playlist"; id: string }
  | { kind: "channel"; channelId?: string; handle?: string; user?: string; custom?: string };

const KEY = () => process.env.YOUTUBE_API_KEY || "";
const API = "https://www.googleapis.com/youtube/v3/";
const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en-US,en;q=0.9" };

export function parseInput(raw: string): ParsedInput | null {
  let s = raw.trim();
  if (!s) return null;
  if (/^@[\w.-]+$/.test(s)) return { kind: "channel", handle: s.slice(1) };
  if (/^UC[\w-]{22}$/.test(s)) return { kind: "channel", channelId: s };
  if (/^[\w-]{11}$/.test(s)) return { kind: "video", id: s };
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  let u: URL; try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" && parts[0]) return { kind: "video", id: parts[0].slice(0, 11) };
  if (!host.endsWith("youtube.com")) return null;
  const v = u.searchParams.get("v");
  if (v) return { kind: "video", id: v.slice(0, 11) };
  const list = u.searchParams.get("list");
  if (list && parts[0] === "playlist") return { kind: "playlist", id: list };
  if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") return parts[1] ? { kind: "video", id: parts[1].slice(0, 11) } : null;
  if (parts[0]?.startsWith("@")) return { kind: "channel", handle: decodeURIComponent(parts[0].slice(1)) };
  if (parts[0] === "channel" && parts[1]) return { kind: "channel", channelId: parts[1] };
  if (parts[0] === "user" && parts[1]) return { kind: "channel", user: parts[1] };
  if (parts[0] === "c" && parts[1]) return { kind: "channel", custom: parts[1] };
  if (list) return { kind: "playlist", id: list };
  return null;
}

async function yt(path: string, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, key: KEY() });
  const r = await fetch(API + path + "?" + q.toString(), { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `YouTube API error ${r.status}`);
  return j;
}

export function isoToSecs(iso: string) {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

export async function resolveChannel(p: Extract<ParsedInput, { kind: "channel" }>) {
  if (!KEY()) throw new Error("Add YOUTUBE_API_KEY in Vercel to read whole channels.");
  let params: Record<string, string>;
  if (p.channelId) params = { id: p.channelId };
  else if (p.handle) params = { forHandle: "@" + p.handle };
  else if (p.user) params = { forUsername: p.user };
  else {
    const s = await yt("search", { part: "snippet", type: "channel", q: p.custom || "", maxResults: "1" });
    const id = s.items?.[0]?.snippet?.channelId;
    if (!id) throw new Error("Couldn't find that channel.");
    params = { id };
  }
  const j = await yt("channels", { part: "snippet,contentDetails", ...params });
  const c = j.items?.[0];
  if (!c) throw new Error("Couldn't find that channel. Check the link.");
  return { id: c.id as string, title: c.snippet.title as string, uploads: c.contentDetails.relatedPlaylists.uploads as string };
}

export async function playlistVideoIds(playlistId: string, max = 500) {
  const ids: string[] = []; let pageToken = "";
  while (ids.length < max) {
    const j = await yt("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) });
    for (const it of j.items ?? []) ids.push(it.contentDetails.videoId);
    pageToken = j.nextPageToken; if (!pageToken) break;
  }
  return ids.slice(0, max);
}

export async function videoDetails(ids: string[]): Promise<RawVideo[]> {
  const out: RawVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await yt("videos", { part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(",") });
    for (const v of j.items ?? []) out.push({
      id: v.id, title: v.snippet.title, desc: v.snippet.description ?? "", channelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle, secs: isoToSecs(v.contentDetails.duration), publishedAt: v.snippet.publishedAt,
    });
  }
  return out;
}

// Works without an API key: reads the public watch page.
export async function scrapeVideo(id: string): Promise<RawVideo & { captionUrl?: string }> {
  const html = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: UA, cache: "no-store" }).then((r) => r.text());
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|<\/script>)/s);
  if (!m) throw new Error("Couldn't read that video.");
  const pr = JSON.parse(m[1]);
  const d = pr.videoDetails ?? {};
  const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const en = tracks.find((t: { languageCode: string }) => t.languageCode?.startsWith("en")) ?? tracks[0];
  return {
    id, title: d.title ?? id, desc: d.shortDescription ?? "", channelId: d.channelId ?? "", channelTitle: d.author ?? "",
    secs: +(d.lengthSeconds ?? 0), publishedAt: pr.microformat?.playerMicroformatRenderer?.publishDate ?? "", captionUrl: en?.baseUrl,
  };
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// Best-effort transcript: YouTube captions first, then a public transcript mirror. Returns "" when neither works.
export async function transcript(id: string): Promise<{ text: string; source: string }> {
  try {
    const v = await scrapeVideo(id);
    if (v.captionUrl) {
      const t = await fetch(v.captionUrl + "&fmt=json3", { headers: UA, cache: "no-store" }).then((r) => r.text());
      if (t && t.startsWith("{")) {
        const j = JSON.parse(t);
        const text = (j.events ?? []).flatMap((e: { segs?: { utf8: string }[] }) => (e.segs ?? []).map((s) => s.utf8)).join("").replace(/\s+/g, " ").trim();
        if (text.length > 200) return { text, source: "captions" };
      }
    }
  } catch { /* fall through */ }
  try {
    const html = await fetch(`https://youtubetotranscript.com/transcript?v=${id}`, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(15000) }).then((r) => r.text());
    const segs = [...html.matchAll(/<span[^>]*class="[^"]*transcript-segment[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
    let text = segs.join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 200) {
      const main = html.match(/<div[^>]*id="transcript"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? "";
      text = decode(main.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    }
    if (text.length > 200) return { text, source: "mirror" };
  } catch { /* fall through */ }
  return { text: "", source: "none" };
}

export function chaptersFrom(desc: string) {
  return desc.split("\n").map((l) => l.match(/^\s*\(?((?:\d+:)?\d{1,2}:\d{2})\)?\s*[-–—:]?\s*(.+)$/)).filter(Boolean).map((m) => `${m![1]} ${m![2].trim()}`);
}
