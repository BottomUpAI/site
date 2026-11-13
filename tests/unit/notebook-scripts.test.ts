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

/** A notebooks repo checkout with one committed notebook, <group>/<slug>/<slug>.ipynb,
 *  and a bare "origin" it's pushed to. */
function notebooksRepo(slug: string, files: Record<string, string> = {}, group = "arena") {
  const root = mkdtempSync(join(tmpdir(), "notebooks-"));
  const origin = join(root, "origin.git");
  const repo = join(root, "notebooks");
  spawnSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
  const dir = group === "" ? join(repo, slug) : join(repo, group, slug);
  mkdirSync(dir, { recursive: true });
  git(repo, "init", "--quiet", "--initial-branch=main");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "T");
  writeFileSync(join(dir, `${slug}.ipynb`), '{"nbformat": 4}');
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  git(repo, "add", "-A");
  git(repo, "commit", "--quiet", "-m", "init");
  // origin is the GitHub URL the scripts derive the page's source link from;
  // insteadOf points fetches and pushes at the local bare repo.
  git(repo, "remote", "add", "origin", "https://github.com/BottomUpAI/notebooks.git");
  git(repo, "config", `url.${origin}.insteadOf`, "https://github.com/BottomUpAI/notebooks.git");
  git(repo, "push", "--quiet", "origin", "main");
  return { repo, dir, origin };
}

// Like the real groups file, its header comment names the [[WRITE: …]] marker,
// which mustn't count as one.
const GROUPS = "# A new group gets a [[WRITE: …]] title.\n- id: arena\n  title: ARENA\n";

/** A scratch "site" holding the scripts and a groups file listing "arena", as a
 *  git repo on main, pushed to a bare origin. */
function site() {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  const origin = mkdtempSync(join(tmpdir(), "site-origin-"));
  spawnSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
  cpSync(scripts, join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "src/content"), { recursive: true });
  writeFileSync(join(dir, "src/content/notebook-groups.yaml"), GROUPS);
  git(dir, "init", "--quiet", "--initial-branch=main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "--quiet", "-m", "init");
  git(dir, "remote", "add", "origin", origin);
  git(dir, "push", "--quiet", "-u", "origin", "main");
  return dir;
}

/** Runs a script under /bin/bash (3.2 on macOS), with stub `gh` and `npm` that record their calls. */
function run(cwd: string, script: string, ...args: string[]) {
  return runWith({}, cwd, script, ...args);
}

