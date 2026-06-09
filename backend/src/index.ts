import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { logYtDlpConfig, runYtDlp, runYtDlpJson } from "./ytdlp";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const corsOptions: cors.CorsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

interface Job {
  id: string;
  status: "processing" | "ready" | "error";
  filePath?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

function createJobId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  return (
    parseInt(parts[0]) * 3600 +
    parseInt(parts[1]) * 60 +
    parseFloat(parts[2])
  );
}

function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

async function adjustSubtitleTimestamps(
  inputPath: string,
  outputPath: string,
  startTime: string
): Promise<void> {
  const startSeconds = timeToSeconds(startTime);
  const content = await fs.promises.readFile(inputPath, "utf-8");

  const timestampRegex =
    /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g;

  const adjustedContent = content.replace(
    timestampRegex,
    (match, start, end) => {
      const startSec = timeToSeconds(start) - startSeconds;
      const endSec = timeToSeconds(end) - startSeconds;

      if (startSec < 0) return match;

      return `${secondsToTime(startSec)} --> ${secondsToTime(endSec)}`;
    }
  );

  await fs.promises.writeFile(outputPath, adjustedContent, "utf-8");
}

function getCropFilter(cropRatio: string): string | null {
  switch (cropRatio) {
    case "vertical":
      return "crop=w='if(gt(a,9/16),ih*9/16,iw)':h='if(gt(a,9/16),ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'";
    case "square":
      return "crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(iw,ih))/2'";
    default:
      return null;
  }
}

app.post("/api/clip", async (req, res) => {
  const { url, startTime, endTime, subtitles, formatId, cropRatio = "original" } =
    req.body || {};
  if (!url || !startTime || !endTime) {
    return res
      .status(400)
      .json({ error: "url, startTime, and endTime are required" });
  }

  const id = createJobId();
  const outputPath = path.join(uploadsDir, `clip-${id}.mp4`);

  jobs.set(id, {
    id,
    status: "processing",
    filePath: outputPath,
    createdAt: Date.now(),
  });

  console.log(`[job ${id}] created`);

  (async () => {
    try {
      const section = `*${startTime}-${endTime}`;

      const ytArgs = [url];
      if (formatId) {
        ytArgs.push("-f", formatId);
      } else {
        ytArgs.push(
          "-f",
          "bv[ext=mp4][vcodec^=avc1][height<=?1080][fps<=?60]+ba[ext=m4a]/best[ext=mp4][vcodec^=avc1][height<=?1080]"
        );
      }
      ytArgs.push(
        "--download-sections",
        section,
        "-o",
        outputPath,
        "--merge-output-format",
        "mp4",
        "--no-warnings",
        "--add-header",
        "referer:youtube.com",
        "--add-header",
        "user-agent:Mozilla/5.0"
      );
      if (subtitles) {
        ytArgs.push(
          "--write-subs",
          "--write-auto-subs",
          "--sub-lang",
          "en",
          "--sub-format",
          "vtt"
        );
      }

      console.log(`[job ${id}] starting yt-dlp`);
      await runYtDlp(ytArgs, `job ${id}`);

      const fastPath = path.join(uploadsDir, `clip-${id}-fast.mp4`);
      const subPath = outputPath.replace(/\.mp4$/, ".en.vtt");
      const subtitlesExist = fs.existsSync(subPath);

      if (subtitles && subtitlesExist) {
        const adjustedSubPath = path.join(uploadsDir, `clip-${id}-adjusted.vtt`);
        await adjustSubtitleTimestamps(subPath, adjustedSubPath, startTime);
        await fs.promises.rename(adjustedSubPath, subPath);
      }

      await new Promise<void>((resolve, reject) => {
        const ffmpegArgs = ["-y", "-i", outputPath];

        const filterParts: string[] = [];
        const cropFilter = getCropFilter(cropRatio);
        if (cropFilter) filterParts.push(cropFilter);
        if (subtitles && subtitlesExist) {
          filterParts.push(`subtitles=${subPath}`);
        }

        if (filterParts.length > 0) {
          if (subtitles && subtitlesExist) {
            console.log(`[job ${id}] burning subtitles from ${subPath}`);
          }
          if (cropFilter) {
            console.log(`[job ${id}] cropping to ${cropRatio}`);
          }
          ffmpegArgs.push(
            "-vf",
            filterParts.join(","),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-preset",
            "ultrafast",
            "-crf",
            "28",
            "-maxrate",
            "2M",
            "-bufsize",
            "4M"
          );
        } else {
          ffmpegArgs.push("-c:v", "copy", "-c:a", "aac", "-b:a", "128k");
        }

        ffmpegArgs.push("-movflags", "+faststart", fastPath);

        console.log(`[job ${id}] running ffmpeg`, ffmpegArgs.join(" "));
        const ff = spawn("ffmpeg", ffmpegArgs);

        const ffmpegTimeout = setTimeout(() => {
          console.log(`[job ${id}] ffmpeg timeout reached, killing process`);
          ff.kill("SIGKILL");
        }, 300000);

        ff.stderr.on("data", (d) =>
          console.error(`[job ${id}] ffmpeg`, d.toString())
        );
        ff.on("close", (code, signal) => {
          clearTimeout(ffmpegTimeout);
          if (code === 0) {
            resolve();
          } else if (code === null) {
            reject(
              new Error(
                `ffmpeg process was killed by signal: ${signal || "unknown"}`
              )
            );
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
        ff.on("error", reject);
      });

      await fs.promises.unlink(outputPath).catch(() => {});
      await fs.promises.rename(fastPath, outputPath);

      if (subtitlesExist) {
        await fs.promises.unlink(subPath).catch(() => {});
      }

      jobs.set(id, {
        id,
        status: "ready",
        filePath: outputPath,
        createdAt: jobs.get(id)!.createdAt,
      });

      console.log(`[job ${id}] ready`);
    } catch (err: unknown) {
      console.error(`[job ${id}] failed`, err);
      const message = err instanceof Error ? err.message : String(err);
      jobs.set(id, {
        id,
        status: "error",
        error: message,
        createdAt: jobs.get(id)!.createdAt,
      });
    }
  })();

  return res.status(202).json({ id });
});

app.get("/api/clip/:id", (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);

  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }

  return res.json({
    status: job.status,
    error: job.error,
  });
});

app.delete("/api/clip/:id/cleanup", (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);

  if (job?.filePath && fs.existsSync(job.filePath)) {
    fs.unlinkSync(job.filePath);
  }

  jobs.delete(id);
  console.log(`[job ${id}] cleaned up`);
  return res.json({ success: true });
});

