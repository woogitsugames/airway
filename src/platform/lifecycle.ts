// One simulated day is 1,440 completed minute-ticks.
const TICKS_PER_DAY = 1440;

export interface AppListenerHandle { remove(): Promise<void>; }
export interface CapacitorAppPort {
  addListener(event: 'pause' | 'resume', listener: () => void): Promise<AppListenerHandle>;
}

export interface LifecycleHooks {
  /** Current authoritative simulation tick (one game minute per tick). */
  getTick(): number;
  /** Stop the scheduler immediately; do not insert a simulated SetSpeed command. */
  pause(): void;
  /** Persist the current snapshot and journal. Errors are surfaced via onError. */
  save(): Promise<void | { ok: boolean; issue?: string }>;
  /** Display the localized Resume screen; never restart simulation automatically. */
  requireResume(): void;
  onError?(error: unknown): void;
}

export interface VisibilityPort {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}
export interface PagePort {
  addEventListener(type: 'pagehide' | 'blur' | 'focus', listener: () => void): void;
  removeEventListener(type: 'pagehide' | 'blur' | 'focus', listener: () => void): void;
}

/**
 * Game owns the clock; this class only observes completed ticks. A pending save
 * is serialized so a pause save cannot be overwritten by an older daily save.
 */
export class GameLifecycle {
  private readonly hooks: LifecycleHooks;
  private lastDay: number;
  private background = false;
  private disposed = false;
  private pending: Promise<void> = Promise.resolve();
  private handles: AppListenerHandle[] = [];
  private visibility?: VisibilityPort;
  private page?: PagePort;

  constructor(hooks: LifecycleHooks) {
    this.hooks = hooks;
    this.lastDay = Math.floor(hooks.getTick() / TICKS_PER_DAY);
  }

  /** Call after a completed sim.tick(), never in the renderer's per-frame loop. */
  onTick(tick = this.hooks.getTick()): void {
    if (this.disposed || this.background || !Number.isSafeInteger(tick) || tick < 0) return;
    const day = Math.floor(tick / TICKS_PER_DAY);
    if (day < this.lastDay) { this.lastDay = day; return; } // Undo/new run.
    if (day > this.lastDay) {
      this.lastDay = day;
      void this.queueSave();
    }
  }

  private queueSave(): Promise<void> {
    // Always settle the chain, including rejected storage and user callbacks.
    this.pending = this.pending.then(async () => {
      if (this.disposed) return;
      try {
        const result = await this.hooks.save();
        if (result && !result.ok) throw new Error(result.issue ?? 'Save failed');
      }
      catch (error) { try { this.hooks.onError?.(error); } catch { /* diagnostics only */ } }
    });
    return this.pending;
  }

  /** Native App.pause, document.visibilitychange, pagehide, or [night-11i] window blur (D-99, D-119). */
  onBackground(): Promise<void> {
    if (this.disposed || this.background) return this.pending;
    this.background = true;
    try { this.hooks.pause(); }
    catch (error) { try { this.hooks.onError?.(error); } catch { /* diagnostics only */ } }
    return this.queueSave();
  }

  /** Native App.resume, visibility or [night-11i] window focus restored; player must explicitly resume. */
  onForeground(): void {
    if (this.disposed || !this.background) return;
    this.background = false;
    try { this.hooks.requireResume(); }
    catch (error) { try { this.hooks.onError?.(error); } catch { /* diagnostics only */ } }
  }

  private readonly visibilityListener = () => {
    if (this.visibility?.hidden) void this.onBackground();
    else this.onForeground();
  };
  private readonly pageHideListener = () => { void this.onBackground(); };
  // [night-11i] D-99 (Q-59 → B), D-119: split screen, a floating window or a desktop click elsewhere takes the focus
  // while the page stays visible (no visibilitychange). The run pauses and saves like a hidden tab; the picture
  // keeps drawing (multi-resume), and focus coming back only asks for the explicit Resume — never restarts the clock.
  private readonly blurListener = () => { void this.onBackground(); };
  private readonly focusListener = () => { if (!this.visibility?.hidden) this.onForeground(); };

  async attach(options: {
    app?: CapacitorAppPort;
    document?: VisibilityPort;
    window?: PagePort;
  } = {}): Promise<void> {
    if (this.disposed) throw new Error('Lifecycle already disposed');
    this.visibility = options.document ?? (typeof document === 'undefined' ? undefined : document);
    this.page = options.window ?? (typeof window === 'undefined' ? undefined : window);
    this.visibility?.addEventListener('visibilitychange', this.visibilityListener);
    this.page?.addEventListener('pagehide', this.pageHideListener);
    this.page?.addEventListener('blur', this.blurListener);
    this.page?.addEventListener('focus', this.focusListener);
    if (options.app) {
      this.handles.push(await options.app.addListener('pause', () => { void this.onBackground(); }));
      this.handles.push(await options.app.addListener('resume', () => { this.onForeground(); }));
    }
  }

  /** Tests and graceful shutdown can await pending durable writes. */
  async flush(): Promise<void> { await this.pending; }

  async dispose(): Promise<void> {
    this.visibility?.removeEventListener('visibilitychange', this.visibilityListener);
    this.page?.removeEventListener('pagehide', this.pageHideListener);
    this.page?.removeEventListener('blur', this.blurListener);
    this.page?.removeEventListener('focus', this.focusListener);
    await this.flush();
    this.disposed = true;
    for (const handle of this.handles) await handle.remove();
    this.handles.length = 0;
  }
}
