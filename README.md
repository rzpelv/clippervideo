# ClipperVideo

AI-assisted video clipper that runs entirely in your browser. Upload a video, let AI auto-clip the best moments with hook titles, then download a trimmed MP4 — all without uploading the video anywhere.

## Features

- **In-browser trimming** with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — fast stream-copy or accurate re-encode
- **Drag-and-drop upload** with a scrubbable timeline, draggable in/out handles, and "mark in / mark out" buttons
- **One-click AI Auto-Clip**: transcribes the video, picks the best 5 moments, writes hook-style titles in the source language, and shows the per-clip transcript — all in one button
- **Bring-your-own-AI**: works with any OpenAI-compatible provider (OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Together AI, local Ollama, …) — separate transcription and chat providers if you want
- **Local-first**: video, transcript, and API keys never leave your browser

## Stack

- Vite + React + TypeScript
- `@ffmpeg/ffmpeg` 0.12 (WASM, served same-origin from `public/ffmpeg/`)
- Any OpenAI-compatible HTTP API for Whisper-style transcription + Chat Completions
- Tiny zero-dep Node static server that ships `dist/` with COOP/COEP headers

## Getting started

```bash
npm install
npm run dev
```

That's it — the dev server (Vite) sets the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers required by `SharedArrayBuffer` (which ffmpeg.wasm needs). The `predev` hook downloads ffmpeg-core into `public/ffmpeg/` automatically on first run.

### Using the AI features

1. Click **Set up AI** (or **AI Providers**) in the header
2. Pick a provider preset (Groq is a great starting point — fast and cheap), paste an API key, and (optionally) tweak the model name
3. Load a video, click **✨ Auto-clip with AI**
4. Each suggested clip card shows: hook title, time range, the transcript of those words, and one-sentence reason. Click **Use this clip ↑** to load it into the timeline, then **Clip & download**.

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

A common combo: pick **Groq** in the Quick-setup row, leave the "Use the same provider & API key for both" box checked, paste your Groq key. That's it — both transcription and hook generation are wired up to Groq with sensible model defaults.

If you need a different provider for chat (say Claude via OpenRouter): uncheck the linked-key box, change the **Chat / Hook generation** section's provider to OpenRouter, and paste your OpenRouter key there.

## Build

```bash
npm run build
npm start   # serves dist/ on $PORT (default 4173) with COOP/COEP headers
```

## Deploy to Railway

The repo's `railway.json` selects the **Dockerfile** builder. The image is just Node 20 + tini — no Python, no ffmpeg binary, no yt-dlp, just a static site.

1. Railway → New Project → Deploy from GitHub repo → pick this repo
2. Railway reads `railway.json` and builds with the included `Dockerfile`
3. Settings → Networking → **Generate Domain** (Railway gives HTTPS, required by `SharedArrayBuffer`)
4. Done

No environment variables are required (AI keys are entered per-user in the browser). Optional ones:

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Listen port (Railway sets this automatically) |
| `HOST` | `0.0.0.0` | Bind address |

The healthcheck path is `/healthz`.

## Notes / limitations

- ffmpeg.wasm runs single-threaded by default in this setup; large videos can be slow. For long content, the unchecked "Re-encode" option uses stream copy and is much faster (cuts may snap to the nearest keyframe).
- Whisper has a 25 MB upload limit per request. The app extracts a mono 16 kHz MP3 first, which keeps most clips under that limit. Very long videos may need to be split.
- Video and transcript stay in your browser. AI calls go directly from the browser to the configured provider; nothing routes through this server.
