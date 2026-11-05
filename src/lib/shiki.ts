import type { ShikiConfig } from "@astrojs/markdown-remark";
import { ensureContrast } from "./contrast";

// Syntax highlighting for every code block on the site: Markdown fences and
// notebook code cells. With defaultColor false, Shiki writes each token's colours
// only as custom properties (--shiki-light, --shiki-dark), which html-validate's
// no-inline-style allows; base.css picks one by colour scheme.

/** --color-code-bg in each scheme; tests/unit/contrast.test.ts checks these
 *  match src/styles/tokens.css. */
export const CODE_BG = { light: "#f3f0e9", dark: "#201e1b" } as const;

// The GitHub themes are designed for their own backgrounds, so a few of their
// colours (comment grey, function purple) fall under WCAG AA's 4.5:1 on ours.
// Each token colour is nudged, darker or lighter, just far enough to clear it;
// the target sits a little above 4.5 so rounding can't drop it under.
const MIN_CONTRAST = 4.6;

const readable = (style: string): string =>
  style.replace(/--shiki-(light|dark):(#[0-9a-f]{6})\b/gi, (_, scheme: "light" | "dark", colour: string) =>
    `--shiki-${scheme}:${ensureContrast(colour.toLowerCase(), CODE_BG[scheme], MIN_CONTRAST)}`,
  );

export const SHIKI: ShikiConfig = {
  themes: { light: "github-light-default", dark: "github-dark-default" },
  defaultColor: false,
  wrap: false,
  transformers: [
    {
      name: "bottomuplabs:contrast",
      span(node) {
        const style = node.properties["style"];
        if (typeof style === "string") node.properties["style"] = readable(style);
      },
    },
    {
      name: "bottomuplabs:no-inline-overflow",
      // Astro adds `overflow-x: auto` to each <pre>; base.css already sets it,
      // and as an inline property it fails html-validate's no-inline-style.
      pre(node) {
        const style = node.properties["style"];
        if (typeof style === "string") {
          node.properties["style"] = style.replace(/\s*overflow-x:\s*auto;?/g, "");
        }
      },
    },
  ],
};
