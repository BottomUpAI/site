import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { expect, test } from "vitest";
import LinkRow from "../../src/components/LinkRow.astro";

const ADDRESS = "hello@bottomuplabs.ai";
const links = [
  { label: "GitHub", href: "https://github.com/ndouglas/" },
  { label: "Email", href: `mailto:${ADDRESS}` },
];

async function renderHtml(): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(LinkRow, { props: { links } });
}

function parse(html: string): Document {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
}

test("the email address never appears literally in the markup", async () => {
  const html = await renderHtml();
  expect(html).not.toContain(ADDRESS);
  expect(html).not.toContain("mailto:");
  expect(html).not.toMatch(/bottomuplabs/i);
});

test("a browser still sees a working mailto link showing the address", async () => {
  const doc = parse(await renderHtml());
  const email = [...doc.querySelectorAll(".link-row a")].find((a) => a.getAttribute("href")?.startsWith("mailto:"));
  expect(email?.getAttribute("href")).toBe(`mailto:${ADDRESS}`);
  expect(email?.textContent).toBe(ADDRESS);
});

test("other links are left alone", async () => {
  const html = await renderHtml();
  expect(html).toContain('href="https://github.com/ndouglas/"');
  expect(parse(html).querySelector('.link-row a[href^="https://"]')?.textContent).toBe("GitHub");
});
