import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const bundledPath = path.resolve(__dirname, "../bin/yt-dlp");

let cachedYtDlpPath: string | null = null;

export function getYtDlpPath(): string {
  if (cachedYtDlpPath) return cachedYtDlpPath;

  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    cachedYtDlpPath = process.env.YT_DLP_PATH;
    return cachedYtDlpPath;
  }

  try {
    const systemPath = execSync("which yt-dlp", { encoding: "utf-8" }).trim();
    if (systemPath && fs.existsSync(systemPath)) {
      cachedYtDlpPath = systemPath;
      return cachedYtDlpPath;
    }
  } catch {
    // fall through
  }

  if (fs.existsSync(bundledPath)) {
    cachedYtDlpPath = bundledPath;
    return cachedYtDlpPath;
  }

  cachedYtDlpPath = "yt-dlp";
  return cachedYtDlpPath;
}

export function getYtDlpVersion(): string {
  try {
    return execSync(`"${getYtDlpPath()}" --version`, { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getCookiesBrowser(): string | null {
  const setting = process.env.YT_DLP_COOKIES_BROWSER?.trim().toLowerCase();
  if (setting === "none" || setting === "off" || setting === "false") {
    return null;
  }
  if (setting) return setting;
  return "chrome";
}

export function appendYtDlpAuthArgs(args: string[]): string {
  const prodCookies = "/etc/secrets/cookies.txt";
  if (fs.existsSync(prodCookies)) {
    args.push("--cookies", prodCookies);
    return "cookies file (prod)";
  }

  const localCookies = path.join(__dirname, "cookies.txt");
  if (fs.existsSync(localCookies)) {
    args.push("--cookies", localCookies);
    return "cookies file (local)";
  }

  if (process.env.YT_DLP_COOKIES_FILE && fs.existsSync(process.env.YT_DLP_COOKIES_FILE)) {
    args.push("--cookies", process.env.YT_DLP_COOKIES_FILE);
    return "cookies file (env)";
  }

  const browser = getCookiesBrowser();
  if (browser) {
    args.push("--cookies-from-browser", browser);
    return `browser cookies (${browser})`;
  }

  return "none (no auth — may fail on some videos)";
}

export function appendYtDlpCommonArgs(args: string[]): void {
  args.push(
    "--no-check-certificates",
    "--extractor-args",
    "youtube:player_client=web,default"
  );
}

function formatYtDlpError(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string
): string {
  const errorLine = stderr.match(/ERROR:\s*\[youtube\][^\n]*|ERROR:\s*[^\n]+/)?.[0];
  const message = errorLine?.replace(/^ERROR:\s*/, "") ?? "";

  if (message.includes("not a bot") || message.includes("Sign in to confirm")) {
    return "YouTube blocked the request. Log into YouTube in Chrome (or set YT_DLP_COOKIES_BROWSER=safari|firefox in backend/.env).";
  }

  if (message) return message;

  if (signal) return `yt-dlp was killed (${signal})`;
  return `yt-dlp exited with code ${code}`;
}

export function runYtDlp(
  args: string[],
  logPrefix: string
): Promise<void> {
  const ytDlpPath = getYtDlpPath();
  const fullArgs = [...args];
  appendYtDlpCommonArgs(fullArgs);
  appendYtDlpAuthArgs(fullArgs);

  return new Promise((resolve, reject) => {
    console.log(`[${logPrefix}] yt-dlp ${fullArgs.join(" ")}`);
    const proc = spawn(ytDlpPath, fullArgs);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(`[${logPrefix}] ${text}`);
    });

    proc.on("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(formatYtDlpError(code, signal, stderr)));
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to run yt-dlp at "${ytDlpPath}". Install with: brew install yt-dlp (${err.message})`
        )
      );
    });
  });
}

export function runYtDlpJson(
  args: string[],
  logPrefix: string,
  timeoutMs = 30000
): Promise<string> {
  const ytDlpPath = getYtDlpPath();
  const fullArgs = [...args];
  appendYtDlpCommonArgs(fullArgs);
  appendYtDlpAuthArgs(fullArgs);

  return new Promise((resolve, reject) => {
    console.log(`[${logPrefix}] yt-dlp ${fullArgs.join(" ")}`);
    const proc = spawn(ytDlpPath, fullArgs);

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(`[${logPrefix}] ${text}`);
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal === "SIGKILL") {
        reject(new Error("Request timed out — video may be unavailable"));
        return;
      }
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(formatYtDlpError(code, signal, stderr)));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to run yt-dlp at "${ytDlpPath}". Install with: brew install yt-dlp (${err.message})`
        )
      );
    });
  });
}

export function logYtDlpConfig(): void {
  const authArgs: string[] = [];
  const authMode = appendYtDlpAuthArgs(authArgs);
  console.log(`yt-dlp: ${getYtDlpPath()} (${getYtDlpVersion()})`);
  console.log(`yt-dlp auth: ${authMode}`);
}
