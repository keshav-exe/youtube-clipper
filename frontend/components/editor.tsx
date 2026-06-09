"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Monitor,
  Smartphone,
  Square,
  ArrowDown,
  Clock,
  Scissors,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClipProgressToasts } from "@/lib/clip-progress-toasts";
import {
  applyYouTubeTimestampFromUrl,
  addDurationToTimestamp,
  clipDurationSeconds,
  formatDuration,
  DURATION_PRESETS,
  timestampToSeconds,
} from "@/lib/youtube";

export default function Editor() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [addSubs, setAddSubs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    thumbnail?: string;
    duration?: string;
  }>({});
  const [cropRatio, setCropRatio] = useState<
    "original" | "vertical" | "square"
  >("original");
  const [formats, setFormats] = useState<
    { format_id: string; label: string }[]
  >([]);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);

  const clipDuration = useMemo(
    () => clipDurationSeconds(startTime, endTime),
    [startTime, endTime]
  );

  const getVideoId = (url: string) => {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : null;
  };

  const applyTimestampFromUrl = (value: string) => {
    const videoId = getVideoId(value);
    if (!videoId) {
      setUrl(value);
      return;
    }

    const { url: cleanUrl, startTime: parsedStart } =
      applyYouTubeTimestampFromUrl(value);

    setUrl(cleanUrl);
    if (parsedStart) {
      setStartTime(parsedStart);
    }
  };

  const applyDuration = (seconds: number) => {
    setSelectedDuration(seconds);
    setEndTime(addDurationToTimestamp(startTime, seconds));
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (selectedDuration !== null) {
      setEndTime(addDurationToTimestamp(value, selectedDuration));
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    const startSec = timestampToSeconds(startTime);
    const endSec = timestampToSeconds(value);
    if (startSec !== null && endSec !== null && endSec > startSec) {
      const diff = endSec - startSec;
      const preset = DURATION_PRESETS.find((p) => p.seconds === diff);
      setSelectedDuration(preset?.seconds ?? null);
    } else {
      setSelectedDuration(null);
    }
  };

  const fetchVideoMetadata = async (videoId: string | null) => {
    if (!videoId) return;
    setIsMetadataLoading(true);

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const metadataResponse = await fetch(
        `/api/metadata?url=${encodeURIComponent(videoUrl)}`
      );
      if (!metadataResponse.ok)
        throw new Error("Failed to fetch video metadata");
      const metadata = await metadataResponse.json();

      setMetadata({
        title: metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail,
      });
      setThumbnailUrl(
        metadata.image
          ? metadata.image
          : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      );

      const formatsResponse = await fetch(
        `/api/formats?url=${encodeURIComponent(videoUrl)}`
      );
      if (formatsResponse.ok) {
        const formatsData = await formatsResponse.json();
        setFormats(formatsData.formats || []);
        if (formatsData.formats?.length > 0) {
          setSelectedFormat(formatsData.formats[0].format_id);
        }
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
      setThumbnailUrl(
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      );
    } finally {
      setIsMetadataLoading(false);
    }
  };

  useEffect(() => {
    const videoId = getVideoId(url);
    if (videoId) {
      setThumbnailUrl("loading");
      setIsMetadataLoading(true);
      fetchVideoMetadata(videoId);
    } else {
      setThumbnailUrl(null);
      setMetadata({});
      setFormats([]);
      setSelectedFormat("");
      setIsMetadataLoading(false);
    }
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (clipDuration === null) {
      toast.error("End time must be after start time");
      return;
    }

    setLoading(true);
    const progress = new ClipProgressToasts();
    progress.begin();

    try {
      const clipKickoff = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          startTime,
          endTime,
          cropRatio,
          subtitles: addSubs,
          formatId: selectedFormat,
        }),
      });

      if (!clipKickoff.ok) {
        const errJson = await clipKickoff.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to start processing");
      }

      const { id } = (await clipKickoff.json()) as { id: string };
      progress.onJobCreated();

      type JobStatus = "processing" | "ready" | "error";
      interface JobStatusResponse {
        status: JobStatus;
        error?: string;
      }

      let status: JobStatus = "processing";
      let pollCount = 0;
      while (status === "processing") {
        await new Promise((r) => setTimeout(r, 3000));
        pollCount += 1;
        if (pollCount >= 2) progress.onEncodingPhase();

        const pollRes = await fetch(`/api/clip/${id}`);
        if (!pollRes.ok) throw new Error("Failed to poll job status");
        const pollJson = (await pollRes.json()) as JobStatusResponse;
        status = pollJson.status;
        if (status === "error")
          throw new Error(pollJson.error || "Processing failed");
      }

      progress.onJobReady();
      const downloadRes = await fetch(`/api/clip/${id}/download`);
      if (!downloadRes.ok) throw new Error("Failed to download clip");

      const blob = await downloadRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "clip.mp4";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      progress.onComplete();
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      progress.onError(
        err instanceof Error ? err.message : "Failed to clip video"
      );
    } finally {
      setLoading(false);
    }
  };

  const resolutionOptions = {
    original: { icon: Monitor, label: "Original" },
    vertical: { icon: Smartphone, label: "Vertical" },
    square: { icon: Square, label: "Square" },
  } as const;

  return (
    <main className="flex flex-col w-full min-h-dvh p-4 sm:p-6 max-w-2xl mx-auto items-center justify-center">
      <section className="flex flex-col w-full gap-5">
        <AnimatePresence mode="wait">
          {!isMetadataLoading && thumbnailUrl === null ? (
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="text-2xl sm:text-3xl font-medium text-balance text-center"
            >
              What do you wanna clip?
            </motion.h1>
          ) : isMetadataLoading ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full"
            >
              <div className="flex gap-3 bg-muted/40 border border-border/50 p-3 rounded-2xl items-center">
                <div className="size-[52px] shrink-0 bg-muted animate-pulse rounded-lg" />
                <div className="h-5 flex-1 max-w-xs bg-muted animate-pulse rounded-md" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full"
            >
              <div className="flex gap-3 bg-muted/40 border border-border/50 p-3 rounded-2xl items-center">
                {thumbnailUrl && (
                  <Image
                    unoptimized
                    width={1280}
                    height={720}
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    className="size-[52px] shrink-0 object-cover aspect-video rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src.includes("maxresdefault")) {
                        target.src = target.src.replace(
                          "maxresdefault",
                          "hqdefault"
                        );
                      }
                    }}
                  />
                )}
                <h3 className="font-medium text-sm sm:text-base line-clamp-2 text-pretty min-w-0">
                  {metadata.title}
                </h3>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 border border-border/60 bg-card/80 backdrop-blur-sm p-4 sm:p-5 rounded-3xl shadow-sm"
        >
          {/* URL */}
          <div className="flex items-center gap-2 rounded-2xl bg-muted/30 border border-border/40 px-3 py-2">
            <input
              type="text"
              id="url"
              placeholder="Paste YouTube URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!getVideoId(pasted)) return;
                const { startTime: parsedStart } =
                  applyYouTubeTimestampFromUrl(pasted);
                if (!parsedStart) return;
                e.preventDefault();
                applyTimestampFromUrl(pasted);
              }}
              onBlur={() => applyTimestampFromUrl(url)}
              required
              className="bg-transparent border-none outline-none w-full text-sm placeholder:text-muted-foreground/70"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading}
              aria-label="Download clip"
              className="shrink-0 rounded-xl"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowDown className="size-5" />
              )}
            </Button>
          </div>

          {/* Time range */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Scissors className="size-3.5" />
                <span>Clip range</span>
              </div>
              {clipDuration !== null && (
                <span className="text-xs tabular-nums text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {formatDuration(clipDuration)} clip
                </span>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startTime" className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  type="text"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                  placeholder="00:00:00"
                  required
                  className="font-mono text-sm tabular-nums h-10 rounded-xl bg-muted/20"
                />
              </div>
              <span className="text-xs text-muted-foreground pb-2.5">→</span>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endTime" className="text-xs text-muted-foreground">
                  End
                </Label>
                <Input
                  type="text"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                  placeholder="00:00:00"
                  required
                  className="font-mono text-sm tabular-nums h-10 rounded-xl bg-muted/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                <span>Duration from start</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map(({ label, seconds }) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => applyDuration(seconds)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors duration-200",
                      selectedDuration === seconds
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-foreground border-border/50 hover:bg-muted/60"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Aspect ratio */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Aspect ratio</Label>
            <div className="flex items-center p-1 rounded-xl border border-border/50 bg-muted/20 relative">
              {Object.entries(resolutionOptions).map(
                ([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCropRatio(key as typeof cropRatio)}
                    className="relative flex-1 py-2 px-2 rounded-lg text-center"
                  >
                    {cropRatio === key && (
                      <motion.div
                        layoutId="aspect-ratio"
                        className="absolute inset-0 bg-primary rounded-lg"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex text-xs sm:text-sm items-center gap-1.5 justify-center",
                        cropRatio === key
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4" />
                      <span>{label}</span>
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Quality & subtitles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quality" className="text-xs text-muted-foreground">
                Quality
              </Label>
              <select
                id="quality"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="h-10 rounded-xl border border-border/50 bg-muted/20 px-3 text-sm appearance-none bg-no-repeat bg-right bg-[length:16px] pr-8"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 10px center",
                }}
                disabled={formats.length === 0}
              >
                {formats.length === 0 ? (
                  <option value="">Loading formats...</option>
                ) : (
                  formats.map((format) => (
                    <option key={format.format_id} value={format.format_id}>
                      {format.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subtitles-switch" className="text-xs text-muted-foreground">
                Subtitles
              </Label>
              <div className="flex items-center gap-2.5 h-10 px-3 rounded-xl border border-border/50 bg-muted/20">
                <Switch
                  id="subtitles-switch"
                  checked={addSubs}
                  onCheckedChange={setAddSubs}
                />
                <Label
                  htmlFor="subtitles-switch"
                  className="text-sm text-muted-foreground font-normal cursor-pointer"
                >
                  Burn in English
                </Label>
              </div>
            </div>
          </div>
        </motion.form>
      </section>
    </main>
  );
}
