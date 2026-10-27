import test from "node:test";
import assert from "node:assert";
import { FrameClock, FrameScheduler } from "./FrameScheduler";

/** A frame clock that runs frames only when the test says so. */
function manualClock() {
  const waiting = new Map<number, () => void>();
  let next = 1;
  const clock: FrameClock = {
    request: (callback) => {
      waiting.set(next, callback);
      return next++;
    },
    cancel: (handle) => {
      waiting.delete(handle);
    },
  };
  return {
    clock,
    get waiting() {
      return waiting.size;
    },
    /** Runs the frames waiting now, as one browser frame does. */
    tick() {
      const due = [...waiting.values()];
      waiting.clear();
      due.forEach((callback) => callback());
    },
  };
}

test("FrameScheduler - draws nothing until asked", () => {
  const frames = manualClock();
  let draws = 0;
  new FrameScheduler(() => {
    draws++;
    return false;
  }, frames.clock);
  for (let i = 0; i < 10; i++) frames.tick();
  assert.strictEqual(frames.waiting, 0);
  assert.strictEqual(draws, 0);
});

test("FrameScheduler - requests before a frame share it", () => {
  const frames = manualClock();
  let draws = 0;
  const scheduler = new FrameScheduler(() => {
    draws++;
    return false;
  }, frames.clock);
  scheduler.request();
  scheduler.request();
  scheduler.request();
  assert.strictEqual(frames.waiting, 1);
  frames.tick();
  assert.strictEqual(draws, 1);
  // Idle again: no frame waits, and later ticks draw nothing.
  assert.strictEqual(frames.waiting, 0);
  frames.tick();
  assert.strictEqual(draws, 1);
});

test("FrameScheduler - keeps drawing while the picture changes on its own", () => {
  const frames = manualClock();
  let moving = 3;
  let draws = 0;
  const scheduler = new FrameScheduler(() => {
    draws++;
    return moving-- > 0;
  }, frames.clock);
  scheduler.request();
  for (let i = 0; i < 10; i++) frames.tick();
  // Three frames still moving, then the one that sees it has stopped.
  assert.strictEqual(draws, 4);
  assert.strictEqual(frames.waiting, 0);
});

test("FrameScheduler - a request during a draw asks for the next frame", () => {
  const frames = manualClock();
  let draws = 0;
  const scheduler: FrameScheduler = new FrameScheduler(() => {
    if (draws++ === 0) scheduler.request();
    return false;
  }, frames.clock);
  scheduler.request();
  frames.tick();
  assert.strictEqual(frames.waiting, 1);
  frames.tick();
  assert.strictEqual(draws, 2);
  assert.strictEqual(frames.waiting, 0);
});

test("FrameScheduler - drawNow draws at once and takes the waiting frame's place", () => {
  const frames = manualClock();
  let draws = 0;
  const scheduler = new FrameScheduler(() => {
    draws++;
    return false;
  }, frames.clock);
  scheduler.request();
  scheduler.drawNow();
  assert.strictEqual(draws, 1);
  assert.strictEqual(frames.waiting, 0);
});

test("FrameScheduler - cancel drops the waiting frame", () => {
  const frames = manualClock();
  let draws = 0;
  const scheduler = new FrameScheduler(() => {
    draws++;
    return true;
  }, frames.clock);
  scheduler.request();
  scheduler.cancel();
  frames.tick();
  assert.strictEqual(draws, 0);
  assert.strictEqual(frames.waiting, 0);
});
