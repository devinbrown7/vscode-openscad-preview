import test from "node:test";
import assert from "node:assert";
import { snapToStep } from "./snapToStep";

test("snapToStep - counts steps from min", () => {
  // OpenSCAD's [1:5:50] allows 1, 6, 11, ... 46.
  assert.strictEqual(snapToStep(7.4, 5, 1, 50), 6);
  assert.strictEqual(snapToStep(9, 5, 1, 50), 11);
  assert.strictEqual(snapToStep(1.2, 5, 1, 50), 1);
});

test("snapToStep - counts steps from 0 without a min", () => {
  assert.strictEqual(snapToStep(7.4, 5, undefined, undefined), 5);
  assert.strictEqual(snapToStep(-7.6, 5, undefined, undefined), -10);
});

test("snapToStep - stays within min and max", () => {
  assert.strictEqual(snapToStep(-20, 5, 1, 50), 1);
  assert.strictEqual(snapToStep(100, 5, 0, 50), 50);
  // A max that isn't on a step gives the last step below it.
  assert.strictEqual(snapToStep(100, 5, 1, 50), 46);
  assert.strictEqual(snapToStep(49, 5, 1, 50), 46);
});

test("snapToStep - drops float noise", () => {
  assert.strictEqual(snapToStep(0.31, 0.1, 0, 1), 0.3);
  assert.strictEqual(snapToStep(0.62, 0.3, 0, 1), 0.6);
  assert.strictEqual(snapToStep(0.75, 0.05, 0.1, 1), 0.75);
});

test("snapToStep - only clamps without a step", () => {
  assert.strictEqual(snapToStep(3.14159, undefined, 0, 10), 3.14159);
  assert.strictEqual(snapToStep(-1, undefined, 0, 10), 0);
  assert.strictEqual(snapToStep(11, undefined, 0, 10), 10);
  assert.strictEqual(snapToStep(3, 0, 0, 10), 3);
});
