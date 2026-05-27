# ClipperVideo

AI-assisted video clipper that runs entirely in your browser. Upload a video (or paste a URL), let AI auto-clip the best moments with hook titles, then download a trimmed MP4 — all without uploading the video to a server.

## Features

- **In-browser trimming** with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — fast stream-copy or accurate re-encode
- **Drag-and-drop upload** _or_ paste a URL (YouTube, TikTok, Vimeo, X, direct .mp4, …) — server resolves it via `yt-dlp` and streams the video to the browser
- **Scrubbable timeline** with draggable in/out handles, and "mark in / mark out" buttons
- **One-click AI Auto-Clip**: transcribes the video, picks the best 5 moments, writes hook-style titles in the source language, and shows the per-clip transcript — all in one button
- **Bring-your-own-AI**: works with any OpenAI-compatible provider (OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Together AI, local Ollama, …) — separate transcription and chat providers if you want
- **Local-first**: video, transcript, and API keys never leave your browser

## Stack

- Vite + React + TypeScript
- `@ffmpeg/ffmpeg` 0.12 (WASM)
- Any OpenAI-compatible HTTP API for Whisper-style transcription + Chat Completions
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

1. Click **Set up AI** (or **AI Providers**) in the header
2. Pick a provider preset, paste an API key, and (optionally) tweak the model name
3. Load a video, click **✨ Auto-clip with AI**
4. Each suggested clip card shows: hook title, time range, the transcript of those words, and one-sentence reason. Click **Use this clip ↑** to load it into the timeline, then **Clip &amp; download**.

### AI providers

ClipperVideo speaks the OpenAI HTTP API. Any compatible provider works — just pick a preset (or fill in a custom base URL) and your key. **Transcription and chat use separate configurations**, so you can mix providers (e.g. Groq for fast Whisper + OpenRouter for any chat model).

| Preset | Transcription | Chat | Notes |
| --- | --- | --- | --- |
| **OpenAI** | `whisper-1` | `gpt-4o-mini` | Default. Reliable. |
| **Groq** ⚡ | `whisper-large-v3` | `llama-3.3-70b-versatile` | ~10× faster, ~5-10× cheaper than OpenAI. Best ratio for this app. |
| **OpenRouter** | — | Claude / Gemini / GPT / Llama / … | Gateway to any model with one key. No Whisper. |
| **DeepSeek** | — | `deepseek-chat` | Very cheap LLM. |
| **Mistral** | — | `mistral-large-latest` | EU provider. |
| **Together AI** | — | Llama, Qwen, Mixtral, … | Open-weights hosting. |
| **Ollama (local)** | — | Whatever you've pulled (`llama3.2`, …) | Run it on your machine. Privacy-first. |
| **Custom** | configurable | configurable | Any other OpenAI-compatible endpoint. |

A common combo: pick **Groq** in the Quick-setup row, leave the "Use the same provider &amp; API key for both" box checked, paste your Groq key. That's it — both transcription and hook generation are wired up to Groq with sensible model defaults.

If you need a different provider for chat (say Claude via OpenRouter): uncheck the linked-key box, change the **Chat / Hook generation** section's provider to OpenRouter, and paste your OpenRouter key there.

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

No environment variables are required (AI keys are entered per-user in the browser). Optional ones:

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Listen port (Railway sets this automatically) |
| `MAX_VIDEO_BYTES` | `2147483648` (2 GiB) | Hard cap per fetched video |
| `FETCH_VIDEO_TIMEOUT_MS` | `900000` (15 min) | yt-dlp / direct-fetch timeout |
| `YTDLP_BIN` | `yt-dlp` | Override path to the yt-dlp binary |
| `YTDLP_AUTO_UPDATE` | `true` | Set `false` to skip the on-startup `yt-dlp --update-to <channel>` |
| `YTDLP_UPDATE_CHANNEL` | `nightly` | Update channel — `nightly` (recommended for YouTube), `stable`, or a specific tag |
| `YTDLP_COOKIES` | _(unset)_ | Inline Netscape-format cookies file content (see below) |
| `YTDLP_COOKIES_FILE` | _(unset)_ | Alternative: path to an existing cookies file |
| `YTDLP_EXTRACTOR_ARGS` | `youtube:player_client=default,android,ios,web_safari` | Custom yt-dlp `--extractor-args` |
| `YTDLP_USER_AGENT` | _Safari macOS_ | Custom `--user-agent` for yt-dlp |

The healthcheck path is `/healthz`.

### Handling the YouTube "Sign in to confirm you're not a bot" error

YouTube increasingly blocks unauthenticated requests from datacenter IPs (Railway, Fly, Render, AWS, …). When this happens yt-dlp returns:

> ERROR: [youtube] XXXXX: Sign in to confirm you're not a bot.

The reliable workaround is to give yt-dlp a cookie jar from a logged-in browser session.

1. **Export cookies from your browser** using a Netscape-format extension, e.g.
   - Chrome / Edge: ["Get cookies.txt LOCALLY"](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: ["cookies.txt"](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
   - Visit `youtube.com` while logged in, click the extension, export — you get a plain-text file
2. **Set it as a Railway env var**:
   - Service → **Variables** → New Variable
   - Name: `YTDLP_COOKIES`
   - Value: paste the **entire content** of the cookies file (multi-line is fine)
   - Redeploy
3. The server writes the cookies to a private temp file at startup and passes `--cookies` to yt-dlp on every YouTube request.

Cookies expire (typically 1–2 weeks for YouTube). When you start seeing the bot-check error again, re-export and update the variable.

**Security note**: a YouTube cookies file gives anyone with it full access to your YouTube account. Use a throwaway Google account for this if the deployment is shared, and never commit cookies to the repo.

If you don't want to deal with cookies, the paste-URL feature still works for **direct video URLs** (`.mp4`, `.webm`, `.mov`, …) and for many non-YouTube sites that don't enforce this check.

## Notes / limitations

- ffmpeg.wasm runs single-threaded by default in this setup; large videos can be slow. For long content, the unchecked "Re-encode" option uses stream copy and is much faster (cuts may snap to the nearest keyframe).
- Whisper has a 25 MB upload limit per request. The app extracts a mono 16 kHz MP3 first, which keeps most clips under that limit. Very long videos may need to be split.
- No content from your video is sent anywhere unless you run an AI action — and even then it goes directly to OpenAI from your browser.
- **Paste-URL responsibility**: `yt-dlp` can fetch from many sites, but downloading from YouTube and most platforms is against their Terms of Service. Use the feature only for videos you have the right to download (your own uploads, Creative Commons content, sites that explicitly allow it, etc.). The server enforces a max video size and rejects requests to private/internal hosts (basic SSRF guard), but does not police copyright — that is the operator's responsibility.
