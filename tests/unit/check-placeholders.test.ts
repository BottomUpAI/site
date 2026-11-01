import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const script = fileURLToPath(new URL("../../scripts/check-placeholders.mjs", import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

function gate(dir: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [script, dir, ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

test("fails on a marker in body text and names the file", () => {
  const r = gate(fixture("dist-body"));
  expect(r.status).toBe(1);
  expect(r.out).toContain("index.html: 2 marker(s)");
});

test("fails on a marker that only appears in a meta description", () => {
  expect(gate(fixture("dist-meta")).status).toBe(1);
});

test("fails on a marker that only appears in an href", () => {
  const r = gate(fixture("dist-href"));
  expect(r.status).toBe(1);
  expect(r.out).toContain("about/index.html: 1 marker(s)");
});

test("fails on percent-encoded markers (Markdown link targets), any case", () => {
  const r = gate(fixture("dist-encoded"));
  expect(r.status).toBe(1);
  expect(r.out).toContain("index.html: 2 marker(s)");
});

test("passes a clean tree", () => {
  const r = gate(fixture("dist-clean"));
  expect(r.status).toBe(0);
  expect(r.out).toContain("0 marker(s)");
});

test("--report prints the count but always passes", () => {
  const r = gate(fixture("dist-body"), "--report");
  expect(r.status).toBe(0);
  expect(r.out).toContain("2 marker(s)");
});

test("fails when the directory does not exist", () => {
  expect(gate(fixture("no-such-dir")).status).toBe(2);
});