app.get("/api/clip/:id/file", (req, res) => {
  const { id } = req.params;
  const filePath = path.join(uploadsDir, `clip-${id}.mp4`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "file not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="clip.mp4"',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="clip.mp4"',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.get("/api/formats", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const jsonData = await runYtDlpJson(
      ["-j", "--no-warnings", url],
      "formats"
    );

    const info = JSON.parse(jsonData);

    const MAX_PIXELS = 1920 * 1080;

    const videoFormats = info.formats
      .filter(
        (f: {
          vcodec: string;
          height?: number;
          width?: number;
          ext: string;
          fps?: number;
          acodec: string;
          format_id: string;
        }) =>
          f.vcodec !== "none" &&
          f.height &&
          f.width &&
          f.width * f.height <= MAX_PIXELS &&
          (f.ext === "mp4" || f.ext === "webm")
      )
      .map(
        (f: {
          format_id: string;
          height: number;
          fps: number;
          acodec: string;
          ext: string;
        }) => ({
          format_id: f.format_id,
          label: `${f.height}p${f.fps > 30 ? f.fps : ""}`,
          height: f.height,
          hasAudio: f.acodec !== "none",
          ext: f.ext,
        })
      )
      .sort(
        (a: { height: number }, b: { height: number }) => b.height - a.height
      );

    const uniqueFormats = videoFormats.reduce(
      (
        acc: { format_id: string; label: string; hasAudio: boolean }[],
        current: { format_id: string; label: string; hasAudio: boolean }
      ) => {
        const existing = acc.find((item) => item.label === current.label);
        if (!existing) {
          acc.push(current);
        } else if (current.hasAudio && !existing.hasAudio) {
          const index = acc.findIndex((item) => item.label === current.label);
          acc[index] = current;
        }
        return acc;
      },
      []
    );

    const formatsForUser = uniqueFormats.map(
      (f: { hasAudio: boolean; format_id: string; label: string }) => ({
        format_id: f.hasAudio ? f.format_id : `${f.format_id}+bestaudio`,
        label: f.label,
      })
    );

    return res.json({ formats: formatsForUser });
  } catch (err: unknown) {
    console.error("[formats] failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

app.get("/api/ping", (_req, res) => {
  return res.json({ success: true });
});

app.get("/", (_req, res) => res.send("Server is alive!"));

function cleanupOldJobs() {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const [id, job] of jobs) {
    if (job.createdAt < twentyFourHoursAgo) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
      jobs.delete(id);
      console.log(`[job ${id}] cleaned up (expired)`);
    }
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  logYtDlpConfig();
  cleanupOldJobs();
});
