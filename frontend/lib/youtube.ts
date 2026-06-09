function parseTimestampValue(value: string): number | null {
  const trimmed = decodeURIComponent(value.trim());
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  if (/^\d+s$/i.test(trimmed)) {
    return parseInt(trimmed.slice(0, -1), 10);
  }

  let seconds = 0;
  const hMatch = trimmed.match(/(\d+)h/i);
  const mMatch = trimmed.match(/(\d+)m/i);
  const sMatch = trimmed.match(/(\d+)s/i);

  if (hMatch) seconds += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) seconds += parseInt(mMatch[1], 10) * 60;
  if (sMatch) seconds += parseInt(sMatch[1], 10);

  return seconds > 0 ? seconds : null;
}

export function parseYouTubeTimestamp(rawUrl: string): number | null {
  try {
    const url = new URL(
      rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
    );

    const param =
      url.searchParams.get("t") ??
      url.searchParams.get("start") ??
      url.searchParams.get("time_continue");
    if (param) return parseTimestampValue(param);

    const hashMatch = url.hash.match(/[#&]t=([^&]+)/i);
    if (hashMatch) return parseTimestampValue(hashMatch[1]);

    return null;
  } catch {
    const match = rawUrl.match(/[?&#](?:t|start|time_continue)=([^&#]+)/i);
    return match ? parseTimestampValue(match[1]) : null;
  }
}

export function stripYouTubeTimestamp(rawUrl: string): string {
  try {
    const hasProtocol = /^https?:\/\//i.test(rawUrl);
    const url = new URL(hasProtocol ? rawUrl : `https://${rawUrl}`);

    url.searchParams.delete("t");
    url.searchParams.delete("start");
    url.searchParams.delete("time_continue");
    url.hash = url.hash.replace(/[#&]?t=[^&]*/i, "").replace(/^#$/, "");

    let result = url.toString();
    if (!hasProtocol) {
      result = result.replace(/^https?:\/\//i, "");
    }
    return result.replace(/\?$/, "");
  } catch {
    return rawUrl
      .replace(/([?&])(?:t|start|time_continue)=[^&#]*/gi, "$1")
      .replace(/[?&]$/, "");
  }
}

export function secondsToTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

export function timestampToSeconds(timestamp: string): number | null {
  const match = timestamp.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return (
    parseInt(match[1], 10) * 3600 +
    parseInt(match[2], 10) * 60 +
    parseInt(match[3], 10)
  );
}

export function addDurationToTimestamp(
  timestamp: string,
  durationSeconds: number
): string {
  const base = timestampToSeconds(timestamp) ?? 0;
  return secondsToTimestamp(base + durationSeconds);
}

export function clipDurationSeconds(start: string, end: string): number | null {
  const startSec = timestampToSeconds(start);
  const endSec = timestampToSeconds(end);
  if (startSec === null || endSec === null || endSec <= startSec) return null;
  return endSec - startSec;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    if (secs === 0 && minutes === 0) return `${hours}h`;
    if (secs === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (secs === 0) return `${minutes}m`;
  return `${minutes}m ${secs}s`;
}

export const DURATION_PRESETS = [
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
] as const;

export function applyYouTubeTimestampFromUrl(rawUrl: string): {
  url: string;
  startTime: string | null;
} {
  const timestamp = parseYouTubeTimestamp(rawUrl);
  if (timestamp === null) {
    return { url: rawUrl, startTime: null };
  }

  return {
    url: stripYouTubeTimestamp(rawUrl),
    startTime: secondsToTimestamp(timestamp),
  };
}
