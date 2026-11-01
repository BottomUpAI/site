/// <reference types="astro/client" />

// Plain `tsc` (npm run check, after `astro check`) can't read .astro files, so
// tests that import a component see this fallback; `astro check` itself
// resolves the real component types.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";
  const Component: AstroComponentFactory;
  export default Component;
}
