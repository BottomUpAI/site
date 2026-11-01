// [[WRITE: …]] markers stand in for prose Nathan hasn't written yet. They are
// rendered loudly while the site is in progress, and a production build fails
// while any remain (scripts/check-placeholders.mjs).

export const MARKER_PREFIX = "[[WRITE:";

export type Segment = { kind: "text"; value: string } | { kind: "marker"; label: string };

// The canonical form is [[WRITE: label]], but a mistyped variant such as
// [[write: …]] or [[ WRITE : …]] must still show (and still fail the gate).
const MARKER = /\[\[\s*write\s*:([^\]]*)\]\]/gi;
const MARKER_START = /\[\[\s*write\s*:/i;

/** Splits text into plain runs and complete markers, in order. */
export function splitMarkers(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    if (match.index > last) {
      segments.push({ kind: "text", value: text.slice(last, match.index) });
    }
    segments.push({ kind: "marker", label: (match[1] ?? "").trim() });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments;
}

/** True if the text contains a marker, even an unterminated one. */
export function hasMarker(text: string): boolean {
  return MARKER_START.test(text);
}
