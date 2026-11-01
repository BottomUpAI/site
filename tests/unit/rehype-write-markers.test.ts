import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { expect, test } from "vitest";
import { rehypeWriteMarkers } from "../../src/lib/rehype-write-markers";

async function render(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeWriteMarkers)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

test("wraps a marker in a mark element", async () => {
  expect(await render("Hi [[WRITE: bio]].")).toBe(
    '<p>Hi <mark class="write-marker" data-label="bio">[[WRITE: bio]]</mark>.</p>',
  );
});

test("leaves text without markers alone", async () => {
  expect(await render("Plain *text*.")).toBe("<p>Plain <em>text</em>.</p>");
});

test("marks markers inside nested elements", async () => {
  expect(await render("**[[WRITE: a]]** and [[WRITE: b]]")).toBe(
    '<p><strong><mark class="write-marker" data-label="a">[[WRITE: a]]</mark></strong> and <mark class="write-marker" data-label="b">[[WRITE: b]]</mark></p>',
  );
});
