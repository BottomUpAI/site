import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url));

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A notebooks repo checkout with one committed notebook, and a bare "origin" it's pushed to. */
function notebooksRepo(slug: string, files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "notebooks-"));
  const origin = join(root, "origin.git");
  const repo = join(root, "notebooks");
  spawnSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
  mkdirSync(join(repo, slug), { recursive: true });
  git(repo, "init", "--quiet", "--initial-branch=main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "T");
  writeFileSync(join(repo, slug, `${slug}.ipynb`), '{"nbformat": 4}');
  for (const [name, text] of Object.entries(files)) writeFileSync(join(repo, slug, name), text);
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", "init");
  // origin is the GitHub URL the scripts derive the page's source link from;
  // insteadOf points fetches and pushes at the local bare repo.
  git(repo, "remote", "add", "origin", "https://github.com/BottomUpAI/notebooks.git");
  git(repo, "config", `url.${origin}.insteadOf`, "https://github.com/BottomUpAI/notebooks.git");
  git(repo, "push", "--quiet", "origin", "main");
  return { repo, dir: join(repo, slug), origin };
}

/** A scratch "site" holding the scripts, as a git repo on main. */
function site() {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  cpSync(scripts, join(dir, "scripts"), { recursive: true });
  git(dir, "init", "--quiet", "--initial-branch=main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", "init");
  return dir;
}

/** Runs a script under /bin/bash (3.2 on macOS), with stub `gh` and `npm` that record their calls. */
function run(cwd: string, script: string, ...args: string[]) {
  const bin = mkdtempSync(join(tmpdir(), "stubs-"));
  const log = join(bin, "calls.log");
  for (const tool of ["gh", "npm"]) {
    writeFileSync(join(bin, tool), `#!/bin/sh\necho "${tool} $*" >> "${log}"\n`);
    chmodSync(join(bin, tool), 0o755);
  }
  const r = spawnSync("/bin/bash", [join(cwd, "scripts", script), ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env["PATH"]}` },
  });
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  return { status: r.status, out: r.stdout + r.stderr, calls };
}

describe("sync-notebook.sh", () => {
  test("copies the notebook and its licence, and scaffolds notebook.yaml", () => {
    const { dir } = notebooksRepo("some-notebook", { "UPSTREAM-LICENSE": "MIT" });
    const cwd = site();
    const r = run(cwd, "sync-notebook.sh", dir);
    expect(r.out).not.toContain("unbound variable");
    expect(r.status).toBe(0);
    const dest = join(cwd, "src/content/notebooks/some-notebook");
    expect(readFileSync(join(dest, "some-notebook.ipynb"), "utf8")).toBe('{"nbformat": 4}');
    expect(readFileSync(join(dest, "UPSTREAM-LICENSE"), "utf8")).toBe("MIT");
    expect(readFileSync(join(dest, "notebook.yaml"), "utf8")).toBe(
      [
        'description: "[[WRITE: one or two sentences on what the some-notebook notebook is]]"',
        "source: https://github.com/BottomUpAI/notebooks/blob/main/some-notebook/some-notebook.ipynb",
        "licence: UPSTREAM-LICENSE",
        "",
      ].join("\n"),
    );
  });

  test("with no licence file, notebook.yaml names none", () => {
    const { dir } = notebooksRepo("plain");
    const cwd = site();
    expect(run(cwd, "sync-notebook.sh", dir).status).toBe(0);
    expect(readFileSync(join(cwd, "src/content/notebooks/plain/notebook.yaml"), "utf8")).not.toContain("licence");
  });

  test("leaves an existing notebook.yaml alone", () => {
    const { dir } = notebooksRepo("kept");
    const cwd = site();
    mkdirSync(join(cwd, "src/content/notebooks/kept"), { recursive: true });
    writeFileSync(join(cwd, "src/content/notebooks/kept/notebook.yaml"), "description: Nathan's words\n");
    expect(run(cwd, "sync-notebook.sh", dir).status).toBe(0);
    expect(readFileSync(join(cwd, "src/content/notebooks/kept/notebook.yaml"), "utf8")).toBe("description: Nathan's words\n");
  });

  test("rejects a directory name that isn't a URL slug", () => {
    const { dir } = notebooksRepo("Bad_Name");
    const r = run(site(), "sync-notebook.sh", dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain("isn't a URL slug");
  });
});

describe("publish-notebook.sh", () => {
  test("refuses a notebook with uncommitted changes", () => {
    const { dir } = notebooksRepo("dirty");
    writeFileSync(join(dir, "dirty.ipynb"), '{"nbformat": 4, "changed": true}');
    const r = run(site(), "publish-notebook.sh", dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain("uncommitted changes");
  });

  test("ignores untracked files next to the notebook", () => {
    const { dir } = notebooksRepo("exported");
    writeFileSync(join(dir, "exported.md"), "nbconvert output");
    const r = run(site(), "publish-notebook.sh", dir);
    expect(r.out).not.toContain("uncommitted changes");
  });

  test("refuses a notebook that isn't pushed", () => {
    const { repo, dir } = notebooksRepo("unpushed");
    writeFileSync(join(dir, "unpushed.ipynb"), '{"nbformat": 4, "v": 2}');
    git(repo, "commit", "--quiet", "-am", "local only");
    const r = run(site(), "publish-notebook.sh", dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain("push it first");
  });

  test("a new notebook stops at the description marker, on its own branch, before building or pushing", () => {
    const { dir } = notebooksRepo("fresh");
    const cwd = site();
    git(cwd, "remote", "add", "origin", mkdtempSync(join(tmpdir(), "site-origin-")));
    spawnSync("git", ["init", "--quiet", "--bare", git(cwd, "remote", "get-url", "origin")]);
    git(cwd, "push", "--quiet", "-u", "origin", "main");
    const r = run(cwd, "publish-notebook.sh", dir);
    expect(r.out).not.toContain("unbound variable");
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain("Write the description");
    expect(git(cwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("notebook/fresh");
    expect(r.calls).toEqual([]);
  });
});

describe("update-baselines.sh", () => {
  test("refuses to run on main", () => {
    const r = run(site(), "update-baselines.sh");
    expect(r.status).toBe(1);
    expect(r.out).toContain("not main");
    expect(r.calls).toEqual([]);
  });

  test("refuses a dirty tree", () => {
    const cwd = site();
    git(cwd, "switch", "--quiet", "-c", "feature");
    writeFileSync(join(cwd, "scratch.txt"), "x");
    const r = run(cwd, "update-baselines.sh");
    expect(r.status).toBe(1);
    expect(r.out).toContain("commit or stash");
    expect(r.calls).toEqual([]);
  });
});
