import { expect, test } from "@playwright/test";
import { PRODUCTION_CSP } from "../serve.mjs";

test("missing paths get the 404 page with status 404", async ({ request }) => {
  const res = await request.get("/nope/");
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain("Page not found.");
});

test("/about without a slash is served as About", async ({ request }) => {
  const res = await request.get("/about");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("<h1");
  expect(await res.text()).toContain("About");
});

test("every response carries the production CSP", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toBe(PRODUCTION_CSP);
});
