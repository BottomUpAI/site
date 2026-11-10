import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { aboutSchema, homeSchema } from "../../src/lib/schemas";

function frontmatter(path: string): unknown {
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match?.[1]) throw new Error(`no frontmatter in ${path}`);
  return parse(match[1]);
}

const validHome = {
  name: "Nathan Douglas",
  focus: "[[WRITE: focus]]",
  description: "[[WRITE: description]]",
  links: [{ label: "GitHub", href: "https://github.com/ndouglas" }],
};

const validAbout = {
  description: "[[WRITE: description]]",
  resume: "https://ndouglas.github.io/resume/resume.pdf",
  timeline: [],
};

describe("seeded content", () => {
  test("home.md frontmatter parses", () => {
    expect(homeSchema.safeParse(frontmatter("src/content/pages/home.md")).success).toBe(true);
  });

  test("about.md frontmatter parses", () => {
    expect(aboutSchema.safeParse(frontmatter("src/content/pages/about.md")).success).toBe(true);
  });
});

describe("links", () => {
  const withHref = (href: string) => ({ ...validHome, links: [{ label: "LinkedIn", href }] });

  test("rejects plain http", () => {
    expect(homeSchema.safeParse(withHref("http://x.example")).success).toBe(false);
  });

  test("accepts https and mailto", () => {
    expect(homeSchema.safeParse(withHref("https://x.example")).success).toBe(true);
    expect(homeSchema.safeParse(withHref("mailto:hello@bottomuplabs.ai")).success).toBe(true);
  });

  test("accepts a WRITE marker in place of a URL", () => {
    expect(homeSchema.safeParse(withHref("[[WRITE: LinkedIn URL]]")).success).toBe(true);
  });

  test("accepts Bluesky", () => {
    expect(homeSchema.safeParse({ ...validHome, links: [{ label: "Bluesky", href: "https://bsky.app/profile/x" }] }).success).toBe(true);
  });

  test("rejects labels outside the fixed set", () => {
    expect(homeSchema.safeParse({ ...validHome, links: [{ label: "Blog", href: "https://x.example" }] }).success).toBe(
      false,
    );
  });
});

describe("timeline", () => {
  const withDate = (date: string) => ({ ...validAbout, timeline: [{ date, title: "[[WRITE: entry]]" }] });

  test("rejects month 13", () => {
    expect(aboutSchema.safeParse(withDate("2026-13")).success).toBe(false);
  });

  test("accepts a year, a year-month or a full date", () => {
    expect(aboutSchema.safeParse(withDate("2026")).success).toBe(true);
    expect(aboutSchema.safeParse(withDate("2026-11")).success).toBe(true);
    expect(aboutSchema.safeParse(withDate("2026-11-08")).success).toBe(true);
  });

  test("rejects day 32 and a one-digit day", () => {
    expect(aboutSchema.safeParse(withDate("2026-11-32")).success).toBe(false);
    expect(aboutSchema.safeParse(withDate("2026-11-8")).success).toBe(false);
  });

  test("an entry has a title and may add a detail", () => {
    const entry = { date: "2026-10", title: "A title", href: "https://x.example", detail: "More about it." };
    expect(aboutSchema.safeParse({ ...validAbout, timeline: [entry] }).success).toBe(true);
    expect(aboutSchema.safeParse({ ...validAbout, timeline: [{ date: "2026-10", title: "A title" }] }).success).toBe(true);
  });

  test("an entry without a title is rejected", () => {
    expect(aboutSchema.safeParse({ ...validAbout, timeline: [{ date: "2026-10", text: "old shape" }] }).success).toBe(false);
  });

  test("accepts an empty timeline", () => {
    expect(aboutSchema.safeParse(validAbout).success).toBe(true);
  });

  test("rejects a non-https entry link", () => {
    expect(
      aboutSchema.safeParse({ ...validAbout, timeline: [{ date: "2026", title: "x", href: "http://x.example" }] })
        .success,
    ).toBe(false);
  });
});
