import { describe, expect, test } from "vitest";
import { hasMarker, MARKER_PREFIX, splitMarkers } from "../../src/lib/markers";

describe("splitMarkers", () => {
  test("plain text is one text segment", () => {
    expect(splitMarkers("a")).toEqual([{ kind: "text", value: "a" }]);
  });

  test("a lone marker", () => {
    expect(splitMarkers("[[WRITE: bio]]")).toEqual([{ kind: "marker", label: "bio" }]);
  });

  test("markers between text, labels trimmed, order kept", () => {
    expect(splitMarkers("x [[WRITE:  a ]] y [[WRITE: b]]")).toEqual([
      { kind: "text", value: "x " },
      { kind: "marker", label: "a" },
      { kind: "text", value: " y " },
      { kind: "marker", label: "b" },
    ]);
  });

  test("adjacent markers with no text between", () => {
    expect(splitMarkers("[[WRITE: a]][[WRITE: b]]")).toEqual([
      { kind: "marker", label: "a" },
      { kind: "marker", label: "b" },
    ]);
  });

  test("empty string gives no segments", () => {
    expect(splitMarkers("")).toEqual([]);
  });
});

test("lowercase and spaced variants still count as markers", () => {
  expect(splitMarkers("[[write: a]] [[ WRITE : b ]]")).toEqual([
    { kind: "marker", label: "a" },
    { kind: "text", value: " " },
    { kind: "marker", label: "b" },
  ]);
});

describe("hasMarker", () => {
  test("true for lowercase and spaced variants", () => {
    expect(hasMarker("[[write: x]]")).toBe(true);
    expect(hasMarker("[[ WRITE : x")).toBe(true);
  });

  test("true even when unterminated", () => {
    expect(hasMarker("[[WRITE: unterminated")).toBe(true);
  });

  test("false for ordinary text", () => {
    expect(hasMarker("written [[elsewhere]]")).toBe(false);
  });

  test("prefix constant", () => {
    expect(MARKER_PREFIX).toBe("[[WRITE:");
  });
});
