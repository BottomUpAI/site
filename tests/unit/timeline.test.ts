import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { expect, test } from "vitest";
import Timeline from "../../src/components/Timeline.astro";

async function render(entries: unknown[]): Promise<Document> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Timeline, { props: { entries } });
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

test("only the title is a link; the detail sits outside it", async () => {
  const doc = await render([
    { date: "2026-10", title: "The title", href: "https://x.example", detail: "The detail, with 350 runs." },
  ]);
  const link = doc.querySelector(".timeline a");
  expect(link?.textContent?.trim()).toBe("The title");
  expect(link?.getAttribute("href")).toBe("https://x.example");
  const detail = doc.querySelector(".timeline .detail");
  expect(detail?.textContent?.trim()).toBe("The detail, with 350 runs.");
  expect(detail?.closest("a")).toBeNull();
});

test("an entry without a link or detail renders just its title", async () => {
  const doc = await render([{ date: "2026", title: "Plain" }]);
  expect(doc.querySelector(".timeline a")).toBeNull();
  expect(doc.querySelector(".timeline .detail")).toBeNull();
  expect(doc.querySelector(".timeline li")?.textContent).toContain("Plain");
});

test("markers in title and detail are rendered as markers", async () => {
  const doc = await render([{ date: "2026", title: "[[WRITE: t]]", detail: "[[WRITE: d]]" }]);
  expect(doc.querySelectorAll(".timeline mark.write-marker")).toHaveLength(2);
});

test("an empty timeline renders nothing", async () => {
  const doc = await render([]);
  expect(doc.querySelector(".timeline")).toBeNull();
});
