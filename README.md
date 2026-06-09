# YouTube Clipper

A local tool to extract clips from YouTube videos by URL and start/end timestamps. Clips are processed with yt-dlp and ffmpeg, then downloaded directly to your computer.

---

## Features

- **Frontend:** NextJS + TailwindCSS (with Shadcn/UI)
- **Backend:** Node.js (Express) with Bun runtime
- **Video Processing:** Uses `yt-dlp` and `ffmpeg` for efficient, compatible video clipping
- **No cloud storage required:** Clips are downloaded directly to your device

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
git clone https://github.com/retrogtx/youtube-clipper
cd youtube-clipper
```

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
2. Enter a YouTube URL and the desired start/end timestamps (format: `HH:MM:SS`).
3. Click "Clip Video".
4. The processed clip will be downloaded directly to your computer as `clip.mp4`.

---

## Required System Packages

- **yt-dlp**: Used for partial YouTube downloads.
- **ffmpeg**: Used for video/audio processing and re-encoding.
- **bun**: Used as the JavaScript/TypeScript runtime for both backend and frontend.
- **node** and **npm**: For compatibility and tooling.

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

**Enjoy clipping YouTube videos!**

If you have any issues, please open an issue or PR.
