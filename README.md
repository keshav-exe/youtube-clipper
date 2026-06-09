# YouTube Clipper

A fully local tool to extract clips from YouTube videos by URL and start/end timestamps. Clips are processed with yt-dlp and ffmpeg, then downloaded directly to your computer — no accounts, payments, or cloud storage.

> **Credits:** This project is a local-only fork of [retrogtx/youtube-clipper](https://github.com/retrogtx/youtube-clipper). The original is a hosted SaaS with auth and subscriptions; this version strips all of that and runs entirely on your machine.

### What's different from the original

- No login, payments, or subscriptions
- No database or cloud storage — everything runs and stays on your machine
- Browser cookies (Chrome by default) for YouTube access — no manual cookie export
- Some additional features on top of the original (see [Features](#features))

---

## Features

- **Clip by URL and time range** — paste a YouTube link, set start/end timestamps (`HH:MM:SS`), download the clip
- **Timestamp autofill** — links with `?t=966` (or `#t=1m30s`) auto-fill the start time
- **Duration presets** — tap 15s, 30s, 1m, etc. to set the end time from your start point
- **Quality picker** — choose resolution up to 1080p before clipping
- **Aspect ratio** — original, vertical (9:16), or square (1:1) crop
- **Subtitles** — optionally burn in English captions
- **Progress feedback** — stacked toasts walk you through each step while processing
- **Local-only** — no account, no upload to the cloud; the file saves straight to your computer

---

## Tech stack

- **Frontend:** Next.js, Tailwind CSS, shadcn/ui
- **Backend:** Express on Bun
- **Processing:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [ffmpeg](https://ffmpeg.org/)

---

## Prerequisites

You must have the following installed on your system:

- **[Bun](https://bun.sh/):** `bun` (v1.2.7 or later)
- **[Node.js](https://nodejs.org/):** `node` (v18+ recommended)
- **[npm](https://www.npmjs.com/):** (for some tooling, v10+)
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp):** Command-line tool for downloading YouTube videos
- **[ffmpeg](https://ffmpeg.org/):** Command-line tool for video processing

### To check if you have these installed, run:

```sh
bun --version
node --version
npm --version
yt-dlp --version
ffmpeg -version
```

If any are missing, install them via your package manager (e.g., `brew install bun yt-dlp ffmpeg` on macOS).

**YouTube access:** The backend automatically uses cookies from **Chrome** (you must be logged into YouTube there). Using Safari or Firefox instead? Set `YT_DLP_COOKIES_BROWSER=safari` in `backend/.env`.

---

## Getting Started

### 1. Clone the repository

```sh
git clone <this-repo-url>
cd youtube-clipper
```

Forked from [retrogtx/youtube-clipper](https://github.com/retrogtx/youtube-clipper)? Clone your fork instead.

---

### 2. Install dependencies

#### Backend

```sh
cd backend
bun install
bun run setup   # optional fallback yt-dlp binary
```

#### Frontend

```sh
cd ../frontend
bun install
```

---

### 3. Configure environment

```sh
cd frontend
cp .env.example .env.local
```

The only required variable is `BACKEND_API_URL=http://localhost:3001`.

---

### 4. Run the app

#### Start the backend

```sh
cd backend
bun run src/index.ts
```

- The backend will start on `http://localhost:3001` by default.

#### Start the frontend

```sh
cd ../frontend
bun run dev
```

- The frontend will start on `http://localhost:3000` by default.

---

## Usage

1. Open the frontend in your browser (`http://localhost:3000`).
2. Paste a YouTube URL (with an optional timestamp) and set your clip range.
3. Pick quality, aspect ratio, and subtitles if you want them.
4. Hit the download button — the clip saves as `clip.mp4`.

---

## Project Structure

```
youtube-clipper/
  backend/
    src/
    uploads/
    package.json
    tsconfig.json
  frontend/
    app/
    public/
    components/
    package.json
    tsconfig.json
    next.config.ts
```

---

## Troubleshooting

- **"Sign in to confirm you're not a bot":** Log into [youtube.com](https://youtube.com) in Chrome. If you use another browser, set `YT_DLP_COOKIES_BROWSER=safari` (or `firefox`) in `backend/.env` and restart the backend.
- **yt-dlp or ffmpeg not found:** Run `brew install yt-dlp ffmpeg` and restart the backend.
- **Stale yt-dlp:** Run `brew upgrade yt-dlp` or `cd backend && bun run setup`.
- **Port conflicts:** Change the port in the backend or frontend config if needed.

---

## Development

- TypeScript is used throughout.
- Hot reload is NOT enabled.
- Linting is available via `bun run lint` in the frontend.

---

## Disclaimer

**This software is provided for personal, local use only.**

YouTube Clipper is an independent, open-source tool. It is **not affiliated with, endorsed by, or sponsored by Google or YouTube**. YouTube is a trademark of Google LLC.

By using this tool, you agree that:

- You will use it **only for your own personal, non-commercial purposes** on content you have the right to access (e.g. videos you own, have permission to use, or are permitted to download under applicable law).
- You are **solely responsible** for complying with [YouTube's Terms of Service](https://www.youtube.com/t/terms), applicable copyright laws, and any other laws in your jurisdiction. Downloading or clipping content you do not have rights to may violate those terms or laws.
- The authors and contributors **do not encourage or condone** copyright infringement, circumvention of DRM, or any unlawful use of third-party content.
- This software is provided **"as is"**, without warranty of any kind. The authors are **not liable** for any damages, claims, or legal consequences arising from your use of this tool.

If you are a rights holder and believe this project facilitates infringement, please open an issue — this tool is intended strictly as a personal utility for local video processing, not as a service for distributing copyrighted material.

---

Built on top of **[retrogtx/youtube-clipper](https://github.com/retrogtx/youtube-clipper)** — thanks to the original authors for the yt-dlp/ffmpeg clipping pipeline and UI foundation.

---

**Enjoy clipping YouTube videos!**
