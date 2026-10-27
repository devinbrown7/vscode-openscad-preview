/** The browser's frame callbacks, injectable so tests can drive frames by hand. */
export interface FrameClock {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

const browserClock: FrameClock = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/**
 * Draws a frame only when one is asked for, so an idle view costs nothing.
 * Requests made before the frame runs share it. `draw` returns whether
 * the picture is still changing on its own (a camera easing to a stop),
 * which asks for the next frame too.
 */
export class FrameScheduler {
  private handle: number | null = null;

  constructor(
    private draw: () => boolean,
    private clock: FrameClock = browserClock,
  ) {}

  /** Asks for a frame. Does nothing if one is already waiting. */
  public request(): void {
    if (this.handle !== null) return;
    this.handle = this.clock.request(this.run);
  }

  /** Draws now, instead of in the waiting frame, if any. */
  public drawNow(): void {
    this.cancel();
    this.run();
  }

  public cancel(): void {
    if (this.handle !== null) this.clock.cancel(this.handle);
    this.handle = null;
  }

  private run = () => {
    this.handle = null;
    if (this.draw()) this.request();
  };
}
