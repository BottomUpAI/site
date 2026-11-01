import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

// Runs scripts/deploy.sh with a stub `aws` on PATH that records its arguments,
// under /bin/bash (3.2 on macOS, 5.x on CI runners). Needs a built dist/.
function deploy(...args: string[]) {
  const bin = mkdtempSync(join(tmpdir(), "aws-stub-"));
  const log = join(bin, "calls.log");
  writeFileSync(
    join(bin, "aws"),
    `#!/bin/sh\necho "$*" >> "${log}"\ncase "$*" in *create-invalidation*) echo I123;; esac\n`,
  );
  chmodSync(join(bin, "aws"), 0o755);
  const r = spawnSync("/bin/bash", ["scripts/deploy.sh", ...args], {
    cwd: root,
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
  expect(r.calls).toHaveLength(2);
  expect(r.calls.every((c) => c.startsWith("s3 sync dist s3://b --dryrun"))).toBe(true);
});

test("a real deploy syncs assets first, then the rest with --delete, then invalidates and waits", () => {
  const r = deploy();
  expect(r.out).not.toContain("unbound variable");
  expect(r.status).toBe(0);
  expect(r.calls[0]).toContain('--include _astro/*');
  expect(r.calls[0]).toContain("immutable");
  expect(r.calls[1]).toContain("--delete");
  expect(r.calls[1]).toContain("max-age=0");
  expect(r.calls[2]).toContain("create-invalidation --distribution-id D --paths /*");
  expect(r.calls[3]).toContain("wait invalidation-completed --distribution-id D --id I123");
});
