import type { ShikiConfig } from "@astrojs/markdown-remark";

// Syntax highlighting for every code block on the site: Markdown fences and
// notebook code cells. With defaultColor false, Shiki writes each token's colours
// only as custom properties (--shiki-light, --shiki-dark), which html-validate's
// no-inline-style allows; base.css picks one by colour scheme.
// github-light-default's comment grey is 3.99:1 on --color-code-bg, under WCAG
// AA's 4.5:1; comments take the site's light --color-muted instead. Every other
// colour either theme uses on a notebook page clears 4.5:1 (axe checks each page).
const LIGHT_COLOUR_REPLACEMENTS: Record<string, string> = { "#6e7781": "#5f5a52" };

export const SHIKI: ShikiConfig = {
  themes: { light: "github-light-default", dark: "github-dark-default" },
  defaultColor: false,
  wrap: false,
  transformers: [
    {
      name: "bottomuplabs:light-contrast",
      span(node) {
        const style = node.properties["style"];
        if (typeof style === "string") {
          node.properties["style"] = style.replace(
            /--shiki-light:(#[0-9a-f]{6})/i,
            (match, colour: string) => {
              const replacement = LIGHT_COLOUR_REPLACEMENTS[colour.toLowerCase()];
              return replacement === undefined ? match : `--shiki-light:${replacement}`;
            },
          );
        }
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
