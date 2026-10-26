import { SourceLocation } from "../types/SourceLocation";

/**
 * OpenSCAD's `in file <file>, line <n>`. The file may hold spaces and
 * commas, and older versions quote it.
 */
const LOCATION = /(in file )(["']?)(.+?)\2, line (\d+)/g;

export type TextPiece =
  | { text: string }
  | { text: string; location: SourceLocation };

/**
 * Splits a log line into plain text and the source locations in it, in
 * order, so the locations can be shown as links. A location's text is the
 * part after "in file ".
 */
export function splitSourceLocations(line: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  let last = 0;
  for (const match of line.matchAll(LOCATION)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) pieces.push({ text: line.slice(last, start) });
    last = (match.index ?? 0) + match[0].length;
    pieces.push({
      text: line.slice(start, last),
      location: { file: match[3], line: Number(match[4]) },
    });
  }
  if (last < line.length) pieces.push({ text: line.slice(last) });
  return pieces;
}
