import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { aboutText } from "../lib/about-text";

export const GET: APIRoute = async ({ site }) => {
  const about = await getEntry("about", "about");
  const home = await getEntry("home", "home");
  if (!about || !home) throw new Error("src/content/pages/about.md or home.md is missing");
  const text = aboutText({
    name: home.data.name,
    url: new URL("/about/", site).href,
    body: about.body ?? "",
    timeline: about.data.timeline,
    resume: about.data.resume,
  });
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
