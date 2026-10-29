import test from "node:test";
import assert from "node:assert";
import { copyText, MAX_COPY_LENGTH } from "./copyText";

function fakeClipboard() {
  const written: string[] = [];
  return {
    written,
    writeText: async (text: string) => {
      written.push(text);
    },
  };
}

test("copyText - writes a material name to the clipboard", async () => {
  const clipboard = fakeClipboard();
  assert.strictEqual(await copyText(clipboard, "pla_white"), true);
  assert.deepStrictEqual(clipboard.written, ["pla_white"]);
});

test("copyText - ignores empty, oversized and non-string text", async () => {
  const clipboard = fakeClipboard();
  assert.strictEqual(await copyText(clipboard, ""), false);
  assert.strictEqual(
    await copyText(clipboard, "x".repeat(MAX_COPY_LENGTH + 1)),
    false,
  );
  assert.strictEqual(await copyText(clipboard, 42), false);
  assert.strictEqual(await copyText(clipboard, undefined), false);
  assert.deepStrictEqual(clipboard.written, []);
});

test("copyText - a failing clipboard does not throw", async () => {
  const clipboard = {
    writeText: async () => {
      throw new Error("no clipboard");
    },
  };
  assert.strictEqual(await copyText(clipboard, "a"), false);
});
