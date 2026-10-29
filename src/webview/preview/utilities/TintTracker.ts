/**
 * Tracks which items are tinted when two things can ask for a tint: the
 * item under the pointer and the pinned one. An item stays tinted while
 * either wants it, and is tinted only once.
 */
export class TintTracker<T> {
  private tinted = new Set<T>();

  /** Sets what's wanted; returns what to tint and what to put back. */
  update(hovered: T | null, pinned: T | null): { tint: T[]; untint: T[] } {
    const wanted = new Set<T>();
    if (hovered) wanted.add(hovered);
    if (pinned) wanted.add(pinned);
    const tint = [...wanted].filter((item) => !this.tinted.has(item));
    const untint = [...this.tinted].filter((item) => !wanted.has(item));
    this.tinted = wanted;
    return { tint, untint };
  }

  /** Forgets every item; returns them so they can be put back. */
  reset(): T[] {
    const all = [...this.tinted];
    this.tinted.clear();
    return all;
  }
}
