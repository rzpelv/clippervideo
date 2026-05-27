# ClipperVideo

AI-assisted video clipper that runs entirely in your browser. Upload a video, set in/out points, and download a trimmed MP4 — all without uploading the video to a server. Optional OpenAI integration adds Whisper transcription and GPT-powered highlight suggestions.

## Features

- **In-browser trimming** with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — fast stream-copy or accurate re-encode
- **Drag-and-drop upload** _or_ paste a URL (YouTube, TikTok, Vimeo, X, direct .mp4, …) — server resolves it via `yt-dlp` and streams the video to the browser
- **Scrubbable timeline** with draggable in/out handles, and "mark in / mark out" buttons
- **AI transcription** via OpenAI Whisper, with timestamped segments — click to jump
- **AI highlight suggestions** via GPT (default `gpt-4o-mini`) — pick the best ~30s moments and load them into the clipper with one click
- **Local-first**: video, transcript, and OpenAI API key never leave your browser (the API key talks directly to api.openai.com)

## Stack

- Vite + React + TypeScript
- `@ffmpeg/ffmpeg` 0.12 (WASM)
- OpenAI HTTP API (Whisper + Chat Completions)
- Tiny zero-dep Node static server that also exposes `POST /api/fetch-video`
- `yt-dlp` (server-side) for paste-URL ingestion

## Getting started

```bash
npm install
# Terminal 1 — Vite dev server (5173):
npm run dev
# Terminal 2 — Node API + static server (4173):
node server.js
```

Vite proxies `/api/*` to `http://localhost:4173`, so the URL-fetch feature works in dev too. To enable URL fetching beyond direct video links, install `yt-dlp` (and `ffmpeg`) on your machine, e.g. `pip install yt-dlp` or `brew install yt-dlp ffmpeg`.

The dev server sets the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers required by `SharedArrayBuffer` (which ffmpeg.wasm needs). If you deploy this app, your host must serve those headers too.

### Loading a video

- **Upload** — drop a file or click to browse
- **Paste URL** — paste a video URL into the input below the dropzone
  - Direct video URLs (`.mp4`, `.webm`, `.mov`, …) are streamed through the server (CORS bypass) and never hit disk
  - Anything else is resolved via `yt-dlp` (downloaded to a temp dir, streamed to the browser, then deleted)

### Using the AI features

1. Click **Set API key** in the header
2. Paste an OpenAI API key (`sk-...`) and optionally pick a chat model
3. Load a video, click **Transcribe with Whisper**
4. Click **Suggest highlights** — AI picks engaging moments
5. Click **Use this clip** on a suggestion to load its in/out points, then **Clip & download**

## Build

```bash
npm run build
npm start   # serves dist/ on $PORT (default 4173) with COOP/COEP headers
```

## Deploy to Railway

The repo's `railway.json` selects the **Dockerfile** builder. The image installs `python3`, `ffmpeg`, and `yt-dlp` so the paste-URL feature works out of the box.

1. Railway → New Project → Deploy from GitHub repo → pick this repo
2. Railway reads `railway.json` and builds with the included `Dockerfile`
3. Settings → Networking → **Generate Domain** (Railway gives HTTPS, required by `SharedArrayBuffer`)
4. Done — the public URL works as both the static site and the `POST /api/fetch-video` API

No environment variables are required. Optional ones:

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Listen port (Railway sets this automatically) |
| `MAX_VIDEO_BYTES` | `2147483648` (2 GiB) | Hard cap per fetched video |
| `FETCH_VIDEO_TIMEOUT_MS` | `900000` (15 min) | yt-dlp / direct-fetch timeout |
| `YTDLP_BIN` | `yt-dlp` | Override path to the yt-dlp binary |

The healthcheck path is `/healthz`.

## Notes / limitations

- ffmpeg.wasm runs single-threaded by default in this setup; large videos can be slow. For long content, the unchecked "Re-encode" option uses stream copy and is much faster (cuts may snap to the nearest keyframe).
- Whisper has a 25 MB upload limit per request. The app extracts a mono 16 kHz MP3 first, which keeps most clips under that limit. Very long videos may need to be split.
- No content from your video is sent anywhere unless you run an AI action — and even then it goes directly to OpenAI from your browser.
- **Paste-URL responsibility**: `yt-dlp` can fetch from many sites, but downloading from YouTube and most platforms is against their Terms of Service. Use the feature only for videos you have the right to download (your own uploads, Creative Commons content, sites that explicitly allow it, etc.). The server enforces a max video size and rejects requests to private/internal hosts (basic SSRF guard), but does not police copyright — that is the operator's responsibility.
