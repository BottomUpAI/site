import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { contrast, ensureContrast } from "../../src/lib/contrast";
import { CODE_BG, SHIKI } from "../../src/lib/shiki";
import { readFrom, renderNotebook } from "../../src/lib/notebook";

describe("contrast", () => {
  test("matches known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#6e7781", "#f3f0e9")).toBeCloseTo(3.99, 2);
  });
});

describe("ensureContrast", () => {
  test("leaves a colour that already passes alone", () => {
    expect(ensureContrast("#1f2328", "#f3f0e9", 4.5)).toBe("#1f2328");
  });

  test("darkens on a light background and lightens on a dark one, just enough", () => {
    const light = ensureContrast("#8250df", CODE_BG.light, 4.6);
    expect(contrast(light, CODE_BG.light)).toBeGreaterThanOrEqual(4.6);
    expect(contrast(light, CODE_BG.light)).toBeLessThan(5);
    const dark = ensureContrast("#444c56", CODE_BG.dark, 4.6);
    expect(contrast(dark, CODE_BG.dark)).toBeGreaterThanOrEqual(4.6);
    expect(contrast(dark, CODE_BG.dark)).toBeLessThan(5);
  });
});

test("CODE_BG matches --color-code-bg in tokens.css", () => {
  const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
  const values = [...css.matchAll(/--color-code-bg:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase());
  expect(values).toEqual([CODE_BG.light, CODE_BG.dark]);
});

test("every highlighted token in a vendored notebook clears 4.5:1 in both schemes", async () => {
  expect(SHIKI.transformers?.some((t) => t.name === "bottomuplabs:contrast")).toBe(true);
  const root = new URL("../../src/content/notebooks/", import.meta.url);
  const slugs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  expect(slugs.length).toBeGreaterThan(0);
  for (const slug of slugs) {
    // Like the loader, take the one .ipynb in the directory, whatever its name.
    const ipynb = readdirSync(new URL(`${slug}/`, root)).find((f) => f.endsWith(".ipynb"))!;
    const json = readFileSync(new URL(`${slug}/${ipynb}`, root), "utf8");
    const { cells } = await renderNotebook(json, slug, { readFile: readFrom(fileURLToPath(new URL(`${slug}/`, root))) });
    const html = cells.map((c) => c.html).join("");
    for (const [, scheme, colour] of html.matchAll(/--shiki-(light|dark):(#[0-9a-f]{6})/gi)) {
      expect(contrast(colour!, CODE_BG[scheme as "light" | "dark"]), `${slug} ${scheme} ${colour}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
