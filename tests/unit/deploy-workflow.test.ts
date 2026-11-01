import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";

type Step = { run?: string; uses?: string };
type Job = { permissions?: Record<string, string>; steps?: Step[]; needs?: string | string[] };

const workflow = parse(readFileSync(new URL("../../.github/workflows/deploy.yaml", import.meta.url), "utf8")) as {
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

const canMintTokens = (job: Job) => (job.permissions ?? workflow.permissions)?.["id-token"] === "write";
const runsPackageCode = (job: Job) =>
  (job.steps ?? []).some((s) => /\bnpm\b|\bnpx\b|\byarn\b|\bpnpm\b/.test(s.run ?? ""));

// A dependency's install script (or any package code) must never run where an
// AWS OIDC token can be minted: that would let it assume the deploy role.
test("no job both mints OIDC tokens and runs package code", () => {
  for (const [name, job] of Object.entries(workflow.jobs)) {
    expect(canMintTokens(job) && runsPackageCode(job), `job ${name}`).toBe(false);
  }
});

test("the build job cannot mint tokens and the deploy job depends on it", () => {
  expect(canMintTokens(workflow.jobs["build"] ?? {})).toBe(false);
  expect(workflow.jobs["deploy"]?.needs).toContain("build");
  expect(canMintTokens(workflow.jobs["deploy"] ?? {})).toBe(true);
});
