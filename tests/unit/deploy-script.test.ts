import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const script = fileURLToPath(new URL("../../scripts/deploy.sh", import.meta.url));

// Runs scripts/deploy.sh with a stub `aws` on PATH that records its arguments,
// under /bin/bash (3.2 on macOS, 5.x on CI runners), in a scratch directory
// holding a minimal dist/.
function deploy(...args: string[]) {
  const cwd = mkdtempSync(join(tmpdir(), "deploy-"));
  mkdirSync(join(cwd, "dist"));
  writeFileSync(join(cwd, "dist", "index.html"), "<!doctype html>");
  writeFileSync(join(cwd, "dist", "404.html"), "<!doctype html>");
  const bin = mkdtempSync(join(tmpdir(), "aws-stub-"));
  const log = join(bin, "calls.log");
  writeFileSync(
    join(bin, "aws"),
    `#!/bin/sh\necho "$*" >> "${log}"\ncase "$*" in *create-invalidation*) echo I123;; esac\n`,
  );
  chmodSync(join(bin, "aws"), 0o755);
  const r = spawnSync("/bin/bash", [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env["PATH"]}`, SITE_BUCKET: "b", SITE_DISTRIBUTION_ID: "D" },
  });
  let calls: string[] = [];
  try {
    calls = readFileSync(log, "utf8").trim().split("\n");
  } catch {}
  return { status: r.status, out: r.stdout + r.stderr, calls };
}

test("--dryrun syncs with --dryrun and never invalidates", () => {
  const r = deploy("--dryrun");
  expect(r.out).not.toContain("unbound variable");
  expect(r.status).toBe(0);
  expect(r.calls).toHaveLength(3);
  expect(r.calls.every((c) => c.startsWith("s3 sync dist s3://b --dryrun"))).toBe(true);
});

test("a real deploy syncs assets, then the rest with --delete, then text exports as UTF-8, then invalidates and waits", () => {
  const r = deploy();
  expect(r.out).not.toContain("unbound variable");
  expect(r.status).toBe(0);
  expect(r.calls[0]).toContain('--include _astro/*');
  expect(r.calls[0]).toContain("immutable");
  expect(r.calls[1]).toContain("--delete");
  expect(r.calls[1]).toContain("max-age=0");
  expect(r.calls[1]).toContain("--exclude *.txt --exclude *.md");
  expect(r.calls[2]).toContain("--include *.txt --include *.md");
  expect(r.calls[2]).toContain("--content-type text/plain; charset=utf-8");
  expect(r.calls[3]).toContain("create-invalidation --distribution-id D --paths /*");
  expect(r.calls[4]).toContain("wait invalidation-completed --distribution-id D --id I123");
});
