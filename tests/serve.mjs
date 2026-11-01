#!/usr/bin/env node
// Serves dist/ the way CloudFront serves bottomuplabs.ai, so browser tests see
// what readers see:
//   - /x and /x/ are rewritten to /x/index.html (the viewer-request function);
//   - a missing file gets /404.html with status 404 (custom error response);
//   - every response carries the production security headers.
// SECURITY_HEADERS must match the response headers policy in BottomUpAI/terraform
// (modules/static_site and site.tf); scripts/verify-deploy.sh checks every one
// of them against the live site after each deploy.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests";

export const SECURITY_HEADERS = {
  "content-security-policy": PRODUCTION_CSP,
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/** Maps a request path to a file under dist/, like the CloudFront function. */
export function resolve(pathname) {
  let path = decodeURIComponent(pathname);
  if (path.endsWith("/")) path += "index.html";
  else if (!path.split("/").pop().includes(".")) path += "/index.html";
  const file = normalize(join(ROOT, path));
  return file.startsWith(ROOT) ? file : null;
}

function send(res, status, file) {
  res.writeHead(status, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    ...SECURITY_HEADERS,
  });
  createReadStream(file).pipe(res);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4321);
  createServer((req, res) => {
    const file = resolve(new URL(req.url ?? "/", "http://localhost").pathname);
    if (file && existsSync(file) && statSync(file).isFile()) send(res, 200, file);
    else send(res, 404, join(ROOT, "404.html"));
  }).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
}
