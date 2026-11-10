import { expect, test } from "vitest";
import { aboutText } from "../../src/lib/about-text";

const base = {
  name: "Nathan Douglas",
  url: "https://bottomuplabs.ai/about/",
  body: "First paragraph.\n\n- **A list:** item.\n",
  resume: "https://x.example/resume.pdf",
};

test("keeps the body's Markdown and lists the timeline newest first, as given", () => {
  const text = aboutText({
    ...base,
    timeline: [
      { date: "2026-11", title: "Newer", href: "https://a.example", detail: "What it was." },
      { date: "2026-10", title: "Older" },
    ],
  });
  expect(text).toContain("# Nathan Douglas\n\nhttps://bottomuplabs.ai/about/\n\nFirst paragraph.");
  expect(text).toContain("- **A list:** item.");
  expect(text).toContain("- 2026-11: [Newer](https://a.example)\n  What it was.\n- 2026-10: Older");
  expect(text.trimEnd().endsWith("Résumé (PDF): https://x.example/resume.pdf")).toBe(true);
});

test("an entry without a link or detail is just its date and title", () => {
  const text = aboutText({ ...base, timeline: [{ date: "2026", title: "Plain" }] });
  expect(text).toContain("- 2026: Plain\n");
});
