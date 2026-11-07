import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { GROUPS, groupNotebooks } from "../../src/lib/notebook-groups";
import { notebookMetaSchema } from "../../src/lib/schemas";

const groups = [
  { id: "b", title: "B" },
  { id: "a", title: "A" },
  { id: "empty", title: "Empty" },
];
const nb = (id: string, group: string) => ({ id, data: { group } });

describe("groupNotebooks", () => {
  test("sections follow the groups file's order, keep the notebooks' order, and skip empty groups", () => {
    const sections = groupNotebooks([nb("1", "a"), nb("2", "b"), nb("3", "a")], groups);
    expect(sections.map((s) => [s.group.id, s.notebooks.map((n) => n.id)])).toEqual([
      ["b", ["2"]],
      ["a", ["1", "3"]],
    ]);
  });

  test("a notebook in an unlisted group is an error", () => {
    expect(() => groupNotebooks([nb("1", "nope")], groups)).toThrow(/"nope" isn't in src\/content\/notebook-groups.yaml/);
  });
});

test("every vendored notebook's group is in the groups file", () => {
  const root = new URL("../../src/content/notebooks/", import.meta.url);
  const ids = new Set(GROUPS.map((g) => g.id));
  for (const dir of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const meta = notebookMetaSchema.parse(parse(readFileSync(new URL(`${dir.name}/notebook.yaml`, root), "utf8")));
    expect(ids, dir.name).toContain(meta.group);
  }
});
