/**
 * A place in a source file, as OpenSCAD names it in a log line. The line
 * and column are 1-based; without a column it's the line's start. A
 * relative file is relative to the previewed document.
 */
export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}
