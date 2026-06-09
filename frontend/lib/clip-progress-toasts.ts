import { toast } from "sonner";

const STEPS = [
  { id: "clip-step-start", loading: "Starting clip…", done: "Clip started" },
  {
    id: "clip-step-fetch",
    loading: "Fetching from YouTube…",
    done: "Video fetched",
  },
  {
    id: "clip-step-encode",
    loading: "Trimming & encoding…",
    done: "Clip encoded",
  },
  {
    id: "clip-step-save",
    loading: "Preparing download…",
    done: "Ready to save",
  },
] as const;

const FINAL_TOAST_ID = "clip-step-final";

function allToastIds() {
  return [...STEPS.map((s) => s.id), FINAL_TOAST_ID];
}

export class ClipProgressToasts {
  private stepIndex = -1;
  private encodingStarted = false;

  begin() {
    this.stepIndex = 0;
    this.encodingStarted = false;
    toast.loading(STEPS[0].loading, { id: STEPS[0].id, duration: Infinity });
  }

  onJobCreated() {
    toast.success(STEPS[0].done, { id: STEPS[0].id, duration: Infinity });
    this.stepIndex = 1;
    toast.loading(STEPS[1].loading, { id: STEPS[1].id, duration: Infinity });
  }

  onEncodingPhase() {
    if (this.encodingStarted || this.stepIndex !== 1) return;
    this.encodingStarted = true;
    toast.success(STEPS[1].done, { id: STEPS[1].id, duration: Infinity });
    this.stepIndex = 2;
    toast.loading(STEPS[2].loading, { id: STEPS[2].id, duration: Infinity });
  }

  onJobReady() {
    if (this.stepIndex === 1) {
      this.onEncodingPhase();
    }
    if (this.stepIndex !== 2) return;
    toast.success(STEPS[2].done, { id: STEPS[2].id, duration: Infinity });
    this.stepIndex = 3;
    toast.loading(STEPS[3].loading, { id: STEPS[3].id, duration: Infinity });
  }

  onComplete() {
    if (this.stepIndex === 3) {
      toast.success(STEPS[3].done, { id: STEPS[3].id, duration: Infinity });
    }
    toast.success("Clip downloaded!", {
      id: FINAL_TOAST_ID,
      duration: Infinity,
    });
    window.setTimeout(() => {
      allToastIds().forEach((id) => toast.dismiss(id));
    }, 4000);
  }

  onError(message: string) {
    allToastIds().forEach((id) => toast.dismiss(id));
    toast.error(message);
  }
}
