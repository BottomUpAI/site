// [[WRITE: …]] markers stand in for prose Nathan hasn't written yet. They are
// rendered loudly while the site is in progress, and a production build fails
// while any remain (scripts/check-placeholders.mjs).

export const MARKER_PREFIX = "[[WRITE:";

export type Segment = { kind: "text"; value: string } | { kind: "marker"; label: string };

const MARKER = /\[\[WRITE:([^\]]*)\]\]/g;

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
  return text.includes(MARKER_PREFIX);
}
