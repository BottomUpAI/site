import { getEntry } from "astro:content";
import type { AboutText } from "./about-text";

export async function aboutSource(site: URL | undefined): Promise<AboutText> {
  const about = await getEntry("about", "about");
  const home = await getEntry("home", "home");
  if (!about || !home) throw new Error("src/content/pages/about.md or home.md is missing");
  return {
    name: home.data.name,
    url: new URL("/about/", site).href,
    body: about.body ?? "",
    timeline: about.data.timeline,
    resume: about.data.resume,
  };
}

// Served as text/plain so browsers show it instead of downloading it.
export const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };
