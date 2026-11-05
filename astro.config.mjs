// @ts-check
import { defineConfig } from "astro/config";
import { rehypeWriteMarkers } from "./src/lib/rehype-write-markers.ts";
import { SHIKI } from "./src/lib/shiki.ts";

export default defineConfig({
  site: "https://bottomuplabs.ai",
  // CloudFront's viewer-request function maps /x/ to /x/index.html, so pages
  // are built as directories and linked with a trailing slash.
  trailingSlash: "always",
  build: {
    format: "directory",
    // Stylesheets are always separate files: the CSP allows inline styles, but
    // separate files cache across pages.
    inlineStylesheets: "never",
  },
  compressHTML: true,
  markdown: {
    rehypePlugins: [rehypeWriteMarkers],
    shikiConfig: SHIKI,
  },
});