/** As run(), with exit statuses for the stubs (e.g. { npm: 1 } for a failing build). */
function runWith(exits: Record<string, number>, cwd: string, script: string, ...args: string[]) {
  const bin = mkdtempSync(join(tmpdir(), "stubs-"));
  const log = join(bin, "calls.log");
  for (const tool of ["gh", "npm"]) {
    writeFileSync(join(bin, tool), `#!/bin/sh\necho "${tool} $*" >> "${log}"\nexit ${exits[tool] ?? 0}\n`);
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
        "source: https://github.com/BottomUpAI/notebooks/blob/main/arena/some-notebook/some-notebook.ipynb",
        "group: arena",
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

  test("in an existing notebook.yaml, keeps the description and licence and refreshes source and group", () => {
    const { dir } = notebooksRepo("kept");
    const cwd = site();
    mkdirSync(join(cwd, "src/content/notebooks/kept"), { recursive: true });
    writeFileSync(
      join(cwd, "src/content/notebooks/kept/notebook.yaml"),
      "description: Nathan's words\nsource: https://github.com/BottomUpAI/notebooks/blob/main/kept/kept.ipynb\nlicence: L\n",
    );
    expect(run(cwd, "sync-notebook.sh", dir).status).toBe(0);
    expect(readFileSync(join(cwd, "src/content/notebooks/kept/notebook.yaml"), "utf8")).toBe(
      [
        "description: Nathan's words",
        "licence: L",
        "source: https://github.com/BottomUpAI/notebooks/blob/main/arena/kept/kept.ipynb",
        "group: arena",
        "",
      ].join("\n"),
    );
    expect(readFileSync(join(cwd, "src/content/notebook-groups.yaml"), "utf8")).toBe(GROUPS);
  });

  test("a new group is added to the groups file with a title to write", () => {
    const { dir } = notebooksRepo("first", {}, "new-topic");
    const cwd = site();
    const r = run(cwd, "sync-notebook.sh", dir);
    expect(r.status, r.out).toBe(0);
    expect(readFileSync(join(cwd, "src/content/notebook-groups.yaml"), "utf8")).toBe(
      GROUPS + '- id: new-topic\n  title: "[[WRITE: the new-topic group\'s title on the Notebooks index]]"\n',
    );
    expect(readFileSync(join(cwd, "src/content/notebooks/first/notebook.yaml"), "utf8")).toContain("group: new-topic\n");
  });

  test("rejects a notebook that isn't in a group folder", () => {
    const { dir } = notebooksRepo("loose", {}, "");
    const r = run(site(), "sync-notebook.sh", dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain("isn't in a group folder");
  });

  test("a notebook named by its file, in a directory of several, gets a slug from both", () => {
    const { dir } = notebooksRepo("nes", { "00-meet-mario.ipynb": '{"mario": 0}', "01-next.ipynb": "{}" }, "nes-and-interp");
    const cwd = site();
    const r = run(cwd, "sync-notebook.sh", join(dir, "00-meet-mario.ipynb"));
    expect(r.status, r.out).toBe(0);
    const dest = join(cwd, "src/content/notebooks/nes-00-meet-mario");
    expect(readFileSync(join(dest, "00-meet-mario.ipynb"), "utf8")).toBe('{"mario": 0}');
    expect(existsSync(join(dest, "01-next.ipynb"))).toBe(false);
    expect(readFileSync(join(dest, "notebook.yaml"), "utf8")).toContain(
      "source: https://github.com/BottomUpAI/notebooks/blob/main/nes-and-interp/nes/00-meet-mario.ipynb\ngroup: nes-and-interp\n",
    );
  });

  test("a file whose name matches its directory gets the directory's slug", () => {
    const { dir } = notebooksRepo("same");
    const cwd = site();
    expect(run(cwd, "sync-notebook.sh", join(dir, "same.ipynb")).status).toBe(0);
    expect(existsSync(join(cwd, "src/content/notebooks/same/same.ipynb"))).toBe(true);
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

  test("uncommitted work on another notebook in the same directory doesn't stop it", () => {
    const { dir } = notebooksRepo("series", { "00-a.ipynb": "{}", "01-b.ipynb": "{}" });
    writeFileSync(join(dir, "01-b.ipynb"), '{"in progress": true}');
    const cwd = site();
    const r = run(cwd, "publish-notebook.sh", join(dir, "00-a.ipynb"));
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain("Replace the [[WRITE: …]] markers");
    expect(git(cwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("notebook/series-00-a");
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
    const r = run(cwd, "publish-notebook.sh", dir);
    expect(r.out).not.toContain("unbound variable");
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain("Replace the [[WRITE: …]] markers");
    expect(git(cwd, "rev-parse", "--abbrev-ref", "HEAD")).toBe("notebook/fresh");
    expect(r.calls).toEqual([]);
  });

  test("after the description is written, a second run gets past the clean-tree check to the build", () => {
    const { dir } = notebooksRepo("second");
    const cwd = site();
    expect(run(cwd, "publish-notebook.sh", dir).out).toContain("Replace the [[WRITE: …]] markers");
    const meta = join(cwd, "src/content/notebooks/second/notebook.yaml");
    writeFileSync(meta, readFileSync(meta, "utf8").replace(/"\[\[WRITE:[^"]*"/, '"Nathan\'s words."'));
    const r = runWith({ npm: 1 }, cwd, "publish-notebook.sh", dir);
    expect(r.out).not.toContain("uncommitted changes");
    expect(r.out).toContain("the build failed");
    expect(r.calls).toEqual(["npm run build"]);
  });

  test("other uncommitted site changes still stop it", () => {
    const { dir } = notebooksRepo("other");
    const cwd = site();
    writeFileSync(join(cwd, "scripts", "stray.txt"), "x");
    const r = run(cwd, "publish-notebook.sh", dir);
    expect(r.status).toBe(1);
    expect(r.out).toContain("the site has uncommitted changes outside src/content/notebooks/other");
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
