// ============================================
// Request Queue — Concurrency-limited async queue with pacing
// Prevents N+1 request storms (e.g., file explorer grid thumbnails)
// ============================================

type QueuedTask<T> = {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

interface RequestQueueOptions {
  /** Max concurrent requests (default: 3) */
  concurrency?: number;
  /** Minimum ms between starting new tasks (default: 120) */
  minIntervalMs?: number;
  name?: string;
}

export class RequestQueue {
  private queue: QueuedTask<unknown>[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly minIntervalMs: number;
  private readonly name: string;
  private inFlight = new Map<string, Promise<unknown>>();
  private pausedUntil = 0;
  private lastStartAt = 0;

  constructor(options: RequestQueueOptions = {}) {
    this.concurrency = options.concurrency ?? 3;
    this.minIntervalMs = options.minIntervalMs ?? 120;
    this.name = options.name ?? 'RequestQueue';
  }

  /**
   * Pause starting new tasks (e.g. after HTTP 429).
   */
  pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms);
    console.warn(`[${this.name}] Paused for ${ms}ms (rate limit protection)`);
  }

  get isPaused(): boolean {
    return Date.now() < this.pausedUntil;
  }

  enqueue<T>(id: string, execute: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(id);
    if (existing) return existing as Promise<T>;

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processNext();
    });

    this.inFlight.set(id, promise);
    promise.finally(() => {
      if (this.inFlight.get(id) === promise) {
        this.inFlight.delete(id);
      }
    });

    return promise;
  }

  /** Drop queued (not yet running) tasks — e.g. user changed page quickly */
  cancelPending(): void {
    const pendingCount = this.queue.length;
    if (pendingCount === 0) return;

    const pending = this.queue.splice(0);
    pending.forEach((task) => task.resolve(null));
    console.debug(`[${this.name}] Cleared ${pendingCount} queued tasks`);
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get runningCount(): number {
    return this.running;
  }

  private async processNext(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    const now = Date.now();
    if (now < this.pausedUntil) {
      const wait = this.pausedUntil - now;
      setTimeout(() => this.processNext(), wait);
      return;
    }

    const sinceLast = now - this.lastStartAt;
    if (sinceLast < this.minIntervalMs) {
      setTimeout(() => this.processNext(), this.minIntervalMs - sinceLast);
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.running++;
    this.lastStartAt = Date.now();

    try {
      const result = await task.execute();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.running--;
      this.processNext();
    }
  }
}

/** Thumbnail/preview fetches — shared across file explorer */
export const thumbnailQueue = new RequestQueue({
  concurrency: 3,
  minIntervalMs: 150,
  name: 'ThumbnailQueue',
});

/** Share-token creation — lower concurrency to avoid rate limit */
/** Messenger list/detail/search — paced to avoid gateway 429 bursts. */
export const messengerQueue = new RequestQueue({
  concurrency: 2,
  minIntervalMs: 150,
  name: 'MessengerQueue',
});

export const shareTokenQueue = new RequestQueue({
  concurrency: 2,
  minIntervalMs: 200,
  name: 'ShareTokenQueue',
});
