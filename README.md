# ClipperVideo

AI-assisted video clipper that runs entirely in your browser. Upload a video, set in/out points, and download a trimmed MP4 — all without uploading the video to a server. Optional OpenAI integration adds Whisper transcription and GPT-powered highlight suggestions.

## Features

- **In-browser trimming** with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — fast stream-copy or accurate re-encode
- **Drag-and-drop upload**, scrubbable timeline with draggable in/out handles, and "mark in / mark out" hotkeys
- **AI transcription** via OpenAI Whisper, with timestamped segments — click to jump
- **AI highlight suggestions** via GPT (default `gpt-4o-mini`) — pick the best ~30s moments and load them into the clipper with one click
- **Local-first**: video never leaves your device; OpenAI API key is stored only in `localStorage` and used to call `api.openai.com` directly
- **No backend required** — static site you can host anywhere

## Stack

- Vite + React + TypeScript
- `@ffmpeg/ffmpeg` 0.12 (WASM)
- OpenAI HTTP API (Whisper + Chat Completions)

## Getting started

```bash
npm install
npm run dev
```

The dev server sets the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers required by `SharedArrayBuffer` (which ffmpeg.wasm needs). If you deploy this app, your host must serve those headers too.

### Using the AI features

1. Click **Set API key** in the header
2. Paste an OpenAI API key (`sk-...`) and optionally pick a chat model
3. Load a video, click **Transcribe with Whisper**
4. Click **Suggest highlights** — AI picks engaging moments
5. Click **Use this clip** on a suggestion to load its in/out points, then **Clip & download**

## Build

```bash
npm run build
npm run preview
```

## Notes / limitations

- ffmpeg.wasm runs single-threaded by default in this setup; large videos can be slow. For long content, the unchecked "Re-encode" option uses stream copy and is much faster (cuts may snap to the nearest keyframe).
- Whisper has a 25 MB upload limit per request. The app extracts a mono 16 kHz MP3 first, which keeps most clips under that limit. Very long videos may need to be split.
- No content from your video is sent anywhere unless you run an AI action — and even then it goes directly to OpenAI from your browser.
