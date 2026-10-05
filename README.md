# Skill Sprint

Turn YouTube into gamified courses. Give it one video, one channel, or several channels plus the skill you want to learn. It keeps only the videos that teach that skill and orders them so each builds on the last. Then it writes notes, flashcards, level challenges and real-world scenarios, and tracks everything on dashboards.

Your Kole Jain Figma course is preloaded.

## Deploy to Vercel (about 5 minutes)

1. Unzip this folder and push it to a new GitHub repo:
   ```bash
   cd skill-sprint
   git init && git add . && git commit -m "Skill Sprint v1"
   git branch -M main
   git remote add origin https://github.com/<you>/skill-sprint.git
   git push -u origin main
   ```
2. Go to vercel.com → **Add New… → Project** → import the repo. The framework is detected as Next.js; keep the defaults.
3. Before clicking Deploy, open **Environment Variables** and add the keys below (you can also add them later, then redeploy).
4. Click **Deploy**.

Alternatively, run `npx vercel` from inside the folder.

## Keys

| Variable | Needed for | Where to get it | Cost |
|---|---|---|---|
| `YOUTUBE_API_KEY` | Reading whole channels and playlists | console.cloud.google.com → create a project → enable **YouTube Data API v3** → Credentials → API key | Free (10,000 units/day, a 500-video channel uses about 25) |
| `ANTHROPIC_API_KEY` | The automatic builder and scenario grading | console.anthropic.com → API keys | Pay per use. A 40-video course is roughly $0.50–$1.50 |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-sonnet-5-5` | | |

What works without keys:
- **Import a course file** always works. On the New group page, choose Import, copy the prompt, paste it into a Claude chat with the links, and upload the file Claude gives back.
- **Single videos** can be read without a YouTube key.
- **Tracker only** needs only the YouTube key.
- **Scenarios**, without a Claude key, show the model answer and you rate yourself.

## How it works

- **New group**: one video, one channel, or several channels, plus a skill and an optional focus. You pick a build method: Automatic (Claude), Tracker only, or Import.
- **Automatic build**: the app fetches the video list, then Claude filters and orders it into levels. For each video it reads the transcript and writes notes and flashcards. Finally it writes level challenges and real-world scenarios. The progress log shows each step.
- **Add videos**: inside a group, add a video, a channel or several channels. New videos slot into your existing levels, duplicates are skipped, and your progress stays.
- **Group tabs**: Dashboard (KPIs, concept coverage, retention, activity, by channel), Path (learning path or by-channel view), Flashcards (spaced repetition at 1/3/7/16/35 days), Notes (searchable), Scenarios, and Day plan.
- **Main dashboard**: skill profile radar, skill types, real-world readiness (Learned → Practised → Applied), this week, activity heatmap, and a next best step.
- **PDF notes**: open a group, click PDF notes, then Save as PDF.

### Readiness score
`readiness = 30% learned + 30% practised + 40% applied`
- **Learned**: the share of core videos watched.
- **Practised**: flashcards mastered (known at least twice in a row), plus recall accuracy.
- **Applied**: level challenges completed, plus scenario scores.

## Your data

Groups and progress are stored in your browser (localStorage). To move to another device or keep a copy, use **Settings → Export backup**, then **Restore** on the other device. Each group can also be exported as a course file to share.

## Transcripts: known limitation

Transcripts are fetched on the server: first from YouTube captions, then from a public transcript mirror. YouTube sometimes blocks caption requests from cloud servers such as Vercel. When that happens, that video's notes are written from its title, description and chapters, and the build log tells you how many were affected. For the richest notes on an important course, use the Import route and let Claude in chat build the course file.

## Local development

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                  # http://localhost:3000
```

## Course file format

```json
{
  "format": "skill-sprint-course", "version": 1,
  "group": {
    "skill": "Figma", "category": "Design",
    "sources": [{ "kind": "channel", "url": "", "id": "UC…", "title": "Kole Jain" }],
    "levels": [{ "id": "l1", "name": "Warm-up", "goal": "", "challenge": "", "bonus": false }],
    "videos": [{ "id": "YouTube id", "title": "", "channelId": "", "channelTitle": "", "secs": 560,
      "level": "l1", "kind": "hands-on|partial|concept", "sum": "", "pts": [""], "cards": [{ "q": "", "a": "" }], "concepts": [""] }],
    "scenarios": [{ "id": "s1", "prompt": "", "concepts": [""], "model": "" }]
  }
}
```
See `public/examples/kole-jain-figma.course.json` for a full example.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Zustand · hand-built SVG charts · Vercel serverless functions for the YouTube and Claude calls.
