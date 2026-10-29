import test from "node:test";
import assert from "node:assert";
import { TintTracker } from "./TintTracker";

test("TintTracker - tints a hovered item once", () => {
  const t = new TintTracker<string>();
  assert.deepStrictEqual(t.update("a", null), { tint: ["a"], untint: [] });
  assert.deepStrictEqual(t.update("a", null), { tint: [], untint: [] });
});

test("TintTracker - hover leaving a pinned item keeps it tinted", () => {
  const t = new TintTracker<string>();
  t.update("a", null);
  assert.deepStrictEqual(t.update("a", "a"), { tint: [], untint: [] });
  assert.deepStrictEqual(t.update(null, "a"), { tint: [], untint: [] });
});

test("TintTracker - hovering another item leaves the pinned one", () => {
  const t = new TintTracker<string>();
  t.update("a", "a");
  assert.deepStrictEqual(t.update("b", "a"), { tint: ["b"], untint: [] });
  assert.deepStrictEqual(t.update(null, "a"), { tint: [], untint: ["b"] });
});

test("TintTracker - unpinning puts back an item nothing hovers", () => {
  const t = new TintTracker<string>();
  t.update(null, "a");
  assert.deepStrictEqual(t.update(null, null), { tint: [], untint: ["a"] });
});

test("TintTracker - pinning another item replaces the pin", () => {
  const t = new TintTracker<string>();
  t.update("b", "a");
  assert.deepStrictEqual(t.update("b", "b"), { tint: [], untint: ["a"] });
});

test("TintTracker - reset returns everything tinted", () => {
  const t = new TintTracker<string>();
  t.update("b", "a");
  assert.deepStrictEqual(t.reset().sort(), ["a", "b"]);
  assert.deepStrictEqual(t.update(null, null), { tint: [], untint: [] });
});
