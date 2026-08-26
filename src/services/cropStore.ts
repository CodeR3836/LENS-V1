/**
 * cropStore.ts
 *
 * Global, reactive single source of truth for the LENS recent-crop state.
 *
 * Session model:
 *   activeSessionId  — set when a new crop starts (via startSession)
 *   latestCompletedSessionId — set ONLY when OCR commits a successful result
 *
 * Crop-Paste is only valid when currentCrop.sessionId === latestCompletedSessionId.
 */

const RECENT_CROP_STORAGE_KEY = "lens_recent_crop";

export interface RecentCrop {
  id: string;
  sessionId: number;
  text: string;
  createdAt: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

type CropListener = (crop: RecentCrop | null) => void;

class CropStore {
  private currentCrop: RecentCrop | null = null;
  /** Bumped on every new crop window open */
  private activeSessionId: number = 0;
  /** Only set when a successful OCR result is committed */
  private latestCompletedSessionId: number = 0;
  private listeners: Set<CropListener> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(RECENT_CROP_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentCrop;
        if (parsed && typeof parsed.text === "string" && parsed.id) {
          this.currentCrop = parsed;
          this.activeSessionId = parsed.sessionId || 0;
          this.latestCompletedSessionId = parsed.sessionId || 0;
        }
      }
    } catch {
      // Storage unavailable fallback
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentCrop);
      } catch (err) {
        console.error("[CropStore] listener error:", err);
      }
    }
  }

  /**
   * Called when a new crop window opens.
   * Advances the active session ID so any in-flight OCR for the previous
   * session can detect it is stale.
   */
  public startSession(sessionId: number): void {
    this.activeSessionId = sessionId;
    console.log(`[CROP FLOW] START session=${sessionId}`);
  }

  public getActiveSessionId(): number {
    return this.activeSessionId;
  }

  public getLatestCompletedSessionId(): number {
    return this.latestCompletedSessionId;
  }

  /**
   * Subscribe to crop store updates.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: CropListener): () => void {
    this.listeners.add(listener);
    listener(this.currentCrop);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns the latest crop text ONLY if the stored crop belongs to
   * latestCompletedSessionId, preventing stale results from surfacing.
   *
   * Use this for Crop-Paste.
   */
  public getValidatedCrop(): { text: string; sessionId: number } | null {
    if (
      this.currentCrop &&
      this.currentCrop.text.trim().length > 0 &&
      this.currentCrop.sessionId === this.latestCompletedSessionId &&
      this.latestCompletedSessionId > 0
    ) {
      return {
        text: this.currentCrop.text,
        sessionId: this.currentCrop.sessionId,
      };
    }
    return null;
  }

  /**
   * Returns the current crop text (legacy accessor, no session validation).
   */
  public getRecentCrop(): string | null {
    if (this.currentCrop && this.currentCrop.text.trim().length > 0) {
      return this.currentCrop.text;
    }
    return null;
  }

  /**
   * Returns the full RecentCrop object with metadata.
   */
  public getRecentCropData(): RecentCrop | null {
    return this.currentCrop;
  }

  /**
   * Commits a successful OCR result.
   *
   * Only commits if sessionId === activeSessionId (not superseded).
   * Updates latestCompletedSessionId so Crop-Paste can validate the result.
   */
  public setRecentCrop(
    text: string,
    bounds?: { x: number; y: number; width: number; height: number },
    sessionId?: number
  ): RecentCrop | null {
    const tStoreStart = performance.now();
    const trimmed = text.trim();
    const effectiveSessionId = sessionId ?? this.activeSessionId;

    console.log(`[CROP PERF] STORE_COMMIT_START session=${effectiveSessionId} t=${tStoreStart.toFixed(2)}ms`);

    if (trimmed.length === 0) {
      this.clearRecentCrop();
      return null;
    }

    // Reject if a newer session has started since this OCR was submitted
    if (effectiveSessionId < this.activeSessionId) {
      console.log(
        `[CROP FLOW] STORE_REJECT stale session=${effectiveSessionId} active=${this.activeSessionId}`
      );
      return null;
    }

    const newCrop: RecentCrop = {
      id: `crop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId: effectiveSessionId,
      text: trimmed,
      createdAt: Date.now(),
      bounds,
    };

    this.currentCrop = newCrop;
    this.activeSessionId = effectiveSessionId;
    this.latestCompletedSessionId = effectiveSessionId;

    console.log(
      `[CROP FLOW] STORE_COMMIT session=${effectiveSessionId} text="${trimmed.slice(0, 60)}"`
    );

    try {
      localStorage.setItem(RECENT_CROP_STORAGE_KEY, JSON.stringify(newCrop));
    } catch {
      // Storage unavailable fallback
    }

    const tStoreDone = performance.now();
    console.log(`[CROP PERF] STORE_COMMIT_DONE session=${effectiveSessionId} t=${tStoreDone.toFixed(2)}ms (took ${(tStoreDone - tStoreStart).toFixed(2)}ms)`);

    this.notify();

    // Verify commit immediately
    const verified = this.currentCrop?.text ?? "(null)";
    console.log(
      `[CROP FLOW] STORE_VERIFY session=${effectiveSessionId} text="${verified.slice(0, 60)}"`
    );

    return newCrop;
  }

  public hasRecentCrop(): boolean {
    return this.getValidatedCrop() !== null;
  }

  public clearRecentCrop(): void {
    this.currentCrop = null;
    try {
      localStorage.removeItem(RECENT_CROP_STORAGE_KEY);
    } catch {}
    this.notify();
  }
}

export const cropStore = new CropStore();
