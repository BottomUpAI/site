import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// verify-deploy.sh normally checks bottomuplabs.ai after a deploy. Pointed at
// the local server (which mirrors CloudFront), every check must pass, and each
// check must actually run.
test("verify-deploy passes against a faithful copy of production", ({ baseURL }) => {
  const r = spawnSync("bash", ["scripts/verify-deploy.sh"], {
    encoding: "utf8",
    env: { ...process.env, ORIGIN: baseURL ?? "" },
  });
  const out = r.stdout + r.stderr;
  expect(out, out).not.toContain("FAIL");
  expect(r.status, out).toBe(0);
  for (const check of [
    "ok status /",
    "ok status /about/",
    "ok status /about",
    "ok home-matches-build",
    "ok about-stylesheets",
    "ok about-fonts",
    "ok not-found",
    "ok header content-security-policy",
    "ok header strict-transport-security",
    "ok header x-content-type-options",
    "ok header x-frame-options",
    "ok header referrer-policy",
    "ok header permissions-policy",
  ]) {
    expect(out).toContain(check);
  }
});
