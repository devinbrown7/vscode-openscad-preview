/** The part of the clipboard that `copyText` needs. */
export interface TextClipboard {
  writeText(text: string): PromiseLike<void>;
}

/** The longest text a webview may put on the clipboard. */
export const MAX_COPY_LENGTH = 1000;

/**
 * Writes text a webview asked to copy. Anything that isn't a short,
 * non-empty string is ignored. Returns whether it was written.
 */
export async function copyText(
  clipboard: TextClipboard,
  text: unknown,
): Promise<boolean> {
  if (typeof text !== "string" || text === "" || text.length > MAX_COPY_LENGTH)
    return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
