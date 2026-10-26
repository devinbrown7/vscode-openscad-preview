/**
 * A place in a source file, as OpenSCAD names it in a log line. The line is
 * 1-based. A relative file is relative to the previewed document.
 */
export interface SourceLocation {
  file: string;
  line: number;
}
