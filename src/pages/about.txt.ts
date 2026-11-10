import type { APIRoute } from "astro";
import { aboutSource, TEXT_HEADERS } from "../lib/about-source";
import { aboutPlain } from "../lib/about-text";

export const GET: APIRoute = async ({ site }) =>
  new Response(aboutPlain(await aboutSource(site)), { headers: TEXT_HEADERS });
